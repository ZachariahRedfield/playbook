export const META_TELEMETRY_SCHEMA_VERSION = '1.0' as const;

export type MetaTelemetryArtifact = {
  schemaVersion: typeof META_TELEMETRY_SCHEMA_VERSION;
  kind: 'playbook-meta-telemetry';
  telemetryId: string;
  createdAt: string;
  window: {
    runCycleCount: number;
    firstRunCycleId?: string;
    lastRunCycleId?: string;
  };
  promotionLatency: number;
  duplicationRate: number;
  unresolvedDraftAge: number;
  supersedeRate: number;
  entropyTrend: number;
  contractMutationFrequency: number;
  canonicalCoreSize: number;
  provisionalFrontierSize: number;
};
