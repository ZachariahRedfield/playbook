import fs from 'node:fs';
import path from 'node:path';
import { readJsonArtifact } from '../artifacts/artifactIO.js';
import {
  PATTERN_KNOWLEDGE_GRAPH_SCHEMA_VERSION,
  type PatternKnowledgeGraphArtifact,
  type PatternKnowledgeInstance,
  type PatternKnowledgeLayer,
  type PatternKnowledgePattern,
  type PatternKnowledgeRelation
} from '../schema/patternKnowledgeGraph.js';

const PATTERN_KNOWLEDGE_GRAPH_RELATIVE_PATH = '.playbook/pattern-knowledge-graph.json' as const;

const queryError = (reason: string): Error =>
  new Error(
    `playbook query pattern-graph: ${reason} (${PATTERN_KNOWLEDGE_GRAPH_RELATIVE_PATH})`
  );

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isLayer = (value: unknown): value is PatternKnowledgeLayer =>
  value === 'signal' || value === 'mechanism' || value === 'governance' || value === 'outcome';

const validatePattern = (value: unknown): value is PatternKnowledgePattern => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.patternId === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.summary === 'string' &&
    isLayer(candidate.layer) &&
    typeof candidate.mechanism === 'string' &&
    isStringArray(candidate.evidenceRefs)
  );
};

const validateRelation = (value: unknown): value is PatternKnowledgeRelation => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.relationId === 'string' &&
    typeof candidate.fromPatternId === 'string' &&
    typeof candidate.toPatternId === 'string' &&
    (candidate.relationType === 'depends_on' ||
      candidate.relationType === 'enables' ||
      candidate.relationType === 'supersedes' ||
      candidate.relationType === 'related_to') &&
    isStringArray(candidate.evidenceRefs)
  );
};

const validateInstance = (value: unknown): value is PatternKnowledgeInstance => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.instanceId === 'string' &&
    typeof candidate.patternId === 'string' &&
    typeof candidate.sourceArtifactPath === 'string' &&
    isStringArray(candidate.evidenceRefs)
  );
};

const sortPatterns = (patterns: PatternKnowledgePattern[]): PatternKnowledgePattern[] =>
  [...patterns].sort((left, right) => left.patternId.localeCompare(right.patternId));

const sortRelations = (relations: PatternKnowledgeRelation[]): PatternKnowledgeRelation[] =>
  [...relations].sort(
    (left, right) =>
      left.fromPatternId.localeCompare(right.fromPatternId) ||
      left.toPatternId.localeCompare(right.toPatternId) ||
      left.relationType.localeCompare(right.relationType) ||
      left.relationId.localeCompare(right.relationId)
  );

const sortInstances = (instances: PatternKnowledgeInstance[]): PatternKnowledgeInstance[] =>
  [...instances].sort(
    (left, right) =>
      left.patternId.localeCompare(right.patternId) || left.instanceId.localeCompare(right.instanceId)
  );

export const readPatternKnowledgeGraphArtifact = (repoRoot: string): PatternKnowledgeGraphArtifact => {
  const artifactPath = path.join(repoRoot, PATTERN_KNOWLEDGE_GRAPH_RELATIVE_PATH);
  if (!fs.existsSync(artifactPath)) {
    throw queryError('missing artifact. Generate deterministic pattern knowledge graph artifacts first');
  }

  let parsed: unknown;
  try {
    parsed = readJsonArtifact<Record<string, unknown>>(artifactPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw queryError(`invalid artifact payload: ${message}`);
  }

  const candidate = parsed as Partial<PatternKnowledgeGraphArtifact>;

  if (candidate.kind !== 'playbook-pattern-knowledge-graph') {
    throw queryError('invalid artifact kind; expected "playbook-pattern-knowledge-graph"');
  }

  if (candidate.schemaVersion !== PATTERN_KNOWLEDGE_GRAPH_SCHEMA_VERSION) {
    throw queryError(
      `unsupported schemaVersion "${String(candidate.schemaVersion)}"; expected "${PATTERN_KNOWLEDGE_GRAPH_SCHEMA_VERSION}"`
    );
  }

  if (!Array.isArray(candidate.patterns) || !candidate.patterns.every((entry) => validatePattern(entry))) {
    throw queryError('invalid patterns payload');
  }

  if (!Array.isArray(candidate.relations) || !candidate.relations.every((entry) => validateRelation(entry))) {
    throw queryError('invalid relations payload');
  }

  if (!Array.isArray(candidate.instances) || !candidate.instances.every((entry) => validateInstance(entry))) {
    throw queryError('invalid instances payload');
  }

  return {
    schemaVersion: PATTERN_KNOWLEDGE_GRAPH_SCHEMA_VERSION,
    kind: 'playbook-pattern-knowledge-graph',
    createdAt: candidate.createdAt ?? '',
    patterns: sortPatterns(candidate.patterns),
    relations: sortRelations(candidate.relations),
    instances: sortInstances(candidate.instances)
  };
};

export const listPatternKnowledgePatterns = (
  repoRoot: string,
  filters: { layer?: PatternKnowledgeLayer; mechanism?: string } = {}
): PatternKnowledgePattern[] => {
  const artifact = readPatternKnowledgeGraphArtifact(repoRoot);
  return artifact.patterns.filter((pattern) => {
    if (filters.layer && pattern.layer !== filters.layer) return false;
    if (filters.mechanism && pattern.mechanism !== filters.mechanism) return false;
    return true;
  });
};

export const getPatternKnowledgePatternById = (repoRoot: string, patternId: string): PatternKnowledgePattern | null => {
  const artifact = readPatternKnowledgeGraphArtifact(repoRoot);
  return artifact.patterns.find((pattern) => pattern.patternId === patternId) ?? null;
};

export const listPatternKnowledgeRelatedPatterns = (repoRoot: string, patternId: string): PatternKnowledgePattern[] => {
  const artifact = readPatternKnowledgeGraphArtifact(repoRoot);
  const relatedIds = new Set<string>();

  for (const relation of artifact.relations) {
    if (relation.fromPatternId === patternId) {
      relatedIds.add(relation.toPatternId);
    }
    if (relation.toPatternId === patternId) {
      relatedIds.add(relation.fromPatternId);
    }
  }

  return artifact.patterns.filter((pattern) => relatedIds.has(pattern.patternId));
};

export const listPatternKnowledgeInstances = (repoRoot: string, patternId: string): PatternKnowledgeInstance[] => {
  const artifact = readPatternKnowledgeGraphArtifact(repoRoot);
  return artifact.instances.filter((instance) => instance.patternId === patternId);
};

export const listPatternKnowledgeEvidence = (repoRoot: string, patternId: string): string[] => {
  const artifact = readPatternKnowledgeGraphArtifact(repoRoot);
  const evidence = new Set<string>();

  artifact.patterns
    .filter((pattern) => pattern.patternId === patternId)
    .forEach((pattern) => pattern.evidenceRefs.forEach((entry) => evidence.add(entry)));

  artifact.instances
    .filter((instance) => instance.patternId === patternId)
    .forEach((instance) => instance.evidenceRefs.forEach((entry) => evidence.add(entry)));

  artifact.relations
    .filter((relation) => relation.fromPatternId === patternId || relation.toPatternId === patternId)
    .forEach((relation) => relation.evidenceRefs.forEach((entry) => evidence.add(entry)));

  return [...evidence].sort((left, right) => left.localeCompare(right));
};

export { PATTERN_KNOWLEDGE_GRAPH_RELATIVE_PATH };
