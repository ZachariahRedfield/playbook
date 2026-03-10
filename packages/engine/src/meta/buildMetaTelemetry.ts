import type { MetaTelemetryArtifact } from '../schema/metaTelemetry.js';
import type { MetaAnalysisInput } from './buildMetaFindings.js';

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;
const safeDiv = (num: number, denom: number): number => (denom <= 0 ? 0 : num / denom);

export const buildMetaTelemetry = (input: MetaAnalysisInput): MetaTelemetryArtifact => {
  const allDecisions = input.promotionDecisions.flatMap((batch) => batch.decisions);

  const avgLatencyHours = (() => {
    const cycleById = new Map(input.runCycles.map((cycle) => [cycle.runCycleId, cycle]));
    const latencies = allDecisions
      .filter((decision) => decision.decisionType === 'promote')
      .map((decision) => {
        const cycle = cycleById.get(decision.originCycleId);
        if (!cycle) return undefined;
        const delta = Date.parse(decision.timestamp) - Date.parse(cycle.createdAt);
        return Number.isFinite(delta) && delta >= 0 ? delta / 3_600_000 : undefined;
      })
      .filter((value): value is number => value !== undefined);

    return round4(safeDiv(latencies.reduce((sum, value) => sum + value, 0), latencies.length));
  })();

  const topologyValues = input.patternCards.flatMap((artifact) =>
    artifact.cards.map((card) =>
      JSON.stringify({
        stageCount: card.topology?.stageCount ?? 0,
        dependencyStructure: [...(card.topology?.dependencyStructure ?? [])].sort()
      })
    )
  );

  const referenceNow = Date.parse(input.createdAt ?? new Date().toISOString());

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

  const entropyTrend = (() => {
    if (input.runCycles.length < 2) return 0;
    const sorted = [...input.runCycles].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return round4(sorted[sorted.length - 1].metrics.entropyBudget - sorted[0].metrics.entropyBudget);
  })();

  const contractMutationFrequency = round4(safeDiv(input.contractHistory.length + input.contractVersions.length, input.runCycles.length));

  return {
    schemaVersion: '1.0',
    kind: 'playbook-meta-telemetry',
    createdAt: input.createdAt ?? new Date().toISOString(),
    totals: {
      runCycles: input.runCycles.length,
      graphSnapshots: input.graphSnapshots.length,
      groups: input.groups.length,
      candidatePatterns: input.candidatePatterns.length,
      patternCards: input.patternCards.length,
      promotionDecisions: input.promotionDecisions.length,
      contractEvents: input.contractHistory.length + input.contractVersions.length
    },
    rates: {
      promotionLatencyAvgHours: avgLatencyHours,
      duplicatePatternPressure: round4(safeDiv(topologyValues.length - new Set(topologyValues).size, topologyValues.length)),
      unresolvedDraftAgeDays,
      supersedeRate: round4(safeDiv(allDecisions.filter((decision) => decision.decisionType === 'supersede').length, allDecisions.length)),
      contractMutationFrequency,
      entropyTrend
    },
    homeostasis: {
      canonicalCoreSize: input.patternCards.flatMap((artifact) => artifact.cards).length + input.contractVersions.length,
      unresolvedDraftAgeBudgetDays: 7,
      maxContractMutationsPerCycle: 1,
      duplicationThreshold: 0.2,
      entropyBudgetTrendThreshold: 0
    },
    mutationPolicy: 'proposal-only',
    artifactRefs: [
      ...input.runCycles.map((cycle) => `run-cycle:${cycle.runCycleId}`),
      ...input.promotionDecisions.map((batch) => `promotion-decision:${batch.batchId}`),
      ...input.contractHistory.map((proposal) => `contract-proposal:${proposal.proposalId}`)
    ]
  };
};
