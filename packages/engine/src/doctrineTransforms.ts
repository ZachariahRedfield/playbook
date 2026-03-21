import { createHash } from 'node:crypto';
import { GLOBAL_PATTERNS_RELATIVE_PATH, readCanonicalPatternsArtifact, type PromotedPatternRecord } from './promotion.js';

export const DOCTRINE_TRANSFORM_SCHEMA_VERSION = '1.0' as const;
export const DOCTRINE_TRANSFORM_KINDS = ['pattern_to_story_seed'] as const;
export type DoctrineTransformKind = (typeof DOCTRINE_TRANSFORM_KINDS)[number];

export type DoctrineTransformProposal = {
  proposal_id: string;
  transform_kind: 'pattern_to_story_seed';
  source: {
    pattern_id: string;
    status: PromotedPatternRecord['status'];
    promoted_at: string;
    source_artifact: string;
    provenance: PromotedPatternRecord['provenance'];
    story_seed_fingerprint: string;
  };
  eligibility: {
    eligible: true;
    reasons: ['promoted_active_provenance_linked'];
  };
  target: {
    kind: 'story-candidate';
    story_id: string;
    title: string;
    summary: string;
    acceptance_criteria: string[];
    suggested_route: 'pattern_learning';
    execution_lane: 'safe_single_pr';
    source_pattern_id: string;
  };
  evidence: string[];
  governance: {
    review_required: true;
    mutation_allowed: false;
    downstream_surface: 'story-candidates';
  };
};

export type DoctrineTransformArtifact = {
  schemaVersion: typeof DOCTRINE_TRANSFORM_SCHEMA_VERSION;
  kind: 'doctrine-transform-proposals';
  generatedAt: string;
  playbookHome: string;
  targetRepoId: string;
  proposals: DoctrineTransformProposal[];
};

const stable = (value: unknown): string => JSON.stringify(value);
const fingerprint = (value: unknown): string => createHash('sha256').update(stable(value)).digest('hex');
const uniqueSorted = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pattern';

export const assertPatternEligibleForDoctrineTransform = (pattern: PromotedPatternRecord): void => {
  if (pattern.status !== 'active') {
    throw new Error(`Doctrine transforms require active promoted patterns. Received ${pattern.id} with status ${pattern.status}.`);
  }
  if (!pattern.provenance?.candidate_id || !pattern.provenance?.candidate_fingerprint || !pattern.provenance?.promoted_at) {
    throw new Error(`Doctrine transforms require provenance-linked promoted patterns. Missing provenance for ${pattern.id}.`);
  }
};

export const buildPatternStoryDoctrineTransform = (pattern: PromotedPatternRecord, options?: { targetRepoId?: string; generatedAt?: string }): DoctrineTransformProposal => {
  assertPatternEligibleForDoctrineTransform(pattern);
  const targetRepoId = options?.targetRepoId ?? 'repo';
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const storySeedFingerprint = fingerprint(pattern.storySeed);
  const storyId = `story-candidate-pattern-${slugify(pattern.pattern_family)}-${storySeedFingerprint.slice(0, 12)}`;
  return {
    proposal_id: `doctrine-transform:${pattern.id}:${storySeedFingerprint.slice(0, 12)}`,
    transform_kind: 'pattern_to_story_seed',
    source: {
      pattern_id: pattern.id,
      status: pattern.status,
      promoted_at: pattern.provenance.promoted_at,
      source_artifact: GLOBAL_PATTERNS_RELATIVE_PATH,
      provenance: pattern.provenance,
      story_seed_fingerprint: storySeedFingerprint
    },
    eligibility: {
      eligible: true,
      reasons: ['promoted_active_provenance_linked']
    },
    target: {
      kind: 'story-candidate',
      story_id: storyId,
      title: pattern.storySeed.title,
      summary: `${pattern.storySeed.summary} Target repo: ${targetRepoId}. Generated ${generatedAt}.`,
      acceptance_criteria: uniqueSorted([
        ...pattern.storySeed.acceptance,
        `Review promoted pattern ${pattern.id} before planning execution.`,
        `Confirm ${targetRepoId} should adopt ${pattern.pattern_family}.`
      ]),
      suggested_route: 'pattern_learning',
      execution_lane: 'safe_single_pr',
      source_pattern_id: pattern.id
    },
    evidence: uniqueSorted([GLOBAL_PATTERNS_RELATIVE_PATH, pattern.source_artifact, ...pattern.evidence_refs]),
    governance: {
      review_required: true,
      mutation_allowed: false,
      downstream_surface: 'story-candidates'
    }
  };
};

export const generateDoctrineTransformArtifact = (input: { playbookHome: string; targetRepoId: string; generatedAt?: string }): DoctrineTransformArtifact => {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const proposals = readCanonicalPatternsArtifact(input.playbookHome)
    .patterns
    .filter((pattern) => pattern.status === 'active')
    .map((pattern) => buildPatternStoryDoctrineTransform(pattern, { targetRepoId: input.targetRepoId, generatedAt }))
    .sort((a, b) => a.source.pattern_id.localeCompare(b.source.pattern_id));

  return {
    schemaVersion: DOCTRINE_TRANSFORM_SCHEMA_VERSION,
    kind: 'doctrine-transform-proposals',
    generatedAt,
    playbookHome: input.playbookHome,
    targetRepoId: input.targetRepoId,
    proposals
  };
};
