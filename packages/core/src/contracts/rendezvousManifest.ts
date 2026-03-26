export const RENDEZVOUS_MANIFEST_SCHEMA_VERSION = '1.0' as const;
export const RENDEZVOUS_MANIFEST_ARTIFACT_KIND = 'artifact-rendezvous-manifest' as const;

export const rendezvousArtifactIds = [
  'failure-log',
  'test-triage',
  'test-fix-plan',
  'apply-result',
  'test-autofix',
  'remediation-status'
] as const;

export type RendezvousArtifactId = (typeof rendezvousArtifactIds)[number];

export const rendezvousVerificationStatuses = ['passed', 'failed', 'unknown'] as const;
export type RendezvousVerificationStatus = (typeof rendezvousVerificationStatuses)[number];

export const rendezvousEvaluationStates = ['complete', 'incomplete', 'stale', 'conflicted'] as const;
export type RendezvousEvaluationState = (typeof rendezvousEvaluationStates)[number];

export type RendezvousManifestArtifact = {
  artifactId: RendezvousArtifactId;
  path: string;
  sha256: string;
  verification: RendezvousVerificationStatus;
};

export type RendezvousManifestArtifactMap = Partial<Record<RendezvousArtifactId, RendezvousManifestArtifact>>;

export type RendezvousManifestArtifactObservation = {
  artifactId: RendezvousArtifactId;
  path: string;
  sha256: string;
  verification: RendezvousVerificationStatus;
};

export type RendezvousManifestArtifactObservations = Partial<Record<RendezvousArtifactId, RendezvousManifestArtifactObservation>>;

export type RendezvousManifestArtifactBlocker = {
  artifactId: RendezvousArtifactId;
  reason: string;
};

export type RendezvousManifest = {
  schemaVersion: typeof RENDEZVOUS_MANIFEST_SCHEMA_VERSION;
  kind: typeof RENDEZVOUS_MANIFEST_ARTIFACT_KIND;
  generatedAt: string;
  baseSha: string;
  remediationId: string;
  requiredArtifactIds: RendezvousArtifactId[];
  artifacts: RendezvousManifestArtifactMap;
  blockers: RendezvousManifestArtifactBlocker[];
  confidence: number;
  staleOnShaChange: boolean;
};

export type RendezvousManifestEvaluation = {
  state: RendezvousEvaluationState;
  releaseReady: boolean;
  blockers: string[];
  missingArtifactIds: RendezvousArtifactId[];
  conflictingArtifactIds: RendezvousArtifactId[];
  stale: boolean;
};
