import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryIndex } from '../indexer/repoIndexer.js';
import { readJsonArtifact } from '../artifacts/artifactIO.js';
import { inferArchitectureRoles, type ArchitectureRoleInferenceSummary } from './architectureRoleInference.js';

export type RepositoryGraphNodeKind = 'module' | 'repository' | 'rule';
export type RepositoryGraphEdgeKind = 'contains' | 'depends_on' | 'governed_by';

export type RepositoryGraphNode = {
  id: string;
  kind: RepositoryGraphNodeKind;
  name: string;
};

export type RepositoryGraphEdge = {
  kind: RepositoryGraphEdgeKind;
  from: string;
  to: string;
};

export const REPOSITORY_GRAPH_SCHEMA_VERSION = '1.1' as const;

export type RepositoryGraph = {
  schemaVersion: typeof REPOSITORY_GRAPH_SCHEMA_VERSION;
  kind: 'playbook-repo-graph';
  generatedAt: string;
  nodes: RepositoryGraphNode[];
  edges: RepositoryGraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    nodeKinds: Partial<Record<RepositoryGraphNodeKind, number>>;
    edgeKinds: Partial<Record<RepositoryGraphEdgeKind, number>>;
  };
};

export type RepositoryGraphSummary = {
  schemaVersion: typeof REPOSITORY_GRAPH_SCHEMA_VERSION;
  kind: 'playbook-repo-graph';
  generatedAt: string;
  stats: {
    nodeCount: number;
    edgeCount: number;
    nodeKinds: Partial<Record<RepositoryGraphNodeKind, number>>;
    edgeKinds: Partial<Record<RepositoryGraphEdgeKind, number>>;
  };
  nodeKinds: RepositoryGraphNodeKind[];
  edgeKinds: RepositoryGraphEdgeKind[];
  topDependencyHubs: Array<{
    module: string;
    incomingDependencies: number;
  }>;
  architectureRoleInference: ArchitectureRoleInferenceSummary;
};

const GRAPH_RELATIVE_PATH = '.playbook/repo-graph.json' as const;
const REPOSITORY_NODE_ID = 'repository:root' as const;

export type GraphNeighborhoodSummary = {
  node: {
    id: string;
    kind: RepositoryGraphNodeKind;
    name: string;
  };
  outgoing: Array<{ kind: RepositoryGraphEdgeKind; target: string }>;
  incoming: Array<{ kind: RepositoryGraphEdgeKind; source: string }>;
};

const toSortedUnique = <T extends string>(values: T[]): T[] => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const toModuleNode = (name: string): RepositoryGraphNode => ({
  id: `module:${name}`,
  kind: 'module',
  name
});

const toRuleNode = (name: string): RepositoryGraphNode => ({
  id: `rule:${name}`,
  kind: 'rule',
  name
});

const toRepositoryNode = (): RepositoryGraphNode => ({
  id: REPOSITORY_NODE_ID,
  kind: 'repository',
  name: 'root'
});

const sortNodes = (nodes: RepositoryGraphNode[]): RepositoryGraphNode[] =>
  [...nodes].sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  );

const sortEdges = (edges: RepositoryGraphEdge[]): RepositoryGraphEdge[] =>
  [...edges].sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.from.localeCompare(right.from) || left.to.localeCompare(right.to)
  );

export const generateRepositoryGraph = (index: RepositoryIndex, generatedAt: Date = new Date()): RepositoryGraph => {
  const moduleNodes = index.modules.map((moduleEntry) => toModuleNode(moduleEntry.name));
  const ruleNodes = index.rules.map((ruleId) => toRuleNode(ruleId));
  const repositoryNode = toRepositoryNode();

  const dependencyEdges = index.modules.flatMap((moduleEntry) =>
    moduleEntry.dependencies.map((dependency) => ({
      kind: 'depends_on' as const,
      from: `module:${moduleEntry.name}`,
      to: `module:${dependency}`
    }))
  );

  const containmentEdges = [
    ...moduleNodes.map((node) => ({ kind: 'contains' as const, from: repositoryNode.id, to: node.id })),
    ...ruleNodes.map((node) => ({ kind: 'contains' as const, from: repositoryNode.id, to: node.id }))
  ];

  const governanceEdges = index.modules.flatMap((moduleEntry) =>
    index.rules.map((ruleId) => ({
      kind: 'governed_by' as const,
      from: `module:${moduleEntry.name}`,
      to: `rule:${ruleId}`
    }))
  );

  const nodes = sortNodes([repositoryNode, ...moduleNodes, ...ruleNodes]);
  const edges = sortEdges([...containmentEdges, ...dependencyEdges, ...governanceEdges]);
  const nodeKinds = Object.fromEntries(
    toSortedUnique(nodes.map((node) => node.kind)).map((kind) => [kind, nodes.filter((node) => node.kind === kind).length])
  ) as Partial<Record<RepositoryGraphNodeKind, number>>;
  const edgeKinds = Object.fromEntries(
    toSortedUnique(edges.map((edge) => edge.kind)).map((kind) => [kind, edges.filter((edge) => edge.kind === kind).length])
  ) as Partial<Record<RepositoryGraphEdgeKind, number>>;

  return {
    schemaVersion: REPOSITORY_GRAPH_SCHEMA_VERSION,
    kind: 'playbook-repo-graph',
    generatedAt: generatedAt.toISOString(),
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeKinds,
      edgeKinds
    }
  };
};

export const readRepositoryGraph = (projectRoot: string): RepositoryGraph => {
  const graphPath = path.join(projectRoot, GRAPH_RELATIVE_PATH);
  if (!fs.existsSync(graphPath)) {
    throw new Error('playbook graph: missing repository graph at .playbook/repo-graph.json. Run "playbook index" first.');
  }

  const parsed = readJsonArtifact<Partial<RepositoryGraph>>(graphPath);
  if (parsed.kind !== 'playbook-repo-graph') {
    throw new Error('playbook graph: invalid graph artifact kind in .playbook/repo-graph.json. Run "playbook index" to regenerate.');
  }

  if (parsed.schemaVersion !== REPOSITORY_GRAPH_SCHEMA_VERSION) {
    throw new Error(
      `playbook graph: unsupported repository graph schemaVersion "${String(parsed.schemaVersion)}". Expected "${REPOSITORY_GRAPH_SCHEMA_VERSION}". Run "playbook index" to regenerate.`
    );
  }

  return parsed as RepositoryGraph;
};

export const summarizeRepositoryGraph = (graph: RepositoryGraph): RepositoryGraphSummary => {
  const incomingCountByModule = new Map<string, number>();

  for (const node of graph.nodes) {
    if (node.kind === 'module') {
      incomingCountByModule.set(node.name, 0);
    }
  }

  for (const edge of graph.edges) {
    if (edge.kind !== 'depends_on' || !edge.to.startsWith('module:')) {
      continue;
    }

    const moduleName = edge.to.slice('module:'.length);
    incomingCountByModule.set(moduleName, (incomingCountByModule.get(moduleName) ?? 0) + 1);
  }

  const topDependencyHubs = Array.from(incomingCountByModule.entries())
    .map(([module, incomingDependencies]) => ({ module, incomingDependencies }))
    .sort((left, right) => right.incomingDependencies - left.incomingDependencies || left.module.localeCompare(right.module))
    .slice(0, 5);

  const canonicalStats: RepositoryGraphSummary['stats'] = {
    nodeCount: graph.stats.nodeCount,
    edgeCount: graph.stats.edgeCount,
    nodeKinds: graph.stats.nodeKinds,
    edgeKinds: graph.stats.edgeKinds
  };

  return {
    schemaVersion: graph.schemaVersion,
    kind: graph.kind,
    generatedAt: graph.generatedAt,
    stats: canonicalStats,
    nodeKinds: toSortedUnique(graph.nodes.map((node) => node.kind)),
    edgeKinds: toSortedUnique(graph.edges.map((edge) => edge.kind)),
    topDependencyHubs,
    architectureRoleInference: inferArchitectureRoles(graph)
  };
};

const findNodeById = (graph: RepositoryGraph, nodeId: string): RepositoryGraphNode | null =>
  graph.nodes.find((node) => node.id === nodeId) ?? null;

export const summarizeGraphNeighborhood = (graph: RepositoryGraph, nodeId: string): GraphNeighborhoodSummary | null => {
  const node = findNodeById(graph, nodeId);
  if (!node) {
    return null;
  }

  const toLabel = (id: string): string => {
    const resolved = findNodeById(graph, id);
    return resolved ? `${resolved.kind}:${resolved.name}` : id;
  };

  const outgoing = graph.edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => ({ kind: edge.kind, target: toLabel(edge.to) }))
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.target.localeCompare(right.target));

  const incoming = graph.edges
    .filter((edge) => edge.to === node.id)
    .map((edge) => ({ kind: edge.kind, source: toLabel(edge.from) }))
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.source.localeCompare(right.source));

  return {
    node: {
      id: node.id,
      kind: node.kind,
      name: node.name
    },
    outgoing,
    incoming
  };
};

export const REPOSITORY_GRAPH_RELATIVE_PATH = GRAPH_RELATIVE_PATH;
