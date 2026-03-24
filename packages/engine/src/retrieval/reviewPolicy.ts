import fs from 'node:fs';
import path from 'node:path';

export const REVIEW_POLICY_SCHEMA_VERSION = '1.0' as const;
export const REVIEW_POLICY_RELATIVE_PATH = '.playbook/review-policy.json' as const;

export type ReviewPolicyTargetKind = 'pattern' | 'rule' | 'doc' | 'knowledge';

export type ReviewPolicyTargetDefaults = {
  reaffirmCadenceDays: number;
  deferWindowDays: number;
};

export type ReviewPolicyArtifact = {
  schemaVersion: typeof REVIEW_POLICY_SCHEMA_VERSION;
  kind: 'playbook-review-policy';
  generatedAt: string;
  targetDefaults: Record<ReviewPolicyTargetKind, ReviewPolicyTargetDefaults>;
};

const DEFAULT_REVIEW_POLICY: Record<ReviewPolicyTargetKind, ReviewPolicyTargetDefaults> = {
  knowledge: { reaffirmCadenceDays: 45, deferWindowDays: 14 },
  pattern: { reaffirmCadenceDays: 45, deferWindowDays: 14 },
  rule: { reaffirmCadenceDays: 45, deferWindowDays: 14 },
  doc: { reaffirmCadenceDays: 90, deferWindowDays: 14 }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const asIso = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
};

const asPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : fallback;
};

const normalizeTargetDefaults = (raw: unknown): Record<ReviewPolicyTargetKind, ReviewPolicyTargetDefaults> => {
  if (!isRecord(raw)) {
    return { ...DEFAULT_REVIEW_POLICY };
  }

  const resolve = (kind: ReviewPolicyTargetKind): ReviewPolicyTargetDefaults => {
    const candidate = raw[kind];
    if (!isRecord(candidate)) {
      return { ...DEFAULT_REVIEW_POLICY[kind] };
    }

    return {
      reaffirmCadenceDays: asPositiveInteger(candidate.reaffirmCadenceDays, DEFAULT_REVIEW_POLICY[kind].reaffirmCadenceDays),
      deferWindowDays: asPositiveInteger(candidate.deferWindowDays, DEFAULT_REVIEW_POLICY[kind].deferWindowDays)
    };
  };

  return {
    knowledge: resolve('knowledge'),
    pattern: resolve('pattern'),
    rule: resolve('rule'),
    doc: resolve('doc')
  };
};

export const createDefaultReviewPolicyArtifact = (generatedAt: string = new Date().toISOString()): ReviewPolicyArtifact => ({
  schemaVersion: REVIEW_POLICY_SCHEMA_VERSION,
  kind: 'playbook-review-policy',
  generatedAt: asIso(generatedAt, new Date().toISOString()),
  targetDefaults: { ...DEFAULT_REVIEW_POLICY }
});

export const normalizeReviewPolicyArtifact = (raw: unknown, generatedAtFallback: string = new Date().toISOString()): ReviewPolicyArtifact => {
  if (!isRecord(raw)) {
    return createDefaultReviewPolicyArtifact(generatedAtFallback);
  }

  return {
    schemaVersion: REVIEW_POLICY_SCHEMA_VERSION,
    kind: 'playbook-review-policy',
    generatedAt: asIso(raw.generatedAt, generatedAtFallback),
    targetDefaults: normalizeTargetDefaults(raw.targetDefaults)
  };
};

export const readReviewPolicyArtifact = (repoRoot: string): ReviewPolicyArtifact => {
  const fullPath = path.join(repoRoot, REVIEW_POLICY_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    return createDefaultReviewPolicyArtifact();
  }

  try {
    return normalizeReviewPolicyArtifact(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
  } catch {
    return createDefaultReviewPolicyArtifact();
  }
};
