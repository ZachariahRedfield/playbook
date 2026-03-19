import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  STORY_CANDIDATES_RELATIVE_PATH,
  readStoryCandidatesArtifact,
  type StoryCandidateRecord
} from './story/candidates.js';
import {
  STORIES_RELATIVE_PATH,
  createDefaultStoriesArtifact,
  readStoriesArtifact,
  upsertStory,
  validateStoriesArtifact,
  type StoryRecord,
  type StoriesArtifact
} from './story/stories.js';
import { PATTERN_CANDIDATES_RELATIVE_PATH } from './extract/patternCandidates.js';

export const GLOBAL_PATTERNS_RELATIVE_PATH = 'patterns.json' as const;

export type PromotionSourceRef = `repo/${string}/story-candidates/${string}` | `global/pattern-candidates/${string}`;

export type StoryPromotionProvenance = {
  source_ref: PromotionSourceRef;
  promoted_from: 'story-candidate' | 'pattern-candidate';
  candidate_id: string;
  candidate_fingerprint: string;
  source_artifact: string;
  promoted_at: string;
};

export type StoryRecordWithProvenance = StoryRecord & {
  provenance?: StoryPromotionProvenance;
};

export type PromotedPatternRecord = {
  id: string;
  pattern_family: string;
  title: string;
  description: string;
  source_artifact: string;
  signals: string[];
  confidence: number;
  evidence_refs: string[];
  status: 'promoted';
  provenance: {
    source_ref: `global/pattern-candidates/${string}`;
    candidate_id: string;
    candidate_fingerprint: string;
    promoted_at: string;
  };
};

export type CanonicalPatternsArtifact = {
  schemaVersion: '1.0';
  kind: 'promoted-patterns';
  patterns: PromotedPatternRecord[];
};

export type PreparedPromotion<TArtifact, TRecord> = {
  scope: 'repo' | 'global';
  targetId: string;
  targetRoot: string;
  stagedRelativePath: string;
  committedRelativePath: string;
  artifact: TArtifact;
  record: TRecord;
  noop: boolean;
  sourceRef: PromotionSourceRef;
};

const stableStringify = (value: unknown): string => JSON.stringify(value);
const fingerprintOf = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
const sortStrings = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const asRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const parseSourceRef = (sourceRef: string): { scope: 'repo' | 'global'; repoId?: string; kind: 'story-candidates' | 'pattern-candidates'; candidateId: string } => {
  const repoMatch = /^repo\/([^/]+)\/story-candidates\/([^/]+)$/.exec(sourceRef);
  if (repoMatch) {
    return { scope: 'repo', repoId: repoMatch[1], kind: 'story-candidates', candidateId: repoMatch[2] };
  }
  const globalMatch = /^global\/pattern-candidates\/([^/]+)$/.exec(sourceRef);
  if (globalMatch) {
    return { scope: 'global', kind: 'pattern-candidates', candidateId: globalMatch[1] };
  }
  throw new Error(`playbook promote: unsupported source ref: ${sourceRef}`);
};

const readJsonIfPresent = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const defaultPatternsArtifact = (): CanonicalPatternsArtifact => ({
  schemaVersion: '1.0',
  kind: 'promoted-patterns',
  patterns: []
});

export const readCanonicalPatternsArtifact = (playbookHome: string): CanonicalPatternsArtifact => {
  const filePath = path.join(playbookHome, GLOBAL_PATTERNS_RELATIVE_PATH);
  const parsed = readJsonIfPresent<CanonicalPatternsArtifact>(filePath);
  if (!parsed) return defaultPatternsArtifact();
  if (parsed.schemaVersion !== '1.0' || parsed.kind !== 'promoted-patterns' || !Array.isArray(parsed.patterns)) {
    throw new Error(`playbook promote: invalid global patterns artifact at ${GLOBAL_PATTERNS_RELATIVE_PATH}`);
  }
  return {
    schemaVersion: '1.0',
    kind: 'promoted-patterns',
    patterns: [...parsed.patterns].sort((left, right) => left.id.localeCompare(right.id))
  };
};

const readGlobalPatternCandidates = (playbookHome: string): Array<Record<string, unknown>> => {
  const filePath = path.join(playbookHome, '.playbook', 'pattern-candidates.json');
  const parsed = readJsonIfPresent<{ candidates?: Array<Record<string, unknown>>; kind?: string }>(filePath);
  if (!parsed) {
    throw new Error(`playbook promote: missing global pattern candidates artifact at .playbook/pattern-candidates.json`);
  }
  if (parsed.kind !== 'pattern-candidates' || !Array.isArray(parsed.candidates)) {
    throw new Error(`playbook promote: invalid global pattern candidates artifact at .playbook/pattern-candidates.json`);
  }
  return parsed.candidates;
};

const findStoryCandidate = (repoRoot: string, candidateId: string): StoryCandidateRecord => {
  const artifact = readStoryCandidatesArtifact(repoRoot);
  const candidate = artifact.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) {
    throw new Error(`playbook promote: story candidate not found: ${candidateId}`);
  }
  return candidate;
};

const findPatternCandidate = (playbookHome: string, candidateId: string): Record<string, unknown> => {
  const candidate = readGlobalPatternCandidates(playbookHome).find((entry) => String(entry.id ?? '') === candidateId);
  if (!candidate) {
    throw new Error(`playbook promote: pattern candidate not found: ${candidateId}`);
  }
  return candidate;
};

const validatePreparedStoryArtifact = (artifact: StoriesArtifact): void => {
  const errors = validateStoriesArtifact(artifact);
  if (errors.length > 0) {
    throw new Error(`playbook promote: invalid story artifact: ${errors.join('; ')}`);
  }
};

const withStoryConflictCheck = (existing: StoryRecordWithProvenance | undefined, next: StoryRecordWithProvenance): { noop: boolean } => {
  if (!existing) return { noop: false };
  const existingFingerprint = existing.provenance?.candidate_fingerprint ?? null;
  const nextFingerprint = next.provenance?.candidate_fingerprint ?? null;
  if (existingFingerprint === nextFingerprint && nextFingerprint) {
    return { noop: true };
  }
  throw new Error(`playbook promote: conflict for story ${next.id}. Existing content differs from candidate fingerprint ${nextFingerprint ?? 'unknown'}.`);
};

const withPatternConflictCheck = (existing: PromotedPatternRecord | undefined, next: PromotedPatternRecord): { noop: boolean } => {
  if (!existing) return { noop: false };
  if (existing.provenance.candidate_fingerprint === next.provenance.candidate_fingerprint) {
    return { noop: true };
  }
  throw new Error(`playbook promote: conflict for pattern ${next.id}. Existing content differs from candidate fingerprint ${next.provenance.candidate_fingerprint}.`);
};

export const materializeStoryFromSource = (input: {
  sourceRef: PromotionSourceRef;
  sourceRepoRoot?: string;
  targetRepoId: string;
  targetStoryId?: string;
  targetRepoRoot: string;
  playbookHome: string;
  promotedAt?: string;
}): PreparedPromotion<StoriesArtifact, StoryRecordWithProvenance> => {
  const parsed = parseSourceRef(input.sourceRef);
  const promotedAt = input.promotedAt ?? new Date().toISOString();
  const current = fs.existsSync(path.join(input.targetRepoRoot, STORIES_RELATIVE_PATH))
    ? readStoriesArtifact(input.targetRepoRoot)
    : createDefaultStoriesArtifact(input.targetRepoId);

  let nextStory: StoryRecordWithProvenance;

  if (parsed.kind === 'story-candidates') {
    const sourceRepoRoot = input.sourceRepoRoot ?? input.targetRepoRoot;
    const candidate = findStoryCandidate(sourceRepoRoot, parsed.candidateId);
    nextStory = {
      ...candidate,
      id: input.targetStoryId ?? candidate.id,
      repo: current.repo,
      provenance: {
        source_ref: input.sourceRef,
        promoted_from: 'story-candidate',
        candidate_id: candidate.id,
        candidate_fingerprint: candidate.candidate_fingerprint,
        source_artifact: STORY_CANDIDATES_RELATIVE_PATH,
        promoted_at: promotedAt
      }
    };
  } else {
    const candidate = findPatternCandidate(input.playbookHome, parsed.candidateId);
    const candidateFingerprint = fingerprintOf(candidate);
    const patternFamily = String(candidate.pattern_family ?? 'pattern');
    nextStory = {
      id: input.targetStoryId ?? `pattern-${patternFamily}`,
      repo: current.repo,
      title: `Adopt pattern ${String(candidate.title ?? parsed.candidateId)}`,
      type: 'feature',
      source: 'global-pattern-candidate',
      severity: 'medium',
      priority: 'medium',
      confidence: Number(candidate.confidence ?? 0) >= 0.8 ? 'high' : 'medium',
      status: 'proposed',
      evidence: sortStrings([String(candidate.source_artifact ?? PATTERN_CANDIDATES_RELATIVE_PATH), ...((Array.isArray(candidate.evidence_refs) ? candidate.evidence_refs : []).map(String))]),
      rationale: String(candidate.description ?? 'Promoted from reviewed global pattern candidate.'),
      acceptance_criteria: sortStrings([
        `Review global pattern candidate ${parsed.candidateId}.`,
        `Decide how ${input.targetRepoId} should adopt ${patternFamily}.`
      ]),
      dependencies: [],
      execution_lane: 'safe_single_pr',
      suggested_route: 'pattern_learning',
      provenance: {
        source_ref: input.sourceRef,
        promoted_from: 'pattern-candidate',
        candidate_id: parsed.candidateId,
        candidate_fingerprint: candidateFingerprint,
        source_artifact: PATTERN_CANDIDATES_RELATIVE_PATH,
        promoted_at: promotedAt
      }
    };
  }

  const existing = current.stories.find((entry) => entry.id === nextStory.id) as StoryRecordWithProvenance | undefined;
  const { noop } = withStoryConflictCheck(existing, nextStory);
  const artifact = noop ? current : upsertStory(current, nextStory);
  validatePreparedStoryArtifact(artifact);
  return {
    scope: 'repo',
    targetId: nextStory.id,
    targetRoot: input.targetRepoRoot,
    stagedRelativePath: '.playbook/staged/promotions/stories.json',
    committedRelativePath: STORIES_RELATIVE_PATH,
    artifact,
    record: noop ? existing! : nextStory,
    noop,
    sourceRef: input.sourceRef
  };
};

export const materializePatternFromCandidate = (input: {
  sourceRef: `global/pattern-candidates/${string}`;
  playbookHome: string;
  targetPatternId?: string;
  promotedAt?: string;
}): PreparedPromotion<CanonicalPatternsArtifact, PromotedPatternRecord> => {
  const parsed = parseSourceRef(input.sourceRef);
  const promotedAt = input.promotedAt ?? new Date().toISOString();
  const candidate = findPatternCandidate(input.playbookHome, parsed.candidateId);
  const candidateFingerprint = fingerprintOf(candidate);
  const nextPattern: PromotedPatternRecord = {
    id: input.targetPatternId ?? String(candidate.pattern_family ?? parsed.candidateId),
    pattern_family: String(candidate.pattern_family ?? parsed.candidateId),
    title: String(candidate.title ?? parsed.candidateId),
    description: String(candidate.description ?? ''),
    source_artifact: String(candidate.source_artifact ?? PATTERN_CANDIDATES_RELATIVE_PATH),
    signals: sortStrings((Array.isArray(candidate.signals) ? candidate.signals : []).map(String)),
    confidence: Number(candidate.confidence ?? 0),
    evidence_refs: sortStrings((Array.isArray(candidate.evidence_refs) ? candidate.evidence_refs : []).map(String)),
    status: 'promoted',
    provenance: {
      source_ref: input.sourceRef,
      candidate_id: parsed.candidateId,
      candidate_fingerprint: candidateFingerprint,
      promoted_at: promotedAt
    }
  };

  const current = readCanonicalPatternsArtifact(input.playbookHome);
  const existing = current.patterns.find((entry) => entry.id === nextPattern.id);
  const { noop } = withPatternConflictCheck(existing, nextPattern);
  const artifact: CanonicalPatternsArtifact = noop
    ? current
    : {
        schemaVersion: '1.0',
        kind: 'promoted-patterns',
        patterns: [...current.patterns.filter((entry) => entry.id !== nextPattern.id), nextPattern].sort((left, right) => left.id.localeCompare(right.id))
      };

  return {
    scope: 'global',
    targetId: nextPattern.id,
    targetRoot: input.playbookHome,
    stagedRelativePath: 'staged/promotions/patterns.json',
    committedRelativePath: GLOBAL_PATTERNS_RELATIVE_PATH,
    artifact,
    record: noop ? existing! : nextPattern,
    noop,
    sourceRef: input.sourceRef
  };
};
