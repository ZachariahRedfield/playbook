import type {
  RendezvousArtifactId,
  RendezvousManifest,
  RendezvousManifestArtifact,
  RendezvousManifestArtifactBlocker,
  RendezvousManifestArtifactObservations,
  RendezvousManifestEvaluation
} from '@zachariahredfield/playbook-core';
import { RENDEZVOUS_MANIFEST_ARTIFACT_KIND, RENDEZVOUS_MANIFEST_SCHEMA_VERSION } from '@zachariahredfield/playbook-core';

export type BuildRendezvousManifestInput = {
  generatedAt: string;
  baseSha: string;
  remediationId: string;
  requiredArtifactIds: RendezvousArtifactId[];
  artifacts: Partial<Record<RendezvousArtifactId, RendezvousManifestArtifact>>;
  blockers?: RendezvousManifestArtifactBlocker[];
  confidence?: number;
  staleOnShaChange?: boolean;
};

export type EvaluateRendezvousManifestOptions = {
  currentSha: string;
  observedArtifacts?: RendezvousManifestArtifactObservations;
  refreshedBaseSha?: boolean;
};

const uniqueSorted = <T extends string>(values: T[]): T[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const sortBlockers = (blockers: RendezvousManifestArtifactBlocker[]): RendezvousManifestArtifactBlocker[] =>
  [...blockers].sort((a, b) => {
    if (a.artifactId === b.artifactId) return a.reason.localeCompare(b.reason);
    return a.artifactId.localeCompare(b.artifactId);
  });

const sortArtifacts = (
  artifacts: Partial<Record<RendezvousArtifactId, RendezvousManifestArtifact>>
): Partial<Record<RendezvousArtifactId, RendezvousManifestArtifact>> => {
  const entries = Object.entries(artifacts) as Array<[RendezvousArtifactId, RendezvousManifestArtifact]>;
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return Object.fromEntries(entries) as Partial<Record<RendezvousArtifactId, RendezvousManifestArtifact>>;
};

export const buildRendezvousManifest = (input: BuildRendezvousManifestInput): RendezvousManifest => ({
  schemaVersion: RENDEZVOUS_MANIFEST_SCHEMA_VERSION,
  kind: RENDEZVOUS_MANIFEST_ARTIFACT_KIND,
  generatedAt: input.generatedAt,
  baseSha: input.baseSha,
  remediationId: input.remediationId,
  requiredArtifactIds: uniqueSorted(input.requiredArtifactIds),
  artifacts: sortArtifacts(input.artifacts),
  blockers: sortBlockers(input.blockers ?? []),
  confidence: typeof input.confidence === 'number' ? Number(input.confidence.toFixed(4)) : 0,
  staleOnShaChange: input.staleOnShaChange ?? true
});

export const evaluateRendezvousManifest = (
  manifest: RendezvousManifest,
  options: EvaluateRendezvousManifestOptions
): RendezvousManifestEvaluation => {
  const requiredIds = uniqueSorted(manifest.requiredArtifactIds);
  const missingArtifactIds = requiredIds.filter((artifactId) => !manifest.artifacts[artifactId]);

  const conflictingArtifactIds = requiredIds.filter((artifactId) => {
    const expected = manifest.artifacts[artifactId];
    const observed = options.observedArtifacts?.[artifactId];
    if (!expected || !observed) return false;
    return expected.sha256 !== observed.sha256;
  });

  const verificationFailures = requiredIds.filter((artifactId) => manifest.artifacts[artifactId]?.verification !== 'passed');

  const stale = manifest.staleOnShaChange && !options.refreshedBaseSha && options.currentSha !== manifest.baseSha;

  const blockers: string[] = [
    ...manifest.blockers.map((entry) => `${entry.artifactId}: ${entry.reason}`),
    ...missingArtifactIds.map((artifactId) => `${artifactId}: required artifact missing from manifest`),
    ...conflictingArtifactIds.map((artifactId) => `${artifactId}: observed hash conflicts with manifest hash`),
    ...verificationFailures.map((artifactId) => `${artifactId}: verification status must be passed for release readiness`),
    ...(stale ? [`baseSha changed from ${manifest.baseSha} to ${options.currentSha}`] : [])
  ];

  const state: RendezvousManifestEvaluation['state'] =
    conflictingArtifactIds.length > 0
      ? 'conflicted'
      : stale
        ? 'stale'
        : missingArtifactIds.length > 0 || verificationFailures.length > 0 || manifest.blockers.length > 0
          ? 'incomplete'
          : 'complete';

  return {
    state,
    releaseReady: state === 'complete' && blockers.length === 0,
    blockers,
    missingArtifactIds,
    conflictingArtifactIds,
    stale
  };
};
