import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { MemoryReplayCandidate, MemoryReplayResult } from '../schema/memoryReplay.js';
import type { MemoryKnowledgeArtifact, MemoryKnowledgeEntry } from '../memory/knowledge.js';
import { MEMORY_CANDIDATES_RELATIVE_PATH, REPLAY_CANDIDATES_RELATIVE_PATH } from '../replay/candidates.js';

const MEMORY_INDEX_RELATIVE_PATH = '.playbook/memory/index.json' as const;
export const CONSOLIDATION_CANDIDATES_RELATIVE_PATH = '.playbook/memory/consolidation-candidates.json' as const;
const KNOWLEDGE_PATHS = [
  '.playbook/memory/knowledge/decisions.json',
  '.playbook/memory/knowledge/patterns.json',
  '.playbook/memory/knowledge/failure-modes.json',
  '.playbook/memory/knowledge/invariants.json'
] as const;

type ConsolidationReplayReference = {
  candidateId: string;
  fingerprint: string;
  clusterKey: string;
};

export type ConsolidationCandidate = {
  consolidationCandidateId: string;
  kind: MemoryReplayCandidate['kind'];
  title: string;
  summary: string;
  reviewStatus: 'review_required' | 'already_promoted_match';
  salience: {
    score: number;
    factors: MemoryReplayCandidate['salienceFactors'];
    eventCount: number;
  };
  provenance: {
    replayCandidates: ConsolidationReplayReference[];
    events: MemoryReplayCandidate['provenance'];
  };
  promotion: {
    eligible: boolean;
    matchedKnowledgeIds: string[];
    reviewRequired: true;
  };
  sourceReplayCandidateIds: string[];
  module: string;
  ruleId: string;
  fingerprint: string;
  lastSeenAt?: string;
};

export type ConsolidationCandidatesArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-consolidation-candidates';
  command: 'memory-consolidate';
  generatedAt: string;
  candidateOnly: true;
  authority: {
    mutation: 'read-only';
    promotion: 'review-required';
  };
  sourceArtifacts: {
    memoryIndex: '.playbook/memory/index.json';
    replayCandidates: '.playbook/memory/replay-candidates.json' | '.playbook/memory/candidates.json';
    promotedKnowledge: string[];
  };
  summary: {
    replayCandidatesRead: number;
    consolidatedCandidates: number;
    promotionReviewRequired: number;
    alreadyPromotedMatches: number;
  };
  candidates: ConsolidationCandidate[];
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const replayArtifactPath = (projectRoot: string): { relativePath: '.playbook/memory/replay-candidates.json' | '.playbook/memory/candidates.json'; fullPath: string } => {
  const preferred = path.join(projectRoot, REPLAY_CANDIDATES_RELATIVE_PATH);
  if (fs.existsSync(preferred)) {
    return { relativePath: REPLAY_CANDIDATES_RELATIVE_PATH, fullPath: preferred };
  }
  return { relativePath: MEMORY_CANDIDATES_RELATIVE_PATH, fullPath: path.join(projectRoot, MEMORY_CANDIDATES_RELATIVE_PATH) };
};

const readReplayCandidates = (projectRoot: string): { sourcePath: '.playbook/memory/replay-candidates.json' | '.playbook/memory/candidates.json'; candidates: MemoryReplayCandidate[] } => {
  const resolved = replayArtifactPath(projectRoot);
  if (!fs.existsSync(resolved.fullPath)) {
    throw new Error(`playbook memory consolidate: missing replay candidates artifact at ${resolved.relativePath}`);
  }
  const parsed = readJson<MemoryReplayResult>(resolved.fullPath);
  return {
    sourcePath: resolved.relativePath,
    candidates: Array.isArray(parsed.candidates) ? parsed.candidates : []
  };
};

const readPromotedKnowledge = (projectRoot: string): MemoryKnowledgeEntry[] =>
  KNOWLEDGE_PATHS.flatMap((relativePath) => {
    const fullPath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(fullPath)) return [];
    const parsed = readJson<Partial<MemoryKnowledgeArtifact>>(fullPath);
    return Array.isArray(parsed.entries) ? parsed.entries as MemoryKnowledgeEntry[] : [];
  });

const toConsolidationCandidateId = (candidate: MemoryReplayCandidate): string =>
  createHash('sha256').update(`${candidate.kind}:${candidate.fingerprint}:${candidate.candidateId}`).digest('hex').slice(0, 16);

const compareDate = (value: string | undefined): number => {
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toCandidate = (candidate: MemoryReplayCandidate, promotedKnowledge: MemoryKnowledgeEntry[]): ConsolidationCandidate => {
  const matchedKnowledgeIds = uniqueSorted(
    promotedKnowledge
      .filter((entry) => entry.fingerprint === candidate.fingerprint && entry.status === 'active')
      .map((entry) => entry.knowledgeId)
  );
  const reviewStatus = matchedKnowledgeIds.length > 0 ? 'already_promoted_match' : 'review_required';

  return {
    consolidationCandidateId: toConsolidationCandidateId(candidate),
    kind: candidate.kind,
    title: candidate.title,
    summary: reviewStatus === 'already_promoted_match'
      ? `Replay evidence matches promoted knowledge ${matchedKnowledgeIds.join(', ')} and still requires explicit review before any change.`
      : `Replay evidence is consolidated for explicit promotion review without mutating doctrine automatically.`,
    reviewStatus,
    salience: {
      score: candidate.salienceScore,
      factors: candidate.salienceFactors,
      eventCount: candidate.eventCount
    },
    provenance: {
      replayCandidates: [{ candidateId: candidate.candidateId, fingerprint: candidate.fingerprint, clusterKey: candidate.clusterKey }],
      events: [...candidate.provenance].sort((a, b) => `${a.eventId}:${a.sourcePath}`.localeCompare(`${b.eventId}:${b.sourcePath}`))
    },
    promotion: {
      eligible: matchedKnowledgeIds.length === 0 && candidate.kind !== 'open_question',
      matchedKnowledgeIds,
      reviewRequired: true
    },
    sourceReplayCandidateIds: [candidate.candidateId],
    module: candidate.module,
    ruleId: candidate.ruleId,
    fingerprint: candidate.fingerprint,
    ...(candidate.lastSeenAt ? { lastSeenAt: candidate.lastSeenAt } : {})
  };
};

const sortCandidates = (candidates: ConsolidationCandidate[]): ConsolidationCandidate[] =>
  [...candidates].sort((left, right) => (right.salience.score - left.salience.score) || left.consolidationCandidateId.localeCompare(right.consolidationCandidateId));

export const buildConsolidationCandidatesArtifact = (projectRoot: string): ConsolidationCandidatesArtifact => {
  const replay = readReplayCandidates(projectRoot);
  const promotedKnowledge = readPromotedKnowledge(projectRoot);
  const candidates = sortCandidates(replay.candidates.map((candidate) => toCandidate(candidate, promotedKnowledge)));

  return {
    schemaVersion: '1.0',
    kind: 'playbook-consolidation-candidates',
    command: 'memory-consolidate',
    generatedAt: new Date(0).toISOString(),
    candidateOnly: true,
    authority: {
      mutation: 'read-only',
      promotion: 'review-required'
    },
    sourceArtifacts: {
      memoryIndex: MEMORY_INDEX_RELATIVE_PATH,
      replayCandidates: replay.sourcePath,
      promotedKnowledge: [...KNOWLEDGE_PATHS]
    },
    summary: {
      replayCandidatesRead: replay.candidates.length,
      consolidatedCandidates: candidates.length,
      promotionReviewRequired: candidates.filter((entry) => entry.reviewStatus === 'review_required').length,
      alreadyPromotedMatches: candidates.filter((entry) => entry.reviewStatus === 'already_promoted_match').length
    },
    candidates
  };
};

export const writeConsolidationCandidatesArtifact = (projectRoot: string, artifact: ConsolidationCandidatesArtifact): string => {
  const outputPath = path.join(projectRoot, CONSOLIDATION_CANDIDATES_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};

export const consolidateReplayCandidates = (projectRoot: string): ConsolidationCandidatesArtifact => {
  const artifact = buildConsolidationCandidatesArtifact(projectRoot);
  writeConsolidationCandidatesArtifact(projectRoot, artifact);
  return artifact;
};
