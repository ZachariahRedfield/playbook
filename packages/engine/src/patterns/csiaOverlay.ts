import fs from 'node:fs';
import path from 'node:path';

export type CsiaPrimitive = 'compute' | 'simulate' | 'interpret' | 'adapt';

export type CsiaBridge = {
  from: CsiaPrimitive;
  to: CsiaPrimitive;
  intent: string;
};

export type CsiaRegime = {
  id: string;
  dominantPrimitive: CsiaPrimitive;
  secondaryPrimitives: CsiaPrimitive[];
  notes?: string;
};

export type CsiaFailureMode = {
  id: string;
  risk: string;
  linkedPrimitives: CsiaPrimitive[];
  mitigation?: string;
};

export type CsiaFrameworkArtifact = {
  schemaVersion: '1.0';
  kind: 'csia-framework';
  primitives: CsiaPrimitive[];
  bridges: CsiaBridge[];
  regimes: CsiaRegime[];
  failureModes: CsiaFailureMode[];
};

type CsiaSchemaPrimitiveShape = {
  enum?: unknown;
};

type CsiaSchemaShape = {
  $defs?: {
    primitive?: CsiaSchemaPrimitiveShape;
  };
};

export const CSIA_SCHEMA_SOURCE = path.join('packages', 'contracts', 'src', 'csia-framework.schema.json');
export const DEFAULT_CSIA_SOURCE = path.join('docs', 'examples', 'csia-framework.mappings.json');

const REQUIRED_TOP_LEVEL_KEYS = ['schemaVersion', 'kind', 'primitives', 'bridges', 'regimes', 'failureModes'] as const;

const parseJsonFile = (absolutePath: string, label: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
  } catch {
    throw new Error(`playbook patterns csia: invalid JSON in ${label}: ${absolutePath}`);
  }
};

const ensureObject = (value: unknown, message: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
};

const readPrimitiveEnumFromSchema = (schema: unknown): CsiaPrimitive[] => {
  const shape = ensureObject(schema, 'playbook patterns csia: invalid CSIA schema shape.') as CsiaSchemaShape;
  const enumValues = shape.$defs?.primitive?.enum;
  if (!Array.isArray(enumValues)) {
    throw new Error('playbook patterns csia: invalid CSIA schema shape: $defs.primitive.enum must be an array.');
  }

  const primitives = enumValues.map((entry) => String(entry)) as CsiaPrimitive[];
  const canonical = ['compute', 'simulate', 'interpret', 'adapt'];
  if (primitives.length !== canonical.length || primitives.some((value, index) => value !== canonical[index])) {
    throw new Error('playbook patterns csia: CSIA schema primitive enum is misaligned with canonical compute/simulate/interpret/adapt ordering.');
  }

  return primitives;
};

const assertTopLevelKeys = (candidate: Record<string, unknown>, sourcePathForOutput: string): void => {
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`playbook patterns csia: missing required field "${key}" in mapping file: ${sourcePathForOutput}`);
    }
  }
};

const assertPrimitive = (value: unknown, fieldName: string, sourcePathForOutput: string, primitives: ReadonlySet<string>): CsiaPrimitive => {
  if (typeof value !== 'string' || !primitives.has(value)) {
    throw new Error(
      `playbook patterns csia: invalid primitive at ${fieldName} in mapping file: ${sourcePathForOutput}. Expected one of compute|simulate|interpret|adapt.`
    );
  }

  return value as CsiaPrimitive;
};

const assertString = (value: unknown, fieldName: string, sourcePathForOutput: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`playbook patterns csia: invalid ${fieldName} in mapping file: ${sourcePathForOutput}. Expected non-empty string.`);
  }

  return value;
};

const assertPrimitiveArray = (
  value: unknown,
  fieldName: string,
  sourcePathForOutput: string,
  primitives: ReadonlySet<string>,
  options: { minItems: number }
): CsiaPrimitive[] => {
  if (!Array.isArray(value) || value.length < options.minItems) {
    throw new Error(`playbook patterns csia: invalid ${fieldName} in mapping file: ${sourcePathForOutput}. Expected array length >= ${options.minItems}.`);
  }

  const result = value.map((entry, index) => assertPrimitive(entry, `${fieldName}[${index}]`, sourcePathForOutput, primitives));
  if (new Set(result).size !== result.length) {
    throw new Error(`playbook patterns csia: invalid ${fieldName} in mapping file: ${sourcePathForOutput}. Values must be unique.`);
  }

  return result;
};

const normalizeRegimes = (
  value: unknown,
  sourcePathForOutput: string,
  primitives: ReadonlySet<string>
): CsiaRegime[] => {
  if (!Array.isArray(value)) {
    throw new Error(`playbook patterns csia: invalid regimes in mapping file: ${sourcePathForOutput}. Expected array.`);
  }

  return value.map((entry, index) => {
    const record = ensureObject(entry, `playbook patterns csia: invalid regimes[${index}] in mapping file: ${sourcePathForOutput}. Expected object.`);
    const id = assertString(record.id, `regimes[${index}].id`, sourcePathForOutput);
    const dominantPrimitive = assertPrimitive(record.dominantPrimitive, `regimes[${index}].dominantPrimitive`, sourcePathForOutput, primitives);
    const secondaryPrimitives = assertPrimitiveArray(record.secondaryPrimitives, `regimes[${index}].secondaryPrimitives`, sourcePathForOutput, primitives, { minItems: 1 });
    const notes = record.notes === undefined ? undefined : assertString(record.notes, `regimes[${index}].notes`, sourcePathForOutput);

    return {
      id,
      dominantPrimitive,
      secondaryPrimitives,
      ...(notes ? { notes } : {})
    };
  });
};

const normalizeBridges = (
  value: unknown,
  sourcePathForOutput: string,
  primitives: ReadonlySet<string>
): CsiaBridge[] => {
  if (!Array.isArray(value)) {
    throw new Error(`playbook patterns csia: invalid bridges in mapping file: ${sourcePathForOutput}. Expected array.`);
  }

  return value.map((entry, index) => {
    const record = ensureObject(entry, `playbook patterns csia: invalid bridges[${index}] in mapping file: ${sourcePathForOutput}. Expected object.`);
    return {
      from: assertPrimitive(record.from, `bridges[${index}].from`, sourcePathForOutput, primitives),
      to: assertPrimitive(record.to, `bridges[${index}].to`, sourcePathForOutput, primitives),
      intent: assertString(record.intent, `bridges[${index}].intent`, sourcePathForOutput)
    };
  });
};

const normalizeFailureModes = (
  value: unknown,
  sourcePathForOutput: string,
  primitives: ReadonlySet<string>
): CsiaFailureMode[] => {
  if (!Array.isArray(value)) {
    throw new Error(`playbook patterns csia: invalid failureModes in mapping file: ${sourcePathForOutput}. Expected array.`);
  }

  return value.map((entry, index) => {
    const record = ensureObject(entry, `playbook patterns csia: invalid failureModes[${index}] in mapping file: ${sourcePathForOutput}. Expected object.`);
    const mitigation = record.mitigation === undefined ? undefined : assertString(record.mitigation, `failureModes[${index}].mitigation`, sourcePathForOutput);

    return {
      id: assertString(record.id, `failureModes[${index}].id`, sourcePathForOutput),
      risk: assertString(record.risk, `failureModes[${index}].risk`, sourcePathForOutput),
      linkedPrimitives: assertPrimitiveArray(record.linkedPrimitives, `failureModes[${index}].linkedPrimitives`, sourcePathForOutput, primitives, { minItems: 1 }),
      ...(mitigation ? { mitigation } : {})
    };
  });
};

const resolveLocalSourcePath = (cwd: string, from: string): { sourcePath: string; sourcePathForOutput: string } => {
  const resolvedPath = path.resolve(cwd, from);
  const relativePath = path.relative(cwd, resolvedPath);

  if (path.isAbsolute(from) || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('playbook patterns csia: --from must be a repository-local relative path.');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`playbook patterns csia: mapping file not found: ${from}`);
  }

  return { sourcePath: resolvedPath, sourcePathForOutput: relativePath || '.' };
};

export const loadValidatedCsiaFramework = (cwd: string, from = DEFAULT_CSIA_SOURCE): { artifact: CsiaFrameworkArtifact; sourcePathForOutput: string } => {
  const schemaPath = path.join(cwd, CSIA_SCHEMA_SOURCE);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`playbook patterns csia: schema file not found: ${CSIA_SCHEMA_SOURCE}`);
  }

  const schema = parseJsonFile(schemaPath, 'CSIA schema file');
  const primitiveEnum = readPrimitiveEnumFromSchema(schema);
  const primitiveSet = new Set(primitiveEnum);

  const { sourcePath, sourcePathForOutput } = resolveLocalSourcePath(cwd, from);
  const parsed = parseJsonFile(sourcePath, 'mapping file');
  const candidate = ensureObject(parsed, `playbook patterns csia: invalid CSIA mapping artifact: ${sourcePathForOutput}`);
  assertTopLevelKeys(candidate, sourcePathForOutput);

  if (candidate.schemaVersion !== '1.0') {
    throw new Error(`playbook patterns csia: invalid schemaVersion in mapping file: ${sourcePathForOutput}. Expected "1.0".`);
  }

  if (candidate.kind !== 'csia-framework') {
    throw new Error(`playbook patterns csia: invalid kind in mapping file: ${sourcePathForOutput}. Expected "csia-framework".`);
  }

  const primitives = assertPrimitiveArray(candidate.primitives, 'primitives', sourcePathForOutput, primitiveSet, { minItems: primitiveEnum.length });
  if (primitives.length !== primitiveEnum.length || primitives.some((value, index) => value !== primitiveEnum[index])) {
    throw new Error(
      `playbook patterns csia: primitives in mapping file are misaligned with schema enum ordering in ${sourcePathForOutput}.`
    );
  }

  return {
    artifact: {
      schemaVersion: '1.0',
      kind: 'csia-framework',
      primitives,
      bridges: normalizeBridges(candidate.bridges, sourcePathForOutput, primitiveSet),
      regimes: normalizeRegimes(candidate.regimes, sourcePathForOutput, primitiveSet),
      failureModes: normalizeFailureModes(candidate.failureModes, sourcePathForOutput, primitiveSet)
    },
    sourcePathForOutput
  };
};
