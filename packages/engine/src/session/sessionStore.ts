import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readExecutionRun } from '../execution/writeExecutionRun.js';

export type SessionPinnedArtifactKind = 'finding' | 'plan' | 'run' | 'pattern' | 'artifact';

export type SessionPinnedArtifact = {
  artifact: string;
  kind: SessionPinnedArtifactKind;
  pinnedAt: string;
};

export type SessionStep = 'verify' | 'plan' | 'apply' | 'resume' | 'idle';

export type SessionEvidenceArtifactKind =
  | 'session'
  | 'run'
  | 'pinned'
  | 'cycle-state'
  | 'cycle-history'
  | 'proposal-candidates'
  | 'policy-evaluation'
  | 'policy-apply-result'
  | 'pr-review';

export type SessionEvidenceArtifactReference = {
  path: string;
  kind: SessionEvidenceArtifactKind;
  present: boolean;
};

export type SessionEvidencePolicyDecision = {
  proposal_id: string;
  decision: 'safe' | 'requires_review' | 'blocked';
  reason: string;
  source: 'policy-evaluation' | 'policy-apply-result';
};

export type SessionEvidenceExecutionResult = {
  executed: string[];
  skipped_requires_review: string[];
  skipped_blocked: string[];
  failed_execution: string[];
};

export type SessionEvidenceLineageReference = {
  order: number;
  stage: 'session' | 'proposal_generation' | 'policy_evaluation' | 'pr_review' | 'execution_result';
  artifact: string;
  present: boolean;
};

export type SessionEvidenceEnvelope = {
  version: 1;
  session_id: string;
  selected_run_id: string | null;
  cycle_id: string | null;
  generated_from_last_updated_time: string;
  artifacts: SessionEvidenceArtifactReference[];
  proposal_ids: string[];
  policy_decisions: SessionEvidencePolicyDecision[];
  execution_result: SessionEvidenceExecutionResult | null;
  lineage: SessionEvidenceLineageReference[];
};

export type SessionEvidenceSourceFingerprint = {
  artifact: string;
  present: boolean;
  fingerprint: string;
};

export type SessionEvidencePinnedRefs = {
  findings: string[];
  plans: string[];
  runs: string[];
  artifacts: string[];
};

export type SessionEvidenceApprovalGovernanceRef = {
  artifact: string;
  present: boolean;
};

export type SessionEvidenceRunRef = {
  run_id: string;
  artifact: string;
  fingerprint: string;
};

export type SessionEvidenceInvalidationState = {
  state: 'fresh' | 'drifted';
  previous_input_fingerprint: string | null;
  current_input_fingerprint: string;
  drifted_sources: string[];
  stale_reasons: string[];
};

export type SessionEvidenceArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-session-evidence';
  session_id: string;
  active_command_lineage: SessionEvidenceLineageReference[];
  pinned_refs: SessionEvidencePinnedRefs;
  approval_governance_refs: SessionEvidenceApprovalGovernanceRef[];
  latest_receipt_refs: string[];
  plan_refs: string[];
  run_refs: SessionEvidenceRunRef[];
  source_artifact_fingerprints: SessionEvidenceSourceFingerprint[];
  invalidation: SessionEvidenceInvalidationState;
  authority: {
    mutation: 'read-only';
    execution: 'unchanged';
  };
};

export type SessionContract = {
  version: 1;
  sessionId: string;
  repoRoot: string;
  activeGoal: string;
  selectedRunId: string | null;
  pinnedArtifacts: SessionPinnedArtifact[];
  currentStep: SessionStep;
  unresolvedQuestions: string[];
  constraints: string[];
  evidenceEnvelope: SessionEvidenceEnvelope;
  lastUpdatedTime: string;
};

export type ResumeSessionResult = {
  session: SessionContract;
  warnings: string[];
  activeRunFound: boolean;
};

export const SESSION_ARTIFACT_RELATIVE_PATH = '.playbook/session.json';
export const SESSION_EVIDENCE_ARTIFACT_RELATIVE_PATH = '.playbook/session-evidence.json';

const CYCLE_STATE_PATH = '.playbook/cycle-state.json' as const;
const CYCLE_HISTORY_PATH = '.playbook/cycle-history.json' as const;
const IMPROVEMENT_CANDIDATES_PATH = '.playbook/improvement-candidates.json' as const;
const POLICY_EVALUATION_PATH = '.playbook/policy-evaluation.json' as const;
const POLICY_APPLY_RESULT_PATH = '.playbook/policy-apply-result.json' as const;
const PR_REVIEW_PATH = '.playbook/pr-review.json' as const;
const VERIFY_PATH = '.playbook/verify.json' as const;
const PLAN_PATH = '.playbook/plan.json' as const;
const VERIFY_PREFLIGHT_PATH = '.playbook/verify-preflight.json' as const;
const RENDEZVOUS_MANIFEST_PATH = '.playbook/rendezvous-manifest.json' as const;
const EXECUTION_RUNS_DIRECTORY_PATH = '.playbook/execution-runs' as const;

const nowIso = (): string => new Date().toISOString();

const resolveSessionPath = (repoRoot: string): string => path.join(repoRoot, SESSION_ARTIFACT_RELATIVE_PATH);

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const stableHash = (value: string): string => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const normalizeList = (entries: string[] | undefined): string[] => {
  if (!entries) {
    return [];
  }

  return [...new Set(entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0))].sort((left, right) => left.localeCompare(right));
};

const normalizeArtifactRef = (repoRoot: string, artifact: string): string => {
  const absolute = path.resolve(repoRoot, artifact);
  const relative = path.relative(repoRoot, absolute);
  if (relative.startsWith('..')) {
    throw new Error(`Pinned artifact must resolve inside repo root: ${artifact}`);
  }
  return relative.split(path.sep).join('/');
};

const inferKind = (artifact: string): SessionPinnedArtifactKind => {
  if (artifact.includes('/runs/') || artifact.endsWith('.run.json')) {
    return 'run';
  }
  if (artifact.includes('plan')) {
    return 'plan';
  }
  if (artifact.includes('find')) {
    return 'finding';
  }
  if (artifact.includes('pattern')) {
    return 'pattern';
  }
  return 'artifact';
};

const readJsonObject = (repoRoot: string, relativePath: string): Record<string, unknown> | null => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const readRecordArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)) : [];


const coerceDecision = (value: unknown): 'safe' | 'requires_review' | 'blocked' =>
  value === 'safe' || value === 'blocked' ? value : 'requires_review';

const listExecutionRunArtifacts = (repoRoot: string): string[] => {
  const root = path.join(repoRoot, EXECUTION_RUNS_DIRECTORY_PATH);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => `${EXECUTION_RUNS_DIRECTORY_PATH}/${entry}`)
    .sort((left, right) => left.localeCompare(right));
};

const readExecutionRunRecords = (repoRoot: string): Array<{ runId: string; artifact: string; payload: Record<string, unknown> }> =>
  listExecutionRunArtifacts(repoRoot).flatMap((artifact) => {
    const absolutePath = path.join(repoRoot, artifact);
    try {
      const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return [];
      }
      const runIdCandidate = (payload as Record<string, unknown>).id;
      const runId = typeof runIdCandidate === 'string' && runIdCandidate.length > 0 ? runIdCandidate : path.basename(artifact, '.json');
      return [{ runId, artifact, payload: payload as Record<string, unknown> }];
    } catch {
      return [];
    }
  });

const extractReceiptRefs = (value: unknown, collector: Set<string>): void => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized.startsWith('.playbook/') && normalized.includes('receipt')) {
      collector.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      extractReceiptRefs(entry, collector);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  for (const entry of Object.values(record)) {
    extractReceiptRefs(entry, collector);
  }
};

const sourceFingerprintFor = (repoRoot: string, artifact: string): SessionEvidenceSourceFingerprint => {
  const absolutePath = path.join(repoRoot, artifact);
  if (!fs.existsSync(absolutePath)) {
    return {
      artifact,
      present: false,
      fingerprint: stableHash(`${artifact}|missing`)
    };
  }

  return {
    artifact,
    present: true,
    fingerprint: stableHash(fs.readFileSync(absolutePath, 'utf8'))
  };
};

const readPriorInputFingerprint = (repoRoot: string): string | null => {
  const absolutePath = path.join(repoRoot, SESSION_EVIDENCE_ARTIFACT_RELATIVE_PATH);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
    const invalidation = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).invalidation : null;
    const fingerprintCandidate = invalidation && typeof invalidation === 'object' ? (invalidation as Record<string, unknown>).current_input_fingerprint : null;
    return typeof fingerprintCandidate === 'string' ? fingerprintCandidate : null;
  } catch {
    return null;
  }
};

const buildSessionEvidenceEnvelope = (repoRoot: string, session: SessionContract): SessionEvidenceEnvelope => {
  const seenArtifacts = new Set<string>();
  const artifacts: SessionEvidenceArtifactReference[] = [];
  const includeArtifact = (artifactPath: string, kind: SessionEvidenceArtifactKind): void => {
    if (seenArtifacts.has(artifactPath)) {
      return;
    }

    seenArtifacts.add(artifactPath);
    artifacts.push({
      path: artifactPath,
      kind,
      present: fs.existsSync(path.join(repoRoot, artifactPath))
    });
  };

  includeArtifact(SESSION_ARTIFACT_RELATIVE_PATH, 'session');
  includeArtifact(CYCLE_STATE_PATH, 'cycle-state');
  includeArtifact(CYCLE_HISTORY_PATH, 'cycle-history');
  includeArtifact(IMPROVEMENT_CANDIDATES_PATH, 'proposal-candidates');
  includeArtifact(POLICY_EVALUATION_PATH, 'policy-evaluation');
  includeArtifact(POLICY_APPLY_RESULT_PATH, 'policy-apply-result');
  includeArtifact(PR_REVIEW_PATH, 'pr-review');

  if (session.selectedRunId) {
    const runArtifactPath = normalizeArtifactRef(repoRoot, path.relative(repoRoot, path.resolve(repoRoot, '.playbook', 'runs', `${session.selectedRunId}.run.json`)));
    includeArtifact(runArtifactPath, 'run');
  }

  for (const pinned of session.pinnedArtifacts) {
    includeArtifact(pinned.artifact, 'pinned');
  }

  const cycleState = readJsonObject(repoRoot, CYCLE_STATE_PATH);
  const improvementCandidates = readJsonObject(repoRoot, IMPROVEMENT_CANDIDATES_PATH);
  const policyEvaluation = readJsonObject(repoRoot, POLICY_EVALUATION_PATH);
  const policyApplyResult = readJsonObject(repoRoot, POLICY_APPLY_RESULT_PATH);

  const proposalIds = readRecordArray(improvementCandidates?.candidates)
    .map((entry) => entry.candidate_id)
    .filter((candidateId): candidateId is string => typeof candidateId === 'string')
    .sort((left, right) => left.localeCompare(right));

  const policyEvaluationDecisions: SessionEvidencePolicyDecision[] = [];
  for (const entry of readRecordArray(policyEvaluation?.evaluations)) {
    const proposalId = entry.proposal_id;
    const reason = entry.reason;
    if (typeof proposalId !== 'string' || typeof reason !== 'string') {
      continue;
    }

    policyEvaluationDecisions.push({
      proposal_id: proposalId,
      decision: coerceDecision(entry.decision),
      reason,
      source: 'policy-evaluation'
    });
  }
  policyEvaluationDecisions.sort((left, right) => left.proposal_id.localeCompare(right.proposal_id));

  const flattenApplyIds = (field: unknown): string[] =>
    readRecordArray(field)
      .map((entry) => entry.proposal_id)
      .filter((proposalId): proposalId is string => typeof proposalId === 'string')
      .sort((left, right) => left.localeCompare(right));

  const executionResult: SessionEvidenceExecutionResult | null = policyApplyResult
    ? {
        executed: flattenApplyIds(policyApplyResult.executed),
        skipped_requires_review: flattenApplyIds(policyApplyResult.skipped_requires_review),
        skipped_blocked: flattenApplyIds(policyApplyResult.skipped_blocked),
        failed_execution: flattenApplyIds(policyApplyResult.failed_execution)
      }
    : null;

  const applyPolicyDecisions: SessionEvidencePolicyDecision[] = [];
  if (policyApplyResult) {
    for (const field of ['executed', 'skipped_requires_review', 'skipped_blocked', 'failed_execution'] as const) {
      for (const entry of readRecordArray(policyApplyResult[field])) {
        const proposalId = entry.proposal_id;
        const reason = entry.reason;
        if (typeof proposalId !== 'string' || typeof reason !== 'string') {
          continue;
        }

        applyPolicyDecisions.push({
          proposal_id: proposalId,
          decision: coerceDecision(entry.decision),
          reason,
          source: 'policy-apply-result'
        });
      }
    }
    applyPolicyDecisions.sort((left, right) => left.proposal_id.localeCompare(right.proposal_id));
  }

  const policyDecisions = [...policyEvaluationDecisions, ...applyPolicyDecisions].sort((left, right) => {
    const proposalDelta = left.proposal_id.localeCompare(right.proposal_id);
    if (proposalDelta !== 0) {
      return proposalDelta;
    }
    return left.source.localeCompare(right.source);
  });

  const lineageCandidates: Array<{ stage: SessionEvidenceLineageReference['stage']; artifact: string }> = [
    { stage: 'session', artifact: SESSION_ARTIFACT_RELATIVE_PATH },
    { stage: 'proposal_generation', artifact: IMPROVEMENT_CANDIDATES_PATH },
    { stage: 'policy_evaluation', artifact: POLICY_EVALUATION_PATH },
    { stage: 'pr_review', artifact: PR_REVIEW_PATH },
    { stage: 'execution_result', artifact: POLICY_APPLY_RESULT_PATH }
  ];

  const lineage = lineageCandidates
    .map((entry, index) => ({
      order: index + 1,
      stage: entry.stage,
      artifact: entry.artifact,
      present: fs.existsSync(path.join(repoRoot, entry.artifact))
    }))
    .sort((left, right) => left.order - right.order);

  return {
    version: 1,
    session_id: session.sessionId,
    selected_run_id: session.selectedRunId,
    cycle_id: typeof cycleState?.cycle_id === 'string' ? cycleState.cycle_id : null,
    generated_from_last_updated_time: session.lastUpdatedTime,
    artifacts: artifacts.sort((left, right) => left.path.localeCompare(right.path)),
    proposal_ids: proposalIds,
    policy_decisions: policyDecisions,
    execution_result: executionResult,
    lineage
  };
};

const buildSessionEvidenceArtifact = (repoRoot: string, session: SessionContract): SessionEvidenceArtifact => {
  const runRecords = readExecutionRunRecords(repoRoot);
  const runRefs: SessionEvidenceRunRef[] = runRecords.map((entry) => ({
    run_id: entry.runId,
    artifact: entry.artifact,
    fingerprint: stableHash(JSON.stringify(entry.payload))
  }));

  const pinned = session.pinnedArtifacts.map((entry) => entry.artifact).sort((left, right) => left.localeCompare(right));
  const pinnedRefs: SessionEvidencePinnedRefs = {
    findings: session.pinnedArtifacts.filter((entry) => entry.kind === 'finding').map((entry) => entry.artifact).sort((left, right) => left.localeCompare(right)),
    plans: session.pinnedArtifacts.filter((entry) => entry.kind === 'plan').map((entry) => entry.artifact).sort((left, right) => left.localeCompare(right)),
    runs: session.pinnedArtifacts.filter((entry) => entry.kind === 'run').map((entry) => entry.artifact).sort((left, right) => left.localeCompare(right)),
    artifacts: pinned
  };

  const approvalGovernanceRefs: SessionEvidenceApprovalGovernanceRef[] = [VERIFY_PREFLIGHT_PATH, RENDEZVOUS_MANIFEST_PATH]
    .map((artifact) => ({
      artifact,
      present: fs.existsSync(path.join(repoRoot, artifact))
    }))
    .sort((left, right) => left.artifact.localeCompare(right.artifact));

  const receiptRefs = new Set<string>();
  for (const run of runRecords) {
    extractReceiptRefs(run.payload, receiptRefs);
  }

  const selectedRunMissing = Boolean(
    session.selectedRunId &&
      !runRefs.some((entry) => entry.run_id === session.selectedRunId)
  );
  const missingPinned = session.pinnedArtifacts
    .map((entry) => entry.artifact)
    .filter((artifact) => !fs.existsSync(path.join(repoRoot, artifact)))
    .sort((left, right) => left.localeCompare(right));

  const sourceArtifacts = [
    SESSION_ARTIFACT_RELATIVE_PATH,
    VERIFY_PATH,
    PLAN_PATH,
    ...runRefs.map((entry) => entry.artifact),
    VERIFY_PREFLIGHT_PATH,
    RENDEZVOUS_MANIFEST_PATH
  ].sort((left, right) => left.localeCompare(right));

  const sourceArtifactFingerprints = sourceArtifacts.map((artifact) => sourceFingerprintFor(repoRoot, artifact));
  const currentInputFingerprint = stableHash(JSON.stringify(sourceArtifactFingerprints));
  const previousInputFingerprint = readPriorInputFingerprint(repoRoot);
  const driftedSources = previousInputFingerprint && previousInputFingerprint !== currentInputFingerprint ? sourceArtifactFingerprints.map((entry) => entry.artifact) : [];

  const staleReasons = [
    ...(selectedRunMissing ? ['selected-run-missing'] : []),
    ...missingPinned.map((artifact) => `missing-pinned:${artifact}`)
  ].sort((left, right) => left.localeCompare(right));

  const invalidation: SessionEvidenceInvalidationState = {
    state: previousInputFingerprint !== null && previousInputFingerprint !== currentInputFingerprint ? 'drifted' : 'fresh',
    previous_input_fingerprint: previousInputFingerprint,
    current_input_fingerprint: currentInputFingerprint,
    drifted_sources: driftedSources,
    stale_reasons: staleReasons
  };

  return {
    schemaVersion: '1.0',
    kind: 'playbook-session-evidence',
    session_id: session.sessionId,
    active_command_lineage: [...session.evidenceEnvelope.lineage].sort((left, right) => left.order - right.order),
    pinned_refs: pinnedRefs,
    approval_governance_refs: approvalGovernanceRefs,
    latest_receipt_refs: [...receiptRefs].sort((left, right) => left.localeCompare(right)),
    plan_refs: [PLAN_PATH, ...pinnedRefs.plans].sort((left, right) => left.localeCompare(right)),
    run_refs: runRefs.sort((left, right) => left.artifact.localeCompare(right.artifact)),
    source_artifact_fingerprints: sourceArtifactFingerprints,
    invalidation,
    authority: {
      mutation: 'read-only',
      execution: 'unchanged'
    }
  };
};

const writeSession = (repoRoot: string, session: SessionContract): SessionContract => {
  const hydratedSession: SessionContract = {
    ...session,
    evidenceEnvelope: buildSessionEvidenceEnvelope(repoRoot, session)
  };

  const artifactPath = resolveSessionPath(repoRoot);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, deterministicStringify(hydratedSession), 'utf8');
  const sessionEvidence = buildSessionEvidenceArtifact(repoRoot, hydratedSession);
  fs.writeFileSync(path.join(repoRoot, SESSION_EVIDENCE_ARTIFACT_RELATIVE_PATH), deterministicStringify(sessionEvidence), 'utf8');
  return hydratedSession;
};

const buildSessionId = (repoRoot: string): string => {
  const seed = Buffer.from(path.resolve(repoRoot)).toString('base64url').slice(0, 10);
  return `session-${seed}`;
};

export const readSession = (repoRoot: string): SessionContract | null => {
  const artifactPath = resolveSessionPath(repoRoot);
  if (!fs.existsSync(artifactPath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as SessionContract;
  if (!parsed || parsed.version !== 1) {
    throw new Error(`Invalid session artifact at ${artifactPath}`);
  }

  return parsed;
};

export const initializeSession = (
  repoRoot: string,
  seed?: Partial<Pick<SessionContract, 'activeGoal' | 'selectedRunId' | 'constraints' | 'unresolvedQuestions' | 'currentStep'>>
): SessionContract => {
  const timestamp = nowIso();
  return writeSession(repoRoot, {
    version: 1,
    sessionId: buildSessionId(repoRoot),
    repoRoot: path.resolve(repoRoot),
    activeGoal: seed?.activeGoal?.trim() || 'deterministic workflow continuity',
    selectedRunId: seed?.selectedRunId ?? null,
    pinnedArtifacts: [],
    currentStep: seed?.currentStep ?? 'idle',
    unresolvedQuestions: normalizeList(seed?.unresolvedQuestions),
    constraints: normalizeList(seed?.constraints),
    evidenceEnvelope: {
      version: 1,
      session_id: buildSessionId(repoRoot),
      selected_run_id: seed?.selectedRunId ?? null,
      cycle_id: null,
      generated_from_last_updated_time: timestamp,
      artifacts: [],
      proposal_ids: [],
      policy_decisions: [],
      execution_result: null,
      lineage: []
    },
    lastUpdatedTime: timestamp
  });
};

export const updateSession = (
  repoRoot: string,
  patch: Partial<Pick<SessionContract, 'activeGoal' | 'selectedRunId' | 'currentStep' | 'constraints' | 'unresolvedQuestions'>>
): SessionContract => {
  const current = readSession(repoRoot) ?? initializeSession(repoRoot);
  const next: SessionContract = {
    ...current,
    activeGoal: patch.activeGoal?.trim() || current.activeGoal,
    selectedRunId: patch.selectedRunId === undefined ? current.selectedRunId : patch.selectedRunId,
    currentStep: patch.currentStep ?? current.currentStep,
    unresolvedQuestions: patch.unresolvedQuestions ? normalizeList(patch.unresolvedQuestions) : current.unresolvedQuestions,
    constraints: patch.constraints ? normalizeList(patch.constraints) : current.constraints,
    lastUpdatedTime: nowIso()
  };

  return writeSession(repoRoot, next);
};

export const pinSessionArtifact = (
  repoRoot: string,
  artifact: string,
  kind?: SessionPinnedArtifactKind
): SessionContract => {
  const current = readSession(repoRoot) ?? initializeSession(repoRoot);
  const normalized = normalizeArtifactRef(repoRoot, artifact);
  const nextPinned: SessionPinnedArtifact[] = [
    ...current.pinnedArtifacts.filter((entry) => entry.artifact !== normalized),
    {
      artifact: normalized,
      kind: kind ?? inferKind(normalized),
      pinnedAt: nowIso()
    }
  ].sort((left, right) => left.artifact.localeCompare(right.artifact));

  return writeSession(repoRoot, {
    ...current,
    pinnedArtifacts: nextPinned,
    lastUpdatedTime: nowIso()
  });
};

export const clearSession = (repoRoot: string): boolean => {
  const artifactPath = resolveSessionPath(repoRoot);
  if (!fs.existsSync(artifactPath)) {
    return false;
  }
  fs.rmSync(artifactPath, { force: true });
  return true;
};

export const resumeSession = (repoRoot: string): ResumeSessionResult => {
  const session = readSession(repoRoot);
  if (!session) {
    throw new Error('No repo-scoped session found. Run `playbook session show` or `playbook session pin <artifact>` first.');
  }

  const warnings: string[] = [];
  for (const artifact of session.pinnedArtifacts) {
    const absolute = path.resolve(repoRoot, artifact.artifact);
    if (!fs.existsSync(absolute)) {
      warnings.push(`Missing pinned artifact: ${artifact.artifact}`);
    }
  }

  let activeRunFound = false;
  if (session.selectedRunId) {
    try {
      readExecutionRun(repoRoot, session.selectedRunId);
      activeRunFound = true;
    } catch {
      warnings.push(`Selected run not found: ${session.selectedRunId}`);
    }
  }

  const refreshed = updateSession(repoRoot, { currentStep: 'resume' });
  return {
    session: refreshed,
    warnings,
    activeRunFound
  };
};

export const attachSessionRunState = (
  repoRoot: string,
  input: {
    step: SessionStep;
    runId: string;
    goal?: string;
    artifacts?: Array<{ artifact: string; kind?: SessionPinnedArtifactKind }>;
  }
): SessionContract => {
  const session = updateSession(repoRoot, {
    currentStep: input.step,
    selectedRunId: input.runId,
    activeGoal: input.goal
  });

  let next = session;
  for (const artifact of input.artifacts ?? []) {
    next = pinSessionArtifact(repoRoot, artifact.artifact, artifact.kind);
  }

  return next;
};

export const sessionArtifactPath = (repoRoot: string): string => resolveSessionPath(repoRoot);
export const sessionEvidenceArtifactPath = (repoRoot: string): string => path.join(repoRoot, SESSION_EVIDENCE_ARTIFACT_RELATIVE_PATH);
