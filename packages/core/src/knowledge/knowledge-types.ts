import type { KnowledgeLifecycleState } from './knowledge-lifecycle.js';

export const evidenceReferenceTypes = ['observation', 'rule', 'remediation', 'repo-structure'] as const;
export type EvidenceReferenceType = (typeof evidenceReferenceTypes)[number];

export type EvidenceReference = {
  type: EvidenceReferenceType;
  source: string;
  timestamp: number;
};

export type KnowledgeCanonicalShape = Record<string, unknown>;

export type KnowledgeArtifactBase<TState extends KnowledgeLifecycleState> = {
  id: string;
  canonicalKey: string;
  canonicalRepresentation: string;
  canonicalShape: KnowledgeCanonicalShape;
  lifecycleState: TState;
  createdAt: number;
  updatedAt: number;
  evidence: EvidenceReference[];
  supersedesArtifactIds: string[];
  supersededByArtifactId?: string;
};

export type KnowledgeCandidate = KnowledgeArtifactBase<'candidate'>;
export type KnowledgeCompacted = KnowledgeArtifactBase<'compacted'>;
export type KnowledgePromoted = KnowledgeArtifactBase<'promoted'>;
export type KnowledgeRetired = KnowledgeArtifactBase<'retired'>;

export type KnowledgeArtifact = KnowledgeCandidate | KnowledgeCompacted | KnowledgePromoted | KnowledgeRetired;
