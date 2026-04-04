import fs from 'node:fs';
import path from 'node:path';
import type { AnalyzePullRequestResult } from './analyzePr.js';

type JsonRecord = Record<string, unknown>;
type ReviewPrArtifactLike = {
  summary: {
    safe: number;
    requires_review: number;
    blocked: number;
  };
};

type ArtifactRef = {
  path: string;
  kind: string;
  present: boolean;
};

export type PrReviewLoopArtifact = {
  schemaVersion: '1.0';
  kind: 'pr-review-loop';
  trigger: {
    source: 'analyze-pr' | 'session' | 'unknown';
    normalized: string;
    base_ref: string | null;
  };
  session_refs: {
    session_path: '.playbook/session.json';
    session_present: boolean;
    selected_run_id: string | null;
  };
  hydrated_evidence_refs: ArtifactRef[];
  policy_gate: {
    source: '.playbook/pr-review.json';
    safe: number;
    requires_review: number;
    blocked: number;
    decision: 'pass' | 'requires_review' | 'blocked';
  };
  bounded_autofix_eligibility: {
    remediation_status_path: '.playbook/remediation-status.json';
    remediation_status_present: boolean;
    eligible: boolean;
    reason: string;
  };
  reverification: {
    verify: { path: '.playbook/verify.json'; present: boolean; ok: boolean | null };
    verify_preflight: { path: '.playbook/verify-preflight.json'; present: boolean; ok: boolean | null };
  };
  escalation: {
    state: 'none' | 'requires_review' | 'blocked';
    next_action: string;
  };
};

export const PR_REVIEW_LOOP_ARTIFACT_RELATIVE_PATH = '.playbook/pr-review-loop.json' as const;

const readJson = (repoRoot: string, relPath: string): JsonRecord | null => {
  const target = path.join(repoRoot, relPath);
  if (!fs.existsSync(target)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as JsonRecord;
  } catch {
    return null;
  }
};

const readOk = (record: JsonRecord | null): boolean | null => {
  if (!record) return null;
  const ok = record.ok;
  return typeof ok === 'boolean' ? ok : null;
};

const normalizeDecision = (review: ReviewPrArtifactLike): PrReviewLoopArtifact['policy_gate']['decision'] => {
  if (review.summary.blocked > 0) return 'blocked';
  if (review.summary.requires_review > 0) return 'requires_review';
  return 'pass';
};

const resolveAutofixEligibility = (remediationStatus: JsonRecord | null): PrReviewLoopArtifact['bounded_autofix_eligibility'] => {
  if (!remediationStatus) {
    return {
      remediation_status_path: '.playbook/remediation-status.json',
      remediation_status_present: false,
      eligible: false,
      reason: 'No remediation-status artifact is present yet.'
    };
  }

  const latestResult = remediationStatus.latest_result;
  const latest = latestResult && typeof latestResult === 'object' && !Array.isArray(latestResult)
    ? (latestResult as JsonRecord)
    : null;
  const finalStatus = typeof latest?.final_status === 'string' ? latest.final_status : null;

  if (finalStatus === 'success' || finalStatus === 'dry_run') {
    return {
      remediation_status_path: '.playbook/remediation-status.json',
      remediation_status_present: true,
      eligible: true,
      reason: `Latest remediation result indicates ${finalStatus}.`
    };
  }

  return {
    remediation_status_path: '.playbook/remediation-status.json',
    remediation_status_present: true,
    eligible: false,
    reason: `Latest remediation result is ${finalStatus ?? 'unknown'}.`
  };
};

export const buildPrReviewLoopArtifact = (
  repoRoot: string,
  input: {
    analysis: AnalyzePullRequestResult;
    review: ReviewPrArtifactLike;
  }
): PrReviewLoopArtifact => {
  const session = readJson(repoRoot, '.playbook/session.json');
  const verify = readJson(repoRoot, '.playbook/verify.json');
  const verifyPreflight = readJson(repoRoot, '.playbook/verify-preflight.json');
  const remediationStatus = readJson(repoRoot, '.playbook/remediation-status.json');

  const policyDecision = normalizeDecision(input.review);
  const escalationState: PrReviewLoopArtifact['escalation']['state'] =
    policyDecision === 'blocked' ? 'blocked' : policyDecision === 'requires_review' ? 'requires_review' : 'none';

  const evidenceRefs: ArtifactRef[] = [
    { path: '.playbook/analyze-pr.json', kind: 'analyze-pr', present: fs.existsSync(path.join(repoRoot, '.playbook/analyze-pr.json')) },
    { path: '.playbook/session.json', kind: 'session', present: Boolean(session) },
    { path: '.playbook/session-evidence.json', kind: 'session-evidence', present: fs.existsSync(path.join(repoRoot, '.playbook/session-evidence.json')) },
    { path: '.playbook/pr-review.json', kind: 'pr-review', present: true },
    { path: '.playbook/policy-evaluation.json', kind: 'policy-evaluation', present: fs.existsSync(path.join(repoRoot, '.playbook/policy-evaluation.json')) },
    { path: '.playbook/policy-apply-result.json', kind: 'policy-apply-result', present: fs.existsSync(path.join(repoRoot, '.playbook/policy-apply-result.json')) },
    { path: '.playbook/plan.json', kind: 'plan', present: fs.existsSync(path.join(repoRoot, '.playbook/plan.json')) },
    { path: '.playbook/receipt.json', kind: 'receipt', present: fs.existsSync(path.join(repoRoot, '.playbook/receipt.json')) },
    { path: '.playbook/remediation-status.json', kind: 'remediation-status', present: Boolean(remediationStatus) },
    { path: '.playbook/verify.json', kind: 'verify', present: Boolean(verify) },
    { path: '.playbook/verify-preflight.json', kind: 'verify-preflight', present: Boolean(verifyPreflight) }
  ].sort((left, right) => left.path.localeCompare(right.path));

  return {
    schemaVersion: '1.0',
    kind: 'pr-review-loop',
    trigger: {
      source: 'analyze-pr',
      normalized: `analyze-pr:${input.analysis.baseRef}`,
      base_ref: input.analysis.baseRef
    },
    session_refs: {
      session_path: '.playbook/session.json',
      session_present: Boolean(session),
      selected_run_id: typeof session?.selectedRunId === 'string' ? session.selectedRunId : null
    },
    hydrated_evidence_refs: evidenceRefs,
    policy_gate: {
      source: '.playbook/pr-review.json',
      safe: input.review.summary.safe,
      requires_review: input.review.summary.requires_review,
      blocked: input.review.summary.blocked,
      decision: policyDecision
    },
    bounded_autofix_eligibility: resolveAutofixEligibility(remediationStatus),
    reverification: {
      verify: { path: '.playbook/verify.json', present: Boolean(verify), ok: readOk(verify) },
      verify_preflight: { path: '.playbook/verify-preflight.json', present: Boolean(verifyPreflight), ok: readOk(verifyPreflight) }
    },
    escalation: {
      state: escalationState,
      next_action:
        escalationState === 'blocked'
          ? 'Escalate to manual reviewer and resolve blocked policy proposals before mutation.'
          : escalationState === 'requires_review'
            ? 'Route proposals requiring review to an owner, then re-run verify and review-pr.'
            : 'No escalation required; continue with bounded remediation and re-verification as needed.'
    }
  };
};

export const writePrReviewLoopArtifact = (repoRoot: string, artifact: PrReviewLoopArtifact): void => {
  const target = path.join(repoRoot, PR_REVIEW_LOOP_ARTIFACT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
};
