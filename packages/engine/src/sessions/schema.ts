import { createHash } from 'node:crypto';

export type SessionSource = {
  kind: 'chat-text' | 'merge';
  name?: string;
  path?: string;
  hash?: string;
};

export type SessionDecision = {
  id: string;
  decision: string;
  rationale?: string;
  alternatives?: string[];
  evidence?: string[];
};

export type SessionSnapshot = {
  sessionId: string;
  source: SessionSource;
  createdAt: string;
  repoHint?: string;
  decisions: SessionDecision[];
  constraints: string[];
  openQuestions: string[];
  artifacts: string[];
  nextSteps: string[];
  tags: string[];
};

export type SessionConflict = {
  type: 'decision' | 'constraint' | 'artifact' | 'tag';
  key: string;
  ours: string | object;
  theirs: string | object;
  resolution?: 'manual';
  note?: string;
};

export type MergeResult = {
  mergedSnapshot: SessionSnapshot;
  conflicts: SessionConflict[];
  stats: {
    inputSnapshots: number;
    decisionCount: number;
    constraintCount: number;
    artifactCount: number;
    tagCount: number;
    conflictCount: number;
  };
};

export const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const stableHash = (value: string, size = 12): string => createHash('sha256').update(value).digest('hex').slice(0, size);

export const stableDecisionId = (decision: string): string => `decision-${stableHash(normalizeText(decision))}`;

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export const validateSessionSnapshot = (input: unknown): SessionSnapshot => {
  assert(typeof input === 'object' && input !== null, 'Snapshot must be an object');
  const snapshot = input as Record<string, unknown>;
  assert(typeof snapshot.sessionId === 'string' && snapshot.sessionId.length > 0, 'sessionId must be a non-empty string');
  assert(typeof snapshot.createdAt === 'string' && !Number.isNaN(Date.parse(snapshot.createdAt)), 'createdAt must be an ISO string');

  assert(typeof snapshot.source === 'object' && snapshot.source !== null, 'source must be an object');
  const source = snapshot.source as Record<string, unknown>;
  assert(source.kind === 'chat-text' || source.kind === 'merge', 'source.kind must be chat-text or merge');

  assert(Array.isArray(snapshot.decisions), 'decisions must be an array');
  for (const decision of snapshot.decisions as unknown[]) {
    assert(typeof decision === 'object' && decision !== null, 'decision entries must be objects');
    const entry = decision as Record<string, unknown>;
    assert(typeof entry.id === 'string' && entry.id.length > 0, 'decision.id must be a non-empty string');
    assert(typeof entry.decision === 'string' && entry.decision.length > 0, 'decision.decision must be a non-empty string');
    if (entry.rationale !== undefined) {
      assert(typeof entry.rationale === 'string', 'decision.rationale must be a string');
    }
    if (entry.alternatives !== undefined) {
      assert(isStringArray(entry.alternatives), 'decision.alternatives must be a string array');
    }
    if (entry.evidence !== undefined) {
      assert(isStringArray(entry.evidence), 'decision.evidence must be a string array');
    }
  }

  assert(isStringArray(snapshot.constraints), 'constraints must be a string array');
  assert(isStringArray(snapshot.openQuestions), 'openQuestions must be a string array');
  assert(isStringArray(snapshot.artifacts), 'artifacts must be a string array');
  assert(isStringArray(snapshot.nextSteps), 'nextSteps must be a string array');
  assert(isStringArray(snapshot.tags), 'tags must be a string array');

  return snapshot as SessionSnapshot;
};
