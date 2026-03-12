import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const INVALID_ARTIFACT_ERROR = 'Invalid Playbook artifact – regenerate using CLI owned output flags.';

const ARTIFACT_VERSION = 1 as const;

type JsonRecord = Record<string, unknown>;

type ArtifactEnvelope = {
  artifact: string;
  version: number;
  generated_at: string;
  checksum: string;
  data: JsonRecord;
};

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

const deterministicStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

const computeChecksum = (value: unknown): string => createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex');

const normalizeArtifactType = (artifactPath: string, payload: JsonRecord): string => {
  if (typeof payload.command === 'string') {
    if (payload.command === 'plan') {
      return 'playbook.plan';
    }
    if (payload.command === 'verify') {
      return 'playbook.findings';
    }
    if (payload.command === 'index') {
      return 'playbook.index';
    }
  }

  const basename = path.basename(artifactPath).toLowerCase();
  if (basename.includes('plan')) return 'playbook.plan';
  if (basename.includes('findings') || basename.includes('verify')) return 'playbook.findings';
  if (basename.includes('index')) return 'playbook.index';
  return 'playbook.artifact';
};

const validateDataByArtifact = (artifact: string, data: JsonRecord): void => {
  if (artifact === 'playbook.plan') {
    if (data.command !== 'plan' || data.schemaVersion !== '1.0' || !Array.isArray(data.tasks)) {
      throw new Error(INVALID_ARTIFACT_ERROR);
    }
  }

  if (artifact === 'playbook.findings') {
    const hasFindings = Array.isArray(data.findings) || Array.isArray(data.failures);
    if (data.command !== 'verify' || data.schemaVersion !== '1.0' || !hasFindings) {
      throw new Error(INVALID_ARTIFACT_ERROR);
    }
  }

  if (artifact === 'playbook.index') {
    if (data.schemaVersion !== '1.0' || !Array.isArray(data.modules)) {
      throw new Error(INVALID_ARTIFACT_ERROR);
    }
  }
};

const parseEnvelope = (payload: unknown): ArtifactEnvelope | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.artifact === 'string' &&
    typeof candidate.version === 'number' &&
    typeof candidate.generated_at === 'string' &&
    typeof candidate.checksum === 'string' &&
    candidate.data &&
    typeof candidate.data === 'object' &&
    !Array.isArray(candidate.data)
  ) {
    return {
      artifact: candidate.artifact,
      version: candidate.version,
      generated_at: candidate.generated_at,
      checksum: candidate.checksum,
      data: candidate.data as JsonRecord
    };
  }

  return null;
};

export const writeJsonArtifact = (artifactPath: string, payload: JsonRecord): string => {
  let envelope: ArtifactEnvelope;

  try {
    const artifact = normalizeArtifactType(artifactPath, payload);
    validateDataByArtifact(artifact, payload);
    envelope = {
      artifact,
      version: ARTIFACT_VERSION,
      generated_at: new Date().toISOString(),
      checksum: computeChecksum(payload),
      data: payload
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to serialize artifact at ${artifactPath}: ${message}`);
  }

  const parentDir = path.dirname(artifactPath);
  fs.mkdirSync(parentDir, { recursive: true });

  const tempPath = path.join(parentDir, `.${path.basename(artifactPath)}.${process.pid}.${Date.now()}.tmp`);

  try {
    fs.writeFileSync(tempPath, deterministicStringify(envelope), { encoding: 'utf8' });
    fs.renameSync(tempPath, artifactPath);
    return artifactPath;
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write artifact at ${artifactPath}: ${message}`);
  }
};

export const readJsonArtifact = <T extends JsonRecord = JsonRecord>(artifactPath: string): T => {
  let raw = '';

  try {
    raw = fs.readFileSync(artifactPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${INVALID_ARTIFACT_ERROR} ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(INVALID_ARTIFACT_ERROR);
  }

  const envelope = parseEnvelope(parsed);
  if (!envelope) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(INVALID_ARTIFACT_ERROR);
    }
    return parsed as T;
  }

  if (envelope.version !== ARTIFACT_VERSION) {
    throw new Error(INVALID_ARTIFACT_ERROR);
  }

  validateDataByArtifact(envelope.artifact, envelope.data);

  const expectedChecksum = computeChecksum(envelope.data);
  if (expectedChecksum !== envelope.checksum) {
    throw new Error(INVALID_ARTIFACT_ERROR);
  }

  return envelope.data as T;
};
