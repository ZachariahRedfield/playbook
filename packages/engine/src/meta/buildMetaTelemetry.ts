import type { MetaTelemetryArtifact } from '../schema/metaTelemetry.js';
import type { MetaAnalysisInput } from './buildMetaFindings.js';

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;
const safeDiv = (num: number, denom: number): number => (denom <= 0 ? 0 : num / denom);

export const buildMetaTelemetry = (input: MetaAnalysisInput): MetaTelemetryArtifact => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const runCycles = [...input.runCycles].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const cycleIds = runCycles.map((cycle) => cycle.runCycleId);

  const allDecisions = input.promotionDecisions.flatMap((batch) => batch.decisions);
  const promoteDecisions = allDecisions.filter((decision) => decision.decisionType === 'promote');
  const supersedeDecisions = allDecisions.filter((decision) => decision.decisionType === 'supersede');
  const cycleById = new Map(runCycles.map((cycle) => [cycle.runCycleId, cycle]));

  const promotionLatencies = promoteDecisions
    .map((decision) => {
      const cycle = cycleById.get(decision.originCycleId);
      if (!cycle) return undefined;
      const delta = Date.parse(decision.timestamp) - Date.parse(cycle.createdAt);
      return Number.isFinite(delta) && delta >= 0 ? delta / 3_600_000 : undefined;
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
  const unresolvedDraftAge = round4(
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

  const entropyTrend = runCycles.length < 2 ? 0 : round4(runCycles[runCycles.length - 1].metrics.entropyBudget - runCycles[0].metrics.entropyBudget);

  const contractEvents = input.contractHistory.length + input.contractVersions.length;

  return {
    schemaVersion: '1.0',
    kind: 'playbook-meta-telemetry',
    telemetryId: `meta-telemetry:${createdAt}`,
    createdAt,
    window: {
      runCycleCount: runCycles.length,
      firstRunCycleId: cycleIds[0],
      lastRunCycleId: cycleIds.at(-1)
    },
    promotionLatency: round4(safeDiv(promotionLatencies.reduce((sum, value) => sum + value, 0), promotionLatencies.length)),
    duplicationRate: round4(safeDiv(topologyValues.length - new Set(topologyValues).size, topologyValues.length)),
    unresolvedDraftAge,
    supersedeRate: round4(safeDiv(supersedeDecisions.length, allDecisions.length)),
    entropyTrend,
    contractMutationFrequency: round4(safeDiv(contractEvents, runCycles.length)),
    canonicalCoreSize: input.patternCards.flatMap((artifact) => artifact.cards).length + input.contractVersions.length,
    provisionalFrontierSize:
      input.graphSnapshots.length +
      input.groups.length +
      input.candidatePatterns.length +
      input.draftPatternCards.length
  };
};
