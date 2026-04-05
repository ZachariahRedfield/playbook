import path from 'node:path';
import type { GraphInformedLearningArtifact, GraphInformedLearningCluster } from './graphInformedLearning.js';
import type { LearningClustersArtifact, LearningClusterRow } from './learningClusters.js';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';

export const HIGHER_ORDER_SYNTHESIS_SCHEMA_VERSION = '1.0' as const;
export const HIGHER_ORDER_SYNTHESIS_RELATIVE_PATH = '.playbook/higher-order-synthesis.json' as const;

const LEARNING_CLUSTERS_PATH = '.playbook/learning-clusters.json' as const;
const GRAPH_INFORMED_LEARNING_PATH = '.playbook/graph-informed-learning.json' as const;
const DEFAULT_ISO = new Date(0).toISOString();

export type HigherOrderSynthesisProposal = {
  synthesisProposalId: string;
  contributingClusterIds: string[];
  contributingGraphInformedRefs: string[];
  proposedGeneralizedAbstraction: string;
  rationale: string;
  confidence: number;
  provenanceRefs: string[];
  reviewRequired: true;
  nextActionText: string;
};

export type HigherOrderSynthesisArtifact = {
  schemaVersion: typeof HIGHER_ORDER_SYNTHESIS_SCHEMA_VERSION;
  kind: 'higher-order-synthesis';
  generatedAt: string;
  proposalOnly: true;
  reviewOnly: true;
  sourceArtifacts: string[];
  synthesisProposals: HigherOrderSynthesisProposal[];
};

type SynthesisGroupKey = `${LearningClusterRow['dimension']}::${LearningClusterRow['suggestedImprovementCandidateType']}`;

type SynthesisGroup = {
  dimension: LearningClusterRow['dimension'];
  candidateType: LearningClusterRow['suggestedImprovementCandidateType'];
  clusters: LearningClusterRow[];
  graphRows: GraphInformedLearningCluster[];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round4 = (value: number): number => Number(value.toFixed(4));
const stableUniqueSorted = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))].sort((a, b) =>
    a.localeCompare(b)
  );

const readSynthesisInputs = (repoRoot: string): {
  learningClusters?: LearningClustersArtifact;
  graphInformed?: GraphInformedLearningArtifact;
} => ({
  learningClusters: readJsonIfExists<LearningClustersArtifact>(path.join(repoRoot, LEARNING_CLUSTERS_PATH)),
  graphInformed: readJsonIfExists<GraphInformedLearningArtifact>(path.join(repoRoot, GRAPH_INFORMED_LEARNING_PATH))
});

const rankDimension = (dimension: LearningClusterRow['dimension']): number => {
  switch (dimension) {
    case 'repeated_failure_shape':
      return 0;
    case 'repeated_remediation_outcome':
      return 1;
    case 'repeated_query_usage_pattern':
      return 2;
    case 'repeated_governance_blocker':
      return 3;
    default:
      return 4;
  }
};

const summarizeAbstraction = (group: SynthesisGroup): string => {
  const moduleCounts = new Map<string, number>();
  for (const row of group.graphRows) {
    for (const moduleName of row.relatedModules) {
      moduleCounts.set(moduleName, (moduleCounts.get(moduleName) ?? 0) + 1);
    }
  }

  const dominantModules = [...moduleCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([name]) => name);

  const moduleSuffix = dominantModules.length > 0
    ? ` across modules ${dominantModules.join(', ')}`
    : ' across mixed module context';

  return `Generalize ${group.dimension} signals into ${group.candidateType} candidate guidance${moduleSuffix}, preserving proposal-only governance.`;
};

const buildRationale = (group: SynthesisGroup): string => {
  const clusterCount = group.clusters.length;
  const governanceRules = stableUniqueSorted(group.graphRows.flatMap((row) => row.sharedGovernanceRuleSurfaces));
  const governanceSuffix = governanceRules.length > 0
    ? ` Shared governance surfaces: ${governanceRules.slice(0, 4).join(', ')}.`
    : ' No concentrated shared governance surface was detected.';
  return `Higher-order synthesis grouped ${clusterCount} repeated-signal clusters under ${group.dimension} + ${group.candidateType} to propose a review-only abstraction.${governanceSuffix}`;
};

export const buildHigherOrderSynthesisArtifact = (repoRoot: string): HigherOrderSynthesisArtifact => {
  const { learningClusters, graphInformed } = readSynthesisInputs(repoRoot);

  const clusterRows = [...(learningClusters?.clusters ?? [])].sort((left, right) =>
    left.dimension.localeCompare(right.dimension) ||
    left.suggestedImprovementCandidateType.localeCompare(right.suggestedImprovementCandidateType) ||
    left.clusterId.localeCompare(right.clusterId)
  );

  const graphByCluster = new Map<string, GraphInformedLearningCluster>(
    (graphInformed?.clusters ?? []).map((cluster) => [cluster.clusterId, cluster])
  );

  const groups = new Map<SynthesisGroupKey, SynthesisGroup>();

  for (const cluster of clusterRows) {
    const key: SynthesisGroupKey = `${cluster.dimension}::${cluster.suggestedImprovementCandidateType}`;
    const group = groups.get(key) ?? {
      dimension: cluster.dimension,
      candidateType: cluster.suggestedImprovementCandidateType,
      clusters: [],
      graphRows: []
    };

    group.clusters.push(cluster);
    const graphRow = graphByCluster.get(cluster.clusterId);
    if (graphRow) {
      group.graphRows.push(graphRow);
    }
    groups.set(key, group);
  }

  const synthesisProposals: HigherOrderSynthesisProposal[] = [...groups.values()]
    .filter((group) => group.clusters.length >= 2)
    .map((group) => {
      const contributingClusterIds = stableUniqueSorted(group.clusters.map((cluster) => cluster.clusterId));
      const contributingGraphInformedRefs = stableUniqueSorted(
        contributingClusterIds.map((clusterId) =>
          graphByCluster.has(clusterId) ? `${GRAPH_INFORMED_LEARNING_PATH}#clusterId=${clusterId}` : null
        )
      );

      const clusterConfidence =
        group.clusters.reduce((sum, cluster) => sum + cluster.confidence, 0) / Math.max(1, group.clusters.length);
      const graphConfidence =
        group.graphRows.reduce((sum, row) => sum + row.structuralConcentration.governanceCoverageRatio, 0) /
        Math.max(1, group.graphRows.length || 1);

      const confidence = round4(clamp01(clusterConfidence * 0.75 + graphConfidence * 0.25));
      const proposedGeneralizedAbstraction = summarizeAbstraction(group);
      const rationale = buildRationale(group);
      const provenanceRefs = stableUniqueSorted([
        ...group.clusters.flatMap((cluster) => cluster.sourceEvidenceRefs),
        ...contributingClusterIds.map((clusterId) => `${LEARNING_CLUSTERS_PATH}#clusterId=${clusterId}`),
        ...contributingGraphInformedRefs
      ]);

      return {
        synthesisProposalId: `synthesis:${group.dimension}:${group.candidateType}`,
        contributingClusterIds,
        contributingGraphInformedRefs,
        proposedGeneralizedAbstraction,
        rationale,
        confidence,
        provenanceRefs,
        reviewRequired: true as const,
        nextActionText:
          'Route this synthesis proposal through explicit human-reviewed promotion; do not mutate rules, doctrine, or enforcement automatically.'
      };
    })
    .sort((left, right) => {
      const [leftDimension, leftType] = left.synthesisProposalId.replace(/^synthesis:/, '').split(':', 2);
      const [rightDimension, rightType] = right.synthesisProposalId.replace(/^synthesis:/, '').split(':', 2);
      return (
        rankDimension(leftDimension as LearningClusterRow['dimension']) -
          rankDimension(rightDimension as LearningClusterRow['dimension']) ||
        leftType.localeCompare(rightType) ||
        left.synthesisProposalId.localeCompare(right.synthesisProposalId)
      );
    });

  return {
    schemaVersion: HIGHER_ORDER_SYNTHESIS_SCHEMA_VERSION,
    kind: 'higher-order-synthesis',
    generatedAt: stableUniqueSorted([learningClusters?.generatedAt, graphInformed?.generatedAt]).slice(-1)[0] ?? DEFAULT_ISO,
    proposalOnly: true,
    reviewOnly: true,
    sourceArtifacts: stableUniqueSorted([
      learningClusters ? LEARNING_CLUSTERS_PATH : null,
      graphInformed ? GRAPH_INFORMED_LEARNING_PATH : null
    ]),
    synthesisProposals
  };
};

export const writeHigherOrderSynthesisArtifact = (
  repoRoot: string,
  artifact: HigherOrderSynthesisArtifact,
  artifactPath = HIGHER_ORDER_SYNTHESIS_RELATIVE_PATH
): string => {
  const resolvedPath = path.resolve(repoRoot, artifactPath);
  writeDeterministicJsonAtomic(resolvedPath, artifact);
  return resolvedPath;
};

export const buildAndWriteHigherOrderSynthesisArtifact = (
  repoRoot: string
): { artifact: HigherOrderSynthesisArtifact; artifactPath: string } => {
  const artifact = buildHigherOrderSynthesisArtifact(repoRoot);
  const artifactPath = writeHigherOrderSynthesisArtifact(repoRoot, artifact);
  return { artifact, artifactPath };
};
