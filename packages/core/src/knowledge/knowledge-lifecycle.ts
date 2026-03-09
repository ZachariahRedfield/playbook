import { createKnowledgeArtifactId, serializeCanonicalKnowledgeShape } from './knowledge-id.js';
import type {
  EvidenceReference,
  KnowledgeCandidate,
  KnowledgeCanonicalShape,
  KnowledgeCompacted,
  KnowledgePromoted,
  KnowledgeRetired
} from './knowledge-types.js';

export const knowledgeLifecycleStates = ['candidate', 'compacted', 'promoted', 'retired'] as const;

export type KnowledgeLifecycleState = (typeof knowledgeLifecycleStates)[number];

export const isKnowledgeLifecycleState = (value: string): value is KnowledgeLifecycleState =>
  knowledgeLifecycleStates.includes(value as KnowledgeLifecycleState);

const assertLifecycleState = (current: KnowledgeLifecycleState, expected: KnowledgeLifecycleState, next: KnowledgeLifecycleState): void => {
  if (current !== expected) {
    throw new Error(`Invalid lifecycle transition: ${current} -> ${next}. Expected current state ${expected}.`);
  }
};

const sortEvidence = (evidence: EvidenceReference[]): EvidenceReference[] =>
  [...evidence].sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) return typeCompare;
    const sourceCompare = a.source.localeCompare(b.source);
    if (sourceCompare !== 0) return sourceCompare;
    return a.timestamp - b.timestamp;
  });

const createBase = <TState extends KnowledgeLifecycleState>(args: {
  canonicalKey: string;
  canonicalShape: KnowledgeCanonicalShape;
  createdAt: number;
  updatedAt: number;
  lifecycleState: TState;
  evidence: EvidenceReference[];
  supersedesArtifactIds?: string[];
  supersededByArtifactId?: string;
}) => {
  const canonicalRepresentation = serializeCanonicalKnowledgeShape(args.canonicalShape);
  const id = createKnowledgeArtifactId(args.canonicalKey, canonicalRepresentation);
  return {
    id,
    canonicalKey: args.canonicalKey,
    canonicalRepresentation,
    canonicalShape: JSON.parse(canonicalRepresentation) as KnowledgeCanonicalShape,
    lifecycleState: args.lifecycleState,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
    evidence: sortEvidence(args.evidence),
    supersedesArtifactIds: [...(args.supersedesArtifactIds ?? [])].sort(),
    supersededByArtifactId: args.supersededByArtifactId
  };
};

export const createCandidate = (args: {
  canonicalKey: string;
  canonicalShape: KnowledgeCanonicalShape;
  createdAt: number;
  evidence?: EvidenceReference[];
}): KnowledgeCandidate =>
  createBase({
    ...args,
    updatedAt: args.createdAt,
    lifecycleState: 'candidate',
    evidence: args.evidence ?? []
  });

export const compactCandidate = (candidate: KnowledgeCandidate, args: { compactedAt: number }): KnowledgeCompacted => {
  assertLifecycleState(candidate.lifecycleState, 'candidate', 'compacted');
  return createBase({
    canonicalKey: candidate.canonicalKey,
    canonicalShape: candidate.canonicalShape,
    createdAt: candidate.createdAt,
    updatedAt: args.compactedAt,
    lifecycleState: 'compacted',
    evidence: candidate.evidence,
    supersedesArtifactIds: candidate.supersedesArtifactIds,
    supersededByArtifactId: candidate.supersededByArtifactId
  });
};

export const promoteKnowledge = (compacted: KnowledgeCompacted, args: { promotedAt: number }): KnowledgePromoted => {
  assertLifecycleState(compacted.lifecycleState, 'compacted', 'promoted');
  return createBase({
    canonicalKey: compacted.canonicalKey,
    canonicalShape: compacted.canonicalShape,
    createdAt: compacted.createdAt,
    updatedAt: args.promotedAt,
    lifecycleState: 'promoted',
    evidence: compacted.evidence,
    supersedesArtifactIds: compacted.supersedesArtifactIds,
    supersededByArtifactId: compacted.supersededByArtifactId
  });
};

export const retireKnowledge = (
  promoted: KnowledgePromoted,
  args: { retiredAt: number; supersededByArtifactId?: string }
): KnowledgeRetired => {
  assertLifecycleState(promoted.lifecycleState, 'promoted', 'retired');
  return createBase({
    canonicalKey: promoted.canonicalKey,
    canonicalShape: promoted.canonicalShape,
    createdAt: promoted.createdAt,
    updatedAt: args.retiredAt,
    lifecycleState: 'retired',
    evidence: promoted.evidence,
    supersedesArtifactIds: promoted.supersedesArtifactIds,
    supersededByArtifactId: args.supersededByArtifactId ?? promoted.supersededByArtifactId
  });
};

export const withLinkedEvidence = <T extends { evidence: EvidenceReference[] }>(artifact: T, evidence: EvidenceReference): T => ({
  ...artifact,
  evidence: sortEvidence([...artifact.evidence, evidence])
});

export const markSupersededArtifacts = <T extends { supersedesArtifactIds: string[] }>(artifact: T, supersededArtifactIds: string[]): T => ({
  ...artifact,
  supersedesArtifactIds: [...new Set([...artifact.supersedesArtifactIds, ...supersededArtifactIds])].sort()
});
