import path from 'node:path';
import type { RepositoryIndex } from '../indexer/repoIndexer.js';
import type { RepositoryGraph } from '../graph/repoGraph.js';
import type { LearningClusterDimension, LearningClustersArtifact, LearningClusterRow } from './learningClusters.js';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';

export const GRAPH_INFORMED_LEARNING_SCHEMA_VERSION = '1.0' as const;
export const GRAPH_INFORMED_LEARNING_RELATIVE_PATH = '.playbook/graph-informed-learning.json' as const;

const REPO_GRAPH_PATH = '.playbook/repo-graph.json' as const;
const REPO_INDEX_PATH = '.playbook/repo-index.json' as const;
const LEARNING_CLUSTERS_PATH = '.playbook/learning-clusters.json' as const;
const DEFAULT_ISO = new Date(0).toISOString();

type StructuralConcentrationClass = 'concentrated' | 'balanced' | 'spread';

export type GraphInformedLearningCluster = {
  clusterId: string;
  dimension: LearningClusterDimension;
  relatedModules: string[];
  dependencyNeighborhoodSummary: {
    directDependencies: number;
    directDependents: number;
    adjacentModuleCount: number;
    dependencyEdgesWithinNeighborhood: number;
  };
  sharedGovernanceRuleSurfaces: string[];
  structuralConcentration: {
    moduleCoverageRatio: number;
    neighborhoodSpreadRatio: number;
    governanceCoverageRatio: number;
    classification: StructuralConcentrationClass;
  };
  graphInformedRationale: string;
  learningCluster: LearningClusterRow;
};

export type GraphInformedLearningArtifact = {
  schemaVersion: typeof GRAPH_INFORMED_LEARNING_SCHEMA_VERSION;
  kind: 'graph-informed-learning';
  generatedAt: string;
  proposalOnly: true;
  reviewOnly: true;
  sourceArtifacts: string[];
  clusters: GraphInformedLearningCluster[];
};

const stableUniqueSorted = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))].sort((a, b) => a.localeCompare(b));
const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toLowerText = (cluster: LearningClusterRow): string =>
  [cluster.repeatedSignalSummary, cluster.nextActionText, ...cluster.sourceEvidenceRefs].join(' ').toLowerCase();

const readGraphInputs = (repoRoot: string): {
  graph?: RepositoryGraph;
  index?: RepositoryIndex;
  learningClusters?: LearningClustersArtifact;
} => ({
  graph: readJsonIfExists<RepositoryGraph>(path.join(repoRoot, REPO_GRAPH_PATH)),
  index: readJsonIfExists<RepositoryIndex>(path.join(repoRoot, REPO_INDEX_PATH)),
  learningClusters: readJsonIfExists<LearningClustersArtifact>(path.join(repoRoot, LEARNING_CLUSTERS_PATH))
});

const classifyConcentration = (moduleCoverageRatio: number, neighborhoodSpreadRatio: number): StructuralConcentrationClass => {
  if (moduleCoverageRatio <= 0.2 && neighborhoodSpreadRatio <= 0.35) {
    return 'concentrated';
  }
  if (moduleCoverageRatio >= 0.6 || neighborhoodSpreadRatio >= 0.75) {
    return 'spread';
  }
  return 'balanced';
};

const buildRationale = (cluster: LearningClusterRow, relatedModules: string[], classification: StructuralConcentrationClass): string => {
  const moduleSummary = relatedModules.length > 0
    ? `${relatedModules.length} related module(s): ${relatedModules.join(', ')}`
    : 'no directly matched modules';
  return `Graph context for ${cluster.clusterId} indicates ${moduleSummary}; structural footprint is ${classification} and remains proposal-only for explicit review.`;
};

export const buildGraphInformedLearningArtifact = (repoRoot: string): GraphInformedLearningArtifact => {
  const { graph, index, learningClusters } = readGraphInputs(repoRoot);
  const clusters = learningClusters?.clusters ?? [];

  const moduleNames = stableUniqueSorted(index?.modules.map((entry) => entry.name) ?? []);
  const ruleNames = stableUniqueSorted(index?.rules ?? []);

  const outgoingDependenciesByModule = new Map<string, Set<string>>();
  const incomingDependentsByModule = new Map<string, Set<string>>();
  const governanceByModule = new Map<string, Set<string>>();

  for (const moduleName of moduleNames) {
    outgoingDependenciesByModule.set(moduleName, new Set());
    incomingDependentsByModule.set(moduleName, new Set());
    governanceByModule.set(moduleName, new Set());
  }

  for (const edge of graph?.edges ?? []) {
    if (edge.kind === 'depends_on' && edge.from.startsWith('module:') && edge.to.startsWith('module:')) {
      const fromModule = edge.from.slice('module:'.length);
      const toModule = edge.to.slice('module:'.length);
      outgoingDependenciesByModule.get(fromModule)?.add(toModule);
      incomingDependentsByModule.get(toModule)?.add(fromModule);
    }

    if (edge.kind === 'governed_by' && edge.from.startsWith('module:') && edge.to.startsWith('rule:')) {
      const moduleName = edge.from.slice('module:'.length);
      const ruleName = edge.to.slice('rule:'.length);
      governanceByModule.get(moduleName)?.add(ruleName);
    }
  }

  const enrichedClusters: GraphInformedLearningCluster[] = clusters.map((cluster) => {
    const clusterText = toLowerText(cluster);

    const relatedModules = moduleNames.filter((moduleName) => {
      const matcher = new RegExp(`(^|[^a-z0-9])${escapeRegExp(moduleName.toLowerCase())}([^a-z0-9]|$)`);
      return matcher.test(clusterText);
    });

    const fallbackRuleMatches = ruleNames.filter((ruleName) => clusterText.includes(ruleName.toLowerCase()));
    const modulesFromRules = moduleNames.filter((moduleName) =>
      fallbackRuleMatches.some((ruleName) => governanceByModule.get(moduleName)?.has(ruleName))
    );

    const resolvedModules = stableUniqueSorted(relatedModules.length > 0 ? relatedModules : modulesFromRules);

    const directDependencies = new Set<string>();
    const directDependents = new Set<string>();
    const governanceSurfaces = new Set<string>();

    for (const moduleName of resolvedModules) {
      for (const dependency of outgoingDependenciesByModule.get(moduleName) ?? []) {
        directDependencies.add(dependency);
      }
      for (const dependent of incomingDependentsByModule.get(moduleName) ?? []) {
        directDependents.add(dependent);
      }
      for (const rule of governanceByModule.get(moduleName) ?? []) {
        governanceSurfaces.add(rule);
      }
    }

    const neighborhoodModules = new Set<string>([...resolvedModules, ...directDependencies, ...directDependents]);

    let dependencyEdgesWithinNeighborhood = 0;
    for (const moduleName of neighborhoodModules) {
      for (const dependency of outgoingDependenciesByModule.get(moduleName) ?? []) {
        if (neighborhoodModules.has(dependency)) {
          dependencyEdgesWithinNeighborhood += 1;
        }
      }
    }

    const totalModules = Math.max(1, moduleNames.length);
    const totalRules = Math.max(1, ruleNames.length);
    const moduleCoverageRatio = round4(clamp01(resolvedModules.length / totalModules));
    const neighborhoodSpreadRatio = round4(clamp01(neighborhoodModules.size / totalModules));
    const governanceCoverageRatio = round4(clamp01(governanceSurfaces.size / totalRules));
    const classification = classifyConcentration(moduleCoverageRatio, neighborhoodSpreadRatio);

    return {
      clusterId: cluster.clusterId,
      dimension: cluster.dimension,
      relatedModules: resolvedModules,
      dependencyNeighborhoodSummary: {
        directDependencies: directDependencies.size,
        directDependents: directDependents.size,
        adjacentModuleCount: stableUniqueSorted([...directDependencies, ...directDependents]).length,
        dependencyEdgesWithinNeighborhood
      },
      sharedGovernanceRuleSurfaces: stableUniqueSorted([...governanceSurfaces]),
      structuralConcentration: {
        moduleCoverageRatio,
        neighborhoodSpreadRatio,
        governanceCoverageRatio,
        classification
      },
      graphInformedRationale: buildRationale(cluster, resolvedModules, classification),
      learningCluster: cluster
    };
  });

  return {
    schemaVersion: GRAPH_INFORMED_LEARNING_SCHEMA_VERSION,
    kind: 'graph-informed-learning',
    generatedAt: stableUniqueSorted([learningClusters?.generatedAt, graph?.generatedAt]).slice(-1)[0] ?? DEFAULT_ISO,
    proposalOnly: true,
    reviewOnly: true,
    sourceArtifacts: stableUniqueSorted([
      learningClusters ? LEARNING_CLUSTERS_PATH : null,
      graph ? REPO_GRAPH_PATH : null,
      index ? REPO_INDEX_PATH : null
    ]),
    clusters: enrichedClusters.sort((left, right) =>
      left.dimension.localeCompare(right.dimension) ||
      left.clusterId.localeCompare(right.clusterId)
    )
  };
};

export const writeGraphInformedLearningArtifact = (
  repoRoot: string,
  artifact: GraphInformedLearningArtifact,
  artifactPath = GRAPH_INFORMED_LEARNING_RELATIVE_PATH
): string => {
  const resolvedPath = path.resolve(repoRoot, artifactPath);
  writeDeterministicJsonAtomic(resolvedPath, artifact);
  return resolvedPath;
};

export const buildAndWriteGraphInformedLearningArtifact = (repoRoot: string): { artifact: GraphInformedLearningArtifact; artifactPath: string } => {
  const artifact = buildGraphInformedLearningArtifact(repoRoot);
  const artifactPath = writeGraphInformedLearningArtifact(repoRoot, artifact);
  return { artifact, artifactPath };
};
