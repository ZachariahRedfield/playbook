import fs from 'node:fs';
import path from 'node:path';
import type { ArchitectureRegistry, Subsystem } from './types.js';

const ARCHITECTURE_REGISTRY_PATH = '.playbook/architecture/subsystems.json';

const asNonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed = value.map((entry) => asNonEmptyString(entry));
  return parsed.every((entry): entry is string => entry !== undefined) ? parsed : undefined;
};

const parseSubsystem = (value: unknown, index: number): Subsystem => {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid architecture registry: subsystems[${index}] must be an object.`);
  }

  const candidate = value as Record<string, unknown>;
  const name = asNonEmptyString(candidate.name);
  const purpose = asNonEmptyString(candidate.purpose);
  const commands = asStringArray(candidate.commands);
  const artifacts = asStringArray(candidate.artifacts);
  const upstream = candidate.upstream === undefined ? undefined : asStringArray(candidate.upstream);
  const downstream = candidate.downstream === undefined ? undefined : asStringArray(candidate.downstream);

  if (!name) {
    throw new Error(`Invalid architecture registry: subsystems[${index}].name must be a non-empty string.`);
  }

  if (!purpose) {
    throw new Error(`Invalid architecture registry: subsystems[${index}].purpose must be a non-empty string.`);
  }

  if (!commands) {
    throw new Error(`Invalid architecture registry: subsystems[${index}].commands must be an array of non-empty strings.`);
  }

  if (!artifacts) {
    throw new Error(`Invalid architecture registry: subsystems[${index}].artifacts must be an array of non-empty strings.`);
  }

  if (candidate.upstream !== undefined && !upstream) {
    throw new Error(`Invalid architecture registry: subsystems[${index}].upstream must be an array of non-empty strings when provided.`);
  }

  if (candidate.downstream !== undefined && !downstream) {
    throw new Error(`Invalid architecture registry: subsystems[${index}].downstream must be an array of non-empty strings when provided.`);
  }

  return { name, purpose, commands, artifacts, upstream, downstream };
};

export const loadArchitecture = (repoRoot: string): ArchitectureRegistry => {
  const registryPath = path.join(repoRoot, ARCHITECTURE_REGISTRY_PATH);
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Architecture registry not found at ${ARCHITECTURE_REGISTRY_PATH}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse architecture registry at ${ARCHITECTURE_REGISTRY_PATH}: ${message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid architecture registry: expected a JSON object.');
  }

  const candidate = parsed as Record<string, unknown>;
  const version = candidate.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('Invalid architecture registry: version must be a positive integer.');
  }

  if (!Array.isArray(candidate.subsystems)) {
    throw new Error('Invalid architecture registry: subsystems must be an array.');
  }

  const subsystems = candidate.subsystems.map((subsystem, index) => parseSubsystem(subsystem, index));

  return {
    version,
    subsystems
  };
};

export { ARCHITECTURE_REGISTRY_PATH };
