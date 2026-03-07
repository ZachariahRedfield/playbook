import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryIndex, RepositoryModule } from '../indexer/repoIndexer.js';
import { readRepositoryGraph, summarizeGraphNeighborhood, type GraphNeighborhoodSummary } from '../graph/repoGraph.js';

export const SUPPORTED_QUERY_FIELDS = ['architecture', 'framework', 'language', 'modules', 'database', 'rules'] as const;

export type RepositoryQueryField = (typeof SUPPORTED_QUERY_FIELDS)[number];

export type RepositoryQueryResult = {
  field: RepositoryQueryField;
  result: string | string[] | RepositoryModule[];
  graphNeighborhood?: GraphNeighborhoodSummary;
};

const INDEX_RELATIVE_PATH = '.playbook/repo-index.json' as const;
const SUPPORTED_FIELDS_MESSAGE = SUPPORTED_QUERY_FIELDS.join(', ');

const isRepositoryQueryField = (field: string): field is RepositoryQueryField =>
  SUPPORTED_QUERY_FIELDS.includes(field as RepositoryQueryField);

const normalizeRepositoryQueryField = (input: string): RepositoryQueryField | null => {
  if (isRepositoryQueryField(input)) {
    return input;
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

  const raw = fs.readFileSync(indexPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<RepositoryIndex>;

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

export const queryRepositoryIndex = (projectRoot: string, field: string): RepositoryQueryResult => {
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

  return queryResult;
};
