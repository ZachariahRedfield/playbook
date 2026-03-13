export const MEMORY_CONTRACT_SCHEMA_VERSION = '1.0.0' as const;

export const memoryArtifactKinds = [
  'session-evidence-reference',
  'memory-event',
  'candidate-knowledge-record',
  'promoted-knowledge-record',
  'retired-knowledge-record'
] as const;

export type MemoryArtifactKind = (typeof memoryArtifactKinds)[number];

export type MemorySchemaMetadata<TKind extends MemoryArtifactKind = MemoryArtifactKind> = {
  kind: TKind;
  schemaVersion: string;
};

export type SessionEvidenceReference = MemorySchemaMetadata<'session-evidence-reference'> & {
  sessionId: string;
  stepId: string;
  artifactPath: string;
  capturedAt: number;
};

export type EventFingerprint = {
  fingerprintVersion: string;
  value: string;
  dimensions: string[];
};

export type SalienceScoreEnvelope = {
  scoreVersion: string;
  score: number;
  reasonCodes: string[];
  scoredAt: number;
};

export type MemoryEvent = MemorySchemaMetadata<'memory-event'> & {
  eventInstanceId: string;
  eventFingerprint: EventFingerprint;
  eventType: string;
  occurredAt: number;
  summary: string;
  repoId: string;
  evidence: SessionEvidenceReference[];
  salience: SalienceScoreEnvelope;
};

export const memoryLifecycleStates = ['candidate', 'promoted', 'retired'] as const;

export type MemoryLifecycleState = (typeof memoryLifecycleStates)[number];

export type SupersessionRetirementMetadata = {
  supersedesKnowledgeIds: string[];
  supersededByKnowledgeId?: string;
  retiredAt?: number;
  retirementReason?: string;
};

export type CandidateKnowledgeRecord = MemorySchemaMetadata<'candidate-knowledge-record'> & {
  knowledgeId: string;
  lifecycleState: 'candidate';
  canonicalKey: string;
  createdAt: number;
  updatedAt: number;
  sourceEventInstanceIds: string[];
  sourceEventFingerprints: string[];
  salience: SalienceScoreEnvelope;
  supersession: SupersessionRetirementMetadata;
};

export type PromotedKnowledgeRecord = MemorySchemaMetadata<'promoted-knowledge-record'> & {
  knowledgeId: string;
  lifecycleState: 'promoted';
  canonicalKey: string;
  promotedAt: number;
  updatedAt: number;
  sourceEventFingerprints: string[];
  salience: SalienceScoreEnvelope;
  supersession: SupersessionRetirementMetadata;
};

export type RetiredKnowledgeRecord = MemorySchemaMetadata<'retired-knowledge-record'> & {
  knowledgeId: string;
  lifecycleState: 'retired';
  canonicalKey: string;
  retiredAt: number;
  updatedAt: number;
  sourceEventFingerprints: string[];
  salience: SalienceScoreEnvelope;
  supersession: SupersessionRetirementMetadata;
};

export type MemoryKnowledgeRecord = CandidateKnowledgeRecord | PromotedKnowledgeRecord | RetiredKnowledgeRecord;

export const memoryArtifactPaths = {
  root: '.playbook/memory',
  runtimeEvents: '.playbook/memory/events/runtime',
  candidateKnowledge: '.playbook/memory/knowledge/candidates',
  promotedKnowledge: '.playbook/memory/knowledge/promoted',
  replayOutputs: '.playbook/memory/replay',
  compactionOutputs: '.playbook/memory/compaction'
} as const;

const sortAndDedupe = (values: string[]): string[] => [...new Set(values)].sort();

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

const stableHash = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const createMemorySchemaMetadata = <TKind extends MemoryArtifactKind>(kind: TKind): MemorySchemaMetadata<TKind> => ({
  kind,
  schemaVersion: MEMORY_CONTRACT_SCHEMA_VERSION
});

export const isSupportedMemorySchemaVersion = (schemaVersion: string): boolean => schemaVersion === MEMORY_CONTRACT_SCHEMA_VERSION;

export const normalizeEventFingerprintDimensions = (dimensions: string[]): string[] => sortAndDedupe(dimensions);

export const createEventFingerprint = (input: {
  eventType: string;
  canonicalKey: string;
  dimensions?: string[];
  fingerprintVersion?: string;
}): EventFingerprint => {
  const fingerprintVersion = input.fingerprintVersion ?? '1';
  const dimensions = normalizeEventFingerprintDimensions(input.dimensions ?? []);
  const canonicalRepresentation = stableSerialize({
    fingerprintVersion,
    eventType: input.eventType,
    canonicalKey: input.canonicalKey,
    dimensions
  });

  return {
    fingerprintVersion,
    value: `evtfp_${stableHash(canonicalRepresentation)}`,
    dimensions
  };
};

export const createEventInstanceId = (input: {
  repoId: string;
  eventType: string;
  occurredAt: number;
  eventFingerprint: EventFingerprint;
}): string => {
  const canonicalRepresentation = stableSerialize({
    repoId: input.repoId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    eventFingerprint: input.eventFingerprint.value,
    fingerprintVersion: input.eventFingerprint.fingerprintVersion
  });

  return `evt_${stableHash(canonicalRepresentation)}`;
};

export const createKnowledgeRecordId = (canonicalKey: string): string => `mem_${stableHash(stableSerialize({ canonicalKey }))}`;

export const createMemoryEvent = (input: {
  repoId: string;
  eventType: string;
  occurredAt: number;
  summary: string;
  canonicalKey: string;
  fingerprintDimensions?: string[];
  evidence: SessionEvidenceReference[];
  salience: SalienceScoreEnvelope;
}): MemoryEvent => {
  const eventFingerprint = createEventFingerprint({
    eventType: input.eventType,
    canonicalKey: input.canonicalKey,
    dimensions: input.fingerprintDimensions
  });

  return {
    ...createMemorySchemaMetadata('memory-event'),
    eventInstanceId: createEventInstanceId({
      repoId: input.repoId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      eventFingerprint
    }),
    eventFingerprint,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    summary: input.summary,
    repoId: input.repoId,
    evidence: [...input.evidence].sort((a, b) => {
      const sessionCompare = a.sessionId.localeCompare(b.sessionId);
      if (sessionCompare !== 0) return sessionCompare;
      const stepCompare = a.stepId.localeCompare(b.stepId);
      if (stepCompare !== 0) return stepCompare;
      return a.capturedAt - b.capturedAt;
    }),
    salience: {
      ...input.salience,
      reasonCodes: sortAndDedupe(input.salience.reasonCodes)
    }
  };
};

export const createCandidateKnowledgeRecord = (input: {
  canonicalKey: string;
  createdAt: number;
  sourceEventInstanceIds: string[];
  sourceEventFingerprints: string[];
  salience: SalienceScoreEnvelope;
  supersession?: SupersessionRetirementMetadata;
}): CandidateKnowledgeRecord => ({
  ...createMemorySchemaMetadata('candidate-knowledge-record'),
  knowledgeId: createKnowledgeRecordId(input.canonicalKey),
  lifecycleState: 'candidate',
  canonicalKey: input.canonicalKey,
  createdAt: input.createdAt,
  updatedAt: input.createdAt,
  sourceEventInstanceIds: sortAndDedupe(input.sourceEventInstanceIds),
  sourceEventFingerprints: sortAndDedupe(input.sourceEventFingerprints),
  salience: {
    ...input.salience,
    reasonCodes: sortAndDedupe(input.salience.reasonCodes)
  },
  supersession: {
    supersedesKnowledgeIds: sortAndDedupe(input.supersession?.supersedesKnowledgeIds ?? []),
    supersededByKnowledgeId: input.supersession?.supersededByKnowledgeId,
    retiredAt: input.supersession?.retiredAt,
    retirementReason: input.supersession?.retirementReason
  }
});

export const promoteCandidateKnowledgeRecord = (
  candidate: CandidateKnowledgeRecord,
  input: { promotedAt: number }
): PromotedKnowledgeRecord => {
  assertMemoryLifecycleTransition(candidate.lifecycleState, 'promoted');
  return {
    ...createMemorySchemaMetadata('promoted-knowledge-record'),
    knowledgeId: candidate.knowledgeId,
    lifecycleState: 'promoted',
    canonicalKey: candidate.canonicalKey,
    promotedAt: input.promotedAt,
    updatedAt: input.promotedAt,
    sourceEventFingerprints: sortAndDedupe(candidate.sourceEventFingerprints),
    salience: candidate.salience,
    supersession: candidate.supersession
  };
};

export const retirePromotedKnowledgeRecord = (
  promoted: PromotedKnowledgeRecord,
  input: { retiredAt: number; retirementReason: string; supersededByKnowledgeId?: string }
): RetiredKnowledgeRecord => {
  assertMemoryLifecycleTransition(promoted.lifecycleState, 'retired');
  return {
    ...createMemorySchemaMetadata('retired-knowledge-record'),
    knowledgeId: promoted.knowledgeId,
    lifecycleState: 'retired',
    canonicalKey: promoted.canonicalKey,
    retiredAt: input.retiredAt,
    updatedAt: input.retiredAt,
    sourceEventFingerprints: sortAndDedupe(promoted.sourceEventFingerprints),
    salience: promoted.salience,
    supersession: {
      ...promoted.supersession,
      supersededByKnowledgeId: input.supersededByKnowledgeId ?? promoted.supersession.supersededByKnowledgeId,
      retiredAt: input.retiredAt,
      retirementReason: input.retirementReason
    }
  };
};

export const assertMemoryLifecycleTransition = (
  current: MemoryLifecycleState,
  next: MemoryLifecycleState
): void => {
  if (current === 'candidate' && next === 'promoted') return;
  if (current === 'promoted' && next === 'retired') return;
  throw new Error(`Invalid memory lifecycle transition: ${current} -> ${next}`);
};
