export type MemoryCandidateKind = 'decision' | 'pattern' | 'failure_mode' | 'invariant' | 'open_question';

export type MemoryReplayEventReference = {
  eventId: string;
  relativePath: string;
};

export type MemoryReplayIndex = {
  schemaVersion?: string;
  events: MemoryReplayEventReference[];
};

export type MemoryReplayCandidateProvenance = {
  eventId: string;
  sourcePath: string;
  fingerprint: string;
  runId: string | null;
};

export type MemoryReplaySalienceFactors = {
  severity: number;
  recurrenceCount: number;
  crossModuleBreadth: number;
  riskScore: number;
  persistenceAcrossRuns: number;
  ownershipDocsGap: number;
  novelSuccessfulRemediationShape: number;
};

export type MemoryReplayCandidate = {
  candidateId: string;
  kind: MemoryCandidateKind;
  title: string;
  summary: string;
  clusterKey: string;
  salienceScore: number;
  salienceFactors: MemoryReplaySalienceFactors;
  fingerprint: string;
  module: string;
  ruleId: string;
  failureShape: string;
  eventCount: number;
  provenance: MemoryReplayCandidateProvenance[];
  lastSeenAt?: string;
};

export type MemoryReplayResult = {
  schemaVersion: '1.0';
  command: 'memory-replay';
  sourceIndex: '.playbook/memory/index.json';
  generatedAt: string;
  totalEvents: number;
  clustersEvaluated: number;
  candidates: MemoryReplayCandidate[];
};
