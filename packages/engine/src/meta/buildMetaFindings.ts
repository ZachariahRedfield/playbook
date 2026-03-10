import type { ContractProposal } from '../schema/contractProposal.js';
import type { CandidatePatternPreviewArtifact, GraphGroupArtifact, GraphSnapshot } from '../schema/graphMemory.js';
import type { MetaFinding, MetaFindingsArtifact } from '../schema/metaFinding.js';
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

const extractMetrics = (input: MetaAnalysisInput, createdAt: string) => {
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

  const topologyValues = input.patternCards.flatMap((artifact) =>
    artifact.cards.map((card) =>
      JSON.stringify({
        stageCount: card.topology?.stageCount ?? 0,
        dependencyStructure: [...(card.topology?.dependencyStructure ?? [])].sort()
      })
    )
  );

  const referenceNow = Date.parse(createdAt);
  const unresolvedDraftAgeDays = round4(
    safeDiv(
      input.draftPatternCards
        .map((artifact) => {
          const ageMs = referenceNow - Date.parse(artifact.createdAt);
          return Number.isFinite(ageMs) && ageMs >= 0 ? ageMs / (24 * 3_600_000) : 0;
        })
        .reduce((sum, days) => sum + days, 0),
      input.draftPatternCards.length
    )
  );

  const entropyValues = [...input.runCycles]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((cycle) => cycle.metrics.entropyBudget);

  return {
    promotionLatency: round4(safeDiv(promotionLatencyHours.reduce((sum, value) => sum + value, 0), promotionLatencyHours.length)),
    duplicationRate: round4(safeDiv(topologyValues.length - new Set(topologyValues).size, topologyValues.length)),
    unresolvedDraftAge: unresolvedDraftAgeDays,
    supersedeRate: round4(safeDiv(supersedeDecisions.length, allDecisions.length)),
    entropyTrend: entropyValues.length < 2 ? 0 : round4(entropyValues[entropyValues.length - 1] - entropyValues[0]),
    contractMutationFrequency: round4(safeDiv(input.contractHistory.length + input.contractVersions.length, input.runCycles.length)),
    promotedDecisionCount: promoteDecisions.length,
    totalDecisionCount: allDecisions.length,
    runCycleCount: input.runCycles.length,
    draftCount: input.draftPatternCards.length,
    topologySampleSize: topologyValues.length,
    contractEvents: input.contractHistory.length + input.contractVersions.length
  };
};

const toFinding = (params: {
  findingType: MetaFinding['findingType'];
  description: string;
  sourceArtifactRefs: string[];
  supportingMetrics: Record<string, number>;
  confidence: number;
  observedCycleIds: string[];
  createdAt: string;
}): MetaFinding => ({
  findingId: `meta-finding:${params.findingType}`,
  findingType: params.findingType,
  description: params.description,
  sourceArtifactRefs: [...new Set(params.sourceArtifactRefs)].sort((a, b) => a.localeCompare(b)),
  supportingMetrics: params.supportingMetrics,
  confidence: params.confidence,
  observedCycleIds: [...new Set(params.observedCycleIds)].sort((a, b) => a.localeCompare(b)),
  createdAt: params.createdAt
});

export const buildMetaFindings = (input: MetaAnalysisInput): MetaFindingsArtifact => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const metrics = extractMetrics(input, createdAt);
  const cycleIds = input.runCycles.map((cycle) => cycle.runCycleId);

  const findings: MetaFinding[] = [
    toFinding({
      findingType: 'promotion_latency',
      description: 'Average elapsed hours from run cycle creation to promotion decision.',
      sourceArtifactRefs: input.promotionDecisions.map((batch) => `promotion-decision:${batch.batchId}`),
      supportingMetrics: {
        promotionLatency: metrics.promotionLatency,
        promotedDecisionCount: metrics.promotedDecisionCount,
        runCycleCount: metrics.runCycleCount
      },
      confidence: metrics.promotedDecisionCount > 0 ? 0.85 : 0.4,
      observedCycleIds: cycleIds,
      createdAt
    }),
    toFinding({
      findingType: 'duplicate_pattern_pressure',
      description: 'Duplicate topology pressure derived from promoted pattern-card topology overlap.',
      sourceArtifactRefs: input.patternCards.map((artifact) => `pattern-cards:${artifact.artifactId}`),
      supportingMetrics: {
        duplicationRate: metrics.duplicationRate,
        topologySampleSize: metrics.topologySampleSize
      },
      confidence: metrics.topologySampleSize > 0 ? 0.8 : 0.35,
      observedCycleIds: cycleIds,
      createdAt
    }),
    toFinding({
      findingType: 'unresolved_draft_age',
      description: 'Average age in days of unresolved draft pattern cards.',
      sourceArtifactRefs: input.draftPatternCards.map((artifact) => `pattern-card-drafts:${artifact.artifactId}`),
      supportingMetrics: {
        unresolvedDraftAge: metrics.unresolvedDraftAge,
        draftCount: metrics.draftCount
      },
      confidence: metrics.draftCount > 0 ? 0.75 : 0.3,
      observedCycleIds: cycleIds,
      createdAt
    }),
    toFinding({
      findingType: 'supersede_rate',
      description: 'Share of promotion decisions that supersede already-promoted patterns.',
      sourceArtifactRefs: input.promotionDecisions.map((batch) => `promotion-decision:${batch.batchId}`),
      supportingMetrics: {
        supersedeRate: metrics.supersedeRate,
        totalDecisionCount: metrics.totalDecisionCount
      },
      confidence: metrics.totalDecisionCount > 0 ? 0.85 : 0.3,
      observedCycleIds: cycleIds,
      createdAt
    }),
    toFinding({
      findingType: 'entropy_trend',
      description: 'Run-cycle entropy budget trend across the observed deterministic window.',
      sourceArtifactRefs: input.runCycles.map((cycle) => `run-cycle:${cycle.runCycleId}`),
      supportingMetrics: {
        entropyTrend: metrics.entropyTrend,
        runCycleCount: metrics.runCycleCount
      },
      confidence: metrics.runCycleCount > 1 ? 0.8 : 0.4,
      observedCycleIds: cycleIds,
      createdAt
    }),
    toFinding({
      findingType: 'contract_mutation_frequency',
      description: 'Average contract mutation events per run cycle from proposals and version events.',
      sourceArtifactRefs: [
        ...input.contractHistory.map((proposal) => `contract-proposal:${proposal.proposalId}`),
        ...input.contractVersions.map((version, index) => `contract-version:${String(version['contractId'] ?? index)}`)
      ],
      supportingMetrics: {
        contractMutationFrequency: metrics.contractMutationFrequency,
        contractEvents: metrics.contractEvents,
        runCycleCount: metrics.runCycleCount
      },
      confidence: metrics.runCycleCount > 0 ? 0.9 : 0.4,
      observedCycleIds: cycleIds,
      createdAt
    })
  ];

  return {
    schemaVersion: '1.0',
    kind: 'playbook-meta-findings',
    createdAt,
    findings
  };
};
