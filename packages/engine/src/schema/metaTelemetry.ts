export const META_TELEMETRY_SCHEMA_VERSION = '1.0' as const;

export type MetaTelemetryArtifact = {
  schemaVersion: typeof META_TELEMETRY_SCHEMA_VERSION;
  kind: 'playbook-meta-telemetry';
  createdAt: string;
  totals: {
    runCycles: number;
    graphSnapshots: number;
    groups: number;
    candidatePatterns: number;
    patternCards: number;
    promotionDecisions: number;
    contractEvents: number;
  };
  rates: {
    promotionLatencyAvgHours: number;
    duplicatePatternPressure: number;
    unresolvedDraftAgeDays: number;
    supersedeRate: number;
    contractMutationFrequency: number;
    entropyTrend: number;
  };
  homeostasis: {
    canonicalCoreSize: number;
    unresolvedDraftAgeBudgetDays: number;
    maxContractMutationsPerCycle: number;
    duplicationThreshold: number;
    entropyBudgetTrendThreshold: number;
  };
  mutationPolicy: 'proposal-only';
  artifactRefs: string[];
};
