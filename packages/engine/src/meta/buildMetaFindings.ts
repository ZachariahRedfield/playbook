import type { ContractProposal } from '../schema/contractProposal.js';
import type { CandidatePatternPreviewArtifact, GraphGroupArtifact, GraphSnapshot } from '../schema/graphMemory.js';
import type { MetaFinding, MetaFindingsArtifact } from '../schema/metaFinding.js';
import type { MetaPattern, MetaPatternsArtifact } from '../schema/metaPattern.js';
import type { PatternCardCollectionArtifact } from '../schema/patternCard.js';
import type { PatternCardDraftArtifact } from '../schema/patternCardDraft.js';
import type { PromotionDecisionArtifact } from '../schema/promotionDecision.js';
import type { RunCycle } from '../schema/runCycle.js';

export type MetaAnalysisInput = {
  runCycles: RunCycle[];
  graphSnapshots: GraphSnapshot[];
  groups: GraphGroupArtifact[];
  candidatePatterns: CandidatePatternPreviewArtifact[];
  patternCards: PatternCardCollectionArtifact[];
  draftPatternCards: PatternCardDraftArtifact[];
  promotionDecisions: PromotionDecisionArtifact[];
  contractHistory: ContractProposal[];
  contractVersions: Record<string, unknown>[];
  createdAt?: string;
};

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;
const safeDiv = (num: number, denom: number): number => (denom <= 0 ? 0 : num / denom);
const hoursBetween = (startIso: string, endIso: string): number | undefined => {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return (end - start) / 3_600_000;
};

const toFinding = (finding: Omit<MetaFinding, 'findingId'>): MetaFinding => ({
  findingId: `meta-finding:${finding.type}`,
  ...finding
});

const computeTopologyStats = (input: MetaAnalysisInput): { totalTopologies: number; duplicateTopologies: number; duplicationRate: number } => {
  const topologyCounts = new Map<string, number>();

  for (const artifact of input.patternCards) {
    for (const card of artifact.cards) {
      const topologyKey = JSON.stringify({
        stageCount: card.topology?.stageCount ?? 0,
        dependencyStructure: [...(card.topology?.dependencyStructure ?? [])].sort()
      });
      topologyCounts.set(topologyKey, (topologyCounts.get(topologyKey) ?? 0) + 1);
    }
  }

  const counts = [...topologyCounts.values()];
  const duplicatedCardCount = counts.filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  const duplicateTopologies = counts.filter((count) => count > 1).length;

  return {
    totalTopologies: topologyCounts.size,
    duplicateTopologies,
    duplicationRate: round4(safeDiv(duplicatedCardCount, counts.reduce((sum, count) => sum + count, 0)))
  };
};

export const buildMetaPatterns = (input: MetaAnalysisInput): MetaPatternsArtifact => {
  const patterns = new Map<string, MetaPattern>();

  for (const artifact of input.patternCards) {
    for (const card of artifact.cards) {
      const key = card.canonicalKey;
      const existing = patterns.get(key);
      const isRejected = card.state === 'rejected';
      const promoted = card.state === 'promoted' || card.state === 'superseded';
      const firstSeenAt = existing?.firstSeenAt ? (existing.firstSeenAt < card.createdAt ? existing.firstSeenAt : card.createdAt) : card.createdAt;
      const lastSeenAt = existing?.lastSeenAt ? (existing.lastSeenAt > card.updatedAt ? existing.lastSeenAt : card.updatedAt) : card.updatedAt;

      patterns.set(key, {
        patternId: existing?.patternId ?? card.patternId,
        canonicalKey: key,
        occurrences: (existing?.occurrences ?? 0) + 1,
        promotedCount: (existing?.promotedCount ?? 0) + (promoted ? 1 : 0),
        rejectedCount: (existing?.rejectedCount ?? 0) + (isRejected ? 1 : 0),
        firstSeenAt,
        lastSeenAt,
        linkedContractRefs: Array.from(new Set([...(existing?.linkedContractRefs ?? []), ...card.linkedContractRefs])).sort(),
        sourceArtifactRefs: Array.from(new Set([...(existing?.sourceArtifactRefs ?? []), `${artifact.kind}:${artifact.artifactId}`])).sort()
      });
    }
  }

  return {
    schemaVersion: '1.0',
    kind: 'playbook-meta-patterns',
    createdAt: input.createdAt ?? new Date().toISOString(),
    patterns: [...patterns.values()].sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey))
  };
};

export const buildMetaFindings = (input: MetaAnalysisInput): MetaFindingsArtifact => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const allDecisions = input.promotionDecisions.flatMap((batch) => batch.decisions);
  const promoteDecisions = allDecisions.filter((decision) => decision.decisionType === 'promote');
  const supersedeDecisions = allDecisions.filter((decision) => decision.decisionType === 'supersede');

  const cycleById = new Map(input.runCycles.map((cycle) => [cycle.runCycleId, cycle]));
  const promotionLatencyHours = promoteDecisions
    .map((decision) => {
      const cycle = cycleById.get(decision.originCycleId);
      if (!cycle) return undefined;
      return hoursBetween(cycle.createdAt, decision.timestamp);
    })
    .filter((value): value is number => value !== undefined);

  const avgPromotionLatency = round4(safeDiv(promotionLatencyHours.reduce((sum, value) => sum + value, 0), promotionLatencyHours.length));
  const topologyStats = computeTopologyStats(input);

  const draftArtifacts = input.draftPatternCards;
  const unresolvedDraftAgeDays = round4(
    safeDiv(
      draftArtifacts
        .map((artifact) => hoursBetween(artifact.createdAt, createdAt))
        .filter((value): value is number => value !== undefined)
        .reduce((sum, hours) => sum + hours / 24, 0),
      draftArtifacts.length
    )
  );

  const supersedeRate = round4(safeDiv(supersedeDecisions.length, allDecisions.length));

  const contractMutations = input.contractHistory.length + input.contractVersions.length;
  const mutationFrequency = round4(safeDiv(contractMutations, input.runCycles.length));

  const entropyValues = [...input.runCycles]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((cycle) => cycle.metrics.entropyBudget);
  const entropyTrend = entropyValues.length < 2 ? 0 : round4(entropyValues[entropyValues.length - 1] - entropyValues[0]);

  const findings: MetaFinding[] = [
    toFinding({
      type: 'promotion_latency',
      title: 'Promotion latency',
      summary: 'Average time from run cycle creation to promote decisions.',
      severity: avgPromotionLatency > 48 ? 'high' : avgPromotionLatency > 24 ? 'medium' : 'low',
      value: avgPromotionLatency,
      threshold: 24,
      trend: avgPromotionLatency > 24 ? 'degrading' : 'stable',
      artifactRefs: input.promotionDecisions.map((batch) => `promotion-decision:${batch.batchId}`),
      recommendation: 'Keep promotion review queues short and close decisions within one daily cycle when possible.',
      supportingMetrics: {
        promotedDecisionCount: promoteDecisions.length,
        cycleCount: input.runCycles.length
      }
    }),
    toFinding({
      type: 'duplicate_pattern_pressure',
      title: 'Duplicate pattern pressure',
      summary: 'Repeated topology shapes across pattern cards.',
      severity: topologyStats.duplicationRate > 0.4 ? 'high' : topologyStats.duplicationRate > 0.2 ? 'medium' : 'low',
      value: topologyStats.duplicationRate,
      threshold: 0.2,
      trend: topologyStats.duplicationRate > 0.2 ? 'degrading' : 'stable',
      artifactRefs: input.patternCards.map((artifact) => `pattern-cards:${artifact.artifactId}`),
      recommendation: 'Consolidate duplicate topology variants before promotion review to reduce maintenance overhead.',
      supportingMetrics: {
        duplicateTopologies: topologyStats.duplicateTopologies,
        totalTopologies: topologyStats.totalTopologies
      }
    }),
    toFinding({
      type: 'unresolved_draft_age',
      title: 'Unresolved draft age',
      summary: 'Average age in days of unresolved draft artifacts.',
      severity: unresolvedDraftAgeDays > 14 ? 'high' : unresolvedDraftAgeDays > 7 ? 'medium' : 'low',
      value: unresolvedDraftAgeDays,
      threshold: 7,
      trend: unresolvedDraftAgeDays > 7 ? 'degrading' : 'stable',
      artifactRefs: draftArtifacts.map((artifact) => `pattern-card-drafts:${artifact.artifactId}`),
      recommendation: 'Resolve or archive stale draft artifacts before they exceed review windows.',
      supportingMetrics: {
        unresolvedDraftArtifacts: draftArtifacts.length,
        unresolvedDraftAgeDays
      }
    }),
    toFinding({
      type: 'supersede_rate',
      title: 'Supersede rate',
      summary: 'Share of promotion decisions that supersede existing patterns.',
      severity: supersedeRate > 0.35 ? 'high' : supersedeRate > 0.2 ? 'medium' : 'low',
      value: supersedeRate,
      threshold: 0.2,
      trend: supersedeRate > 0.2 ? 'degrading' : 'stable',
      artifactRefs: input.promotionDecisions.map((batch) => `promotion-decision:${batch.batchId}`),
      recommendation: 'Stabilize promotion criteria when supersede pressure rises above baseline.',
      supportingMetrics: {
        supersedeDecisions: supersedeDecisions.length,
        totalDecisions: allDecisions.length
      }
    }),
    toFinding({
      type: 'contract_mutation_frequency',
      title: 'Contract mutation frequency',
      summary: 'Rate of contract mutations and version events per run cycle.',
      severity: mutationFrequency > 1.5 ? 'high' : mutationFrequency > 0.75 ? 'medium' : 'low',
      value: mutationFrequency,
      threshold: 0.75,
      trend: mutationFrequency > 0.75 ? 'degrading' : 'stable',
      artifactRefs: [
        ...input.contractHistory.map((proposal) => `contract-proposal:${proposal.proposalId}`),
        ...input.contractVersions.map((version, index) => `contract-version:${String(version['contractId'] ?? index)}`)
      ],
      recommendation: 'Batch related contract changes and validate stability windows before introducing more mutations.',
      supportingMetrics: {
        contractMutations,
        runCycleCount: input.runCycles.length
      }
    }),
    toFinding({
      type: 'entropy_trend',
      title: 'Entropy trend',
      summary: 'Delta of entropy budget across chronological run cycles.',
      severity: entropyTrend > 0.1 ? 'high' : entropyTrend > 0.03 ? 'medium' : 'low',
      value: entropyTrend,
      threshold: 0,
      trend: entropyTrend > 0 ? 'degrading' : entropyTrend < 0 ? 'improving' : 'stable',
      artifactRefs: input.runCycles.map((cycle) => `run-cycle:${cycle.runCycleId}`),
      recommendation: 'Increase deterministic compaction and reuse when entropy budget trends upward.',
      supportingMetrics: {
        firstEntropy: entropyValues[0] ?? 0,
        latestEntropy: entropyValues[entropyValues.length - 1] ?? 0
      }
    })
  ];

  return {
    schemaVersion: '1.0',
    kind: 'playbook-meta-findings',
    createdAt,
    findings
  };
};
