import fs from 'node:fs';
import path from 'node:path';

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort((left, right) => left.localeCompare(right))) {
      const nested = canonicalize(record[key]);
      if (nested !== undefined) {
        normalized[key] = nested;
      }
    }
    return normalized;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  return value;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

export const readJsonIfExists = <T>(filePath: string): T | undefined => {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

export const writeDeterministicJsonAtomic = (filePath: string, payload: unknown): void => {
  const parentDir = path.dirname(filePath);
  fs.mkdirSync(parentDir, { recursive: true });

  const tempPath = path.join(parentDir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tempPath, deterministicStringify(payload), 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
  }
};
