import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const toAbsoluteOutputPath = (cwd: string, outFile: string): string => (path.isAbsolute(outFile) ? outFile : path.join(cwd, outFile));

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    const normalized: Record<string, unknown> = {};

    for (const key of keys) {
      const entry = canonicalize(record[key]);
      if (entry !== undefined) {
        normalized[key] = entry;
      }
    }

    return normalized;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  return value;
};

const stableSerialize = (value: unknown): string => JSON.stringify(canonicalize(value));

const computeChecksum = (value: unknown): string => createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex');

const stringifyDeterministic = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

const inferArtifact = (targetPath: string, payload: Record<string, unknown>): string => {
  if (payload.command === 'plan') return 'playbook.plan';
  if (payload.command === 'verify') return 'playbook.findings';
  if (payload.command === 'index') return 'playbook.index';

  const base = path.basename(targetPath).toLowerCase();
  if (base.includes('plan')) return 'playbook.plan';
  if (base.includes('findings') || base.includes('verify')) return 'playbook.findings';
  if (base.includes('index')) return 'playbook.index';
  return 'playbook.artifact';
};

const writeArtifactPath = (targetPath: string, payload: Record<string, unknown>, envelope = true): string => {
  const artifactPayload = envelope
    ? {
        artifact: inferArtifact(targetPath, payload),
        version: 1,
        generated_at: new Date().toISOString(),
        checksum: computeChecksum(payload),
        data: payload
      }
    : payload;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, stringifyDeterministic(artifactPayload), 'utf8');
  fs.renameSync(tempPath, targetPath);
  return targetPath;
};

export const writeJsonArtifact = (cwd: string, outFile: string, payload: unknown, command: string): string => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`playbook ${command}: JSON artifact payload must be an object.`);
  }

  const targetPath = toAbsoluteOutputPath(cwd, outFile);

  try {
    return writeArtifactPath(targetPath, payload as Record<string, unknown>, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`playbook ${command}: failed to write JSON artifact to ${targetPath}: ${message}`);
  }
};

export const writeJsonArtifactAbsolute = (targetPath: string, payload: Record<string, unknown>, command: string, options?: { envelope?: boolean }): string => {
  try {
    return writeArtifactPath(targetPath, payload, options?.envelope ?? true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`playbook ${command}: failed to write JSON artifact to ${targetPath}: ${message}`);
  }
};

export const emitJsonOutput = (options: {
  cwd: string;
  command: string;
  payload: unknown;
  outFile?: string;
}): void => {
  if (options.outFile) {
    writeJsonArtifact(options.cwd, options.outFile, options.payload, options.command);
  }

  console.log(JSON.stringify(options.payload, null, 2));
};
