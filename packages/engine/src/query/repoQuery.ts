import fs from 'node:fs';
import path from 'node:path';
import type {
  RepositoryIndex,
  RepositoryModule,
  RepositoryDependencyEdge,
  RepositoryWorkspaceNode,
  RepositoryTestCoverage,
  RepositoryConfigEntry
} from '../indexer/repoIndexer.js';
import { readRepositoryGraph, summarizeGraphNeighborhood, type GraphNeighborhoodSummary } from '../graph/repoGraph.js';
import { readJsonArtifact } from '../artifacts/artifactIO.js';
import { readRuntimeMemoryEnvelope, type RuntimeMemoryEnvelope } from '../intelligence/runtimeMemory.js';
import {
  expandMemoryProvenance,
  lookupMemoryCandidateKnowledge,
  lookupPromotedMemoryKnowledge,
  type ExpandedMemoryProvenance
} from '../memory/inspection.js';

export const SUPPORTED_QUERY_FIELDS = [
  'architecture',
  'framework',
  'language',
  'modules',
  'dependencies',
  'workspace',
  'tests',
  'configs',
  'database',
  'rules'
] as const;

export type RepositoryQueryField = (typeof SUPPORTED_QUERY_FIELDS)[number];

export type RepositoryQueryResult = {
  field: RepositoryQueryField;
  result: string | string[] | RepositoryModule[] | RepositoryDependencyEdge[] | RepositoryWorkspaceNode[] | RepositoryTestCoverage[] | RepositoryConfigEntry[];
  graphNeighborhood?: GraphNeighborhoodSummary;
  memorySummary?: RuntimeMemoryEnvelope['memorySummary'];
  memorySources?: RuntimeMemoryEnvelope['memorySources'];
  knowledgeHits?: RuntimeMemoryEnvelope['knowledgeHits'];
  recentRelevantEvents?: RuntimeMemoryEnvelope['recentRelevantEvents'];
  memoryKnowledge?: MemoryKnowledgeResult[];
};

type MemoryKnowledgeResult = {
  source: 'promoted' | 'candidate';
  knowledgeId?: string;
  candidateId: string;
  kind: string;
  title: string;
  summary: string;
  module: string;
  ruleId: string;
  failureShape: string;
  provenance: ExpandedMemoryProvenance[];
};

type QueryRepositoryIndexOptions = {
  withMemory?: boolean;
};

const INDEX_RELATIVE_PATH = '.playbook/repo-index.json' as const;
const SUPPORTED_FIELDS_MESSAGE = SUPPORTED_QUERY_FIELDS.join(', ');

const isRepositoryQueryField = (field: string): field is RepositoryQueryField =>
  SUPPORTED_QUERY_FIELDS.includes(field as RepositoryQueryField);

const normalizeRepositoryQueryField = (input: string): RepositoryQueryField | null => {
  if (isRepositoryQueryField(input)) {
    return input;
  }

  const aliases: Record<string, RepositoryQueryField> = {
    deps: 'dependencies'
  };

  if (aliases[input.toLowerCase()]) {
    return aliases[input.toLowerCase()];
  }

  const normalizedTokens = input
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length > 0);

  const matches = SUPPORTED_QUERY_FIELDS.filter((field) => normalizedTokens.includes(field));
  if (matches.length === 1) {
    return matches[0];
  }

  return null;
};

const readRepositoryIndex = (projectRoot: string): RepositoryIndex => {
  const indexPath = path.join(projectRoot, INDEX_RELATIVE_PATH);
  if (!fs.existsSync(indexPath)) {
    throw new Error('playbook query: missing repository index at .playbook/repo-index.json. Run "playbook index" first.');
  }

  const parsed = readJsonArtifact<Partial<RepositoryIndex>>(indexPath);

  if (parsed.schemaVersion !== '1.0') {
    throw new Error(
      `playbook query: unsupported repository index schemaVersion "${String(parsed.schemaVersion)}". Expected "1.0".`
    );
  }

  return parsed as RepositoryIndex;
};

const readGraphNeighborhood = (projectRoot: string, nodeId: string): GraphNeighborhoodSummary | undefined => {
  try {
    const graph = readRepositoryGraph(projectRoot);
    return summarizeGraphNeighborhood(graph, nodeId) ?? undefined;
  } catch {
    return undefined;
  }
};

const normalizeTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

const scoreMemoryRelevance = (tokens: string[], values: string[]): number => {
  if (tokens.length === 0) {
    return 0;
  }

  const haystack = values.join(' ').toLowerCase();
  return tokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
};

const buildMemoryKnowledge = (projectRoot: string, resolvedField: RepositoryQueryField, result: RepositoryQueryResult['result']): MemoryKnowledgeResult[] => {
  const tokens = normalizeTokens([resolvedField, JSON.stringify(result)].join(' '));

  const promoted = lookupPromotedMemoryKnowledge(projectRoot)
    .map((entry) => ({
      source: 'promoted' as const,
      knowledgeId: entry.knowledgeId,
      candidateId: entry.candidateId,
      kind: entry.kind,
      title: entry.title,
      summary: entry.summary,
      module: entry.module,
      ruleId: entry.ruleId,
      failureShape: entry.failureShape,
      provenance: expandMemoryProvenance(projectRoot, entry.provenance),
      relevance: scoreMemoryRelevance(tokens, [entry.title, entry.summary, entry.module, entry.ruleId, entry.failureShape])
    }))
    .filter((entry) => tokens.length === 0 || entry.relevance > 0);

  const promotedCandidateIds = new Set(promoted.map((entry) => entry.candidateId));

  const candidates = lookupMemoryCandidateKnowledge(projectRoot)
    .filter((entry) => !promotedCandidateIds.has(entry.candidateId))
    .map((entry) => ({
      source: 'candidate' as const,
      candidateId: entry.candidateId,
      kind: entry.kind,
      title: entry.title,
      summary: entry.summary,
      module: entry.module,
      ruleId: entry.ruleId,
      failureShape: entry.failureShape,
      provenance: expandMemoryProvenance(projectRoot, entry.provenance),
      relevance: scoreMemoryRelevance(tokens, [entry.title, entry.summary, entry.module, entry.ruleId, entry.failureShape])
    }))
    .filter((entry) => tokens.length === 0 || entry.relevance > 0);

  return [...promoted, ...candidates]
    .sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === 'promoted' ? -1 : 1;
      }
      return right.relevance - left.relevance || left.candidateId.localeCompare(right.candidateId);
    })
    .slice(0, 10)
    .map(({ relevance: _relevance, ...entry }) => entry);
};

export const queryRepositoryIndex = (projectRoot: string, field: string, options?: QueryRepositoryIndexOptions): RepositoryQueryResult => {
  const resolvedField = normalizeRepositoryQueryField(field);
  if (!resolvedField) {
    throw new Error(`playbook query: unsupported field "${field}". Supported fields: ${SUPPORTED_FIELDS_MESSAGE}.`);
  }

  const index = readRepositoryIndex(projectRoot);
  const queryResult: RepositoryQueryResult = {
    field: resolvedField,
    result: index[resolvedField]
  };

  if (resolvedField === 'architecture') {
    queryResult.graphNeighborhood = readGraphNeighborhood(projectRoot, 'repository:root');
  }

  if (options?.withMemory) {
    const memory = readRuntimeMemoryEnvelope(projectRoot, { target: resolvedField });
    queryResult.memorySummary = memory.memorySummary;
    queryResult.memorySources = memory.memorySources;
    queryResult.knowledgeHits = memory.knowledgeHits;
    queryResult.recentRelevantEvents = memory.recentRelevantEvents;
    queryResult.memoryKnowledge = buildMemoryKnowledge(projectRoot, resolvedField, queryResult.result);
  }

  return queryResult;
};
