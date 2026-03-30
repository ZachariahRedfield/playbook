const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeBranchRef(value) {
  if (!value) return null;
  return value.startsWith('refs/') ? value : `refs/heads/${value}`;
}

function readGitHubEvent(eventPath) {
  if (!eventPath || !fs.existsSync(eventPath)) return {};
  return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
}

function readTriageArtifact(cwd) {
  const triagePath = path.join(cwd, '.playbook', 'test-triage.json');
  if (!fs.existsSync(triagePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(triagePath, 'utf8'));
  } catch {
    return null;
  }
}

function detectCleanWorktree(cwd) {
  try {
    cp.execFileSync('git', ['update-index', '-q', '--refresh'], { cwd, stdio: 'ignore' });
    cp.execFileSync('git', ['diff', '--quiet'], { cwd, stdio: 'ignore' });
    cp.execFileSync('git', ['diff', '--cached', '--quiet'], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function evaluateCiRemediationPolicy(input) {
  const cwd = input.cwd || process.cwd();
  const event = input.eventPayload || {};
  const testExitCode = Number(input.testExitCode || 0);
  const enabled = Boolean(input.enabled);
  const requireCleanWorktree = Boolean(input.requireCleanWorktree);
  const trustedEvents = splitCsv(input.trustedEvents);
  const trustedBranches = splitCsv(input.trustedBranches).map(normalizeBranchRef).filter(Boolean);
  const protectedBranches = splitCsv(input.protectedBranches).map(normalizeBranchRef).filter(Boolean);
  const retryOverrideLabels = splitCsv(input.retryOverrideLabels);
  const confidenceThreshold = String(input.confidenceThreshold || '0.7');
  const repository = String(input.repository || '');
  const eventName = String(input.eventName || '');
  const ref = String(input.ref || '');
  const sha = String(input.sha || '');
  const runAttempt = Number(input.runAttempt || 1);
  const maxAutofixAttemptsPerSha = Number(input.maxAutofixAttemptsPerSha || 1);
  const allowRetryOverride = Boolean(input.allowRetryOverride);
  const prHeadRepo = String(input.prHeadRepo || event.pull_request?.head?.repo?.full_name || '');
  const baseRef = normalizeBranchRef(String(input.baseRef || event.pull_request?.base?.ref || ''));
  const pullRequestLabels = Array.isArray(event.pull_request?.labels)
    ? event.pull_request.labels.map((label) => label?.name).filter((label) => typeof label === 'string' && label.length > 0)
    : [];
  const overrideLabel = pullRequestLabels.find((label) => retryOverrideLabels.includes(label)) || null;
  const overrideUsed = allowRetryOverride || Boolean(overrideLabel);
  const triageArtifact = readTriageArtifact(cwd);
  const triageFailureLayer = String(triageArtifact?.failureLayer || 'unknown');
  const triageAutomationEligibility = String(triageArtifact?.automationEligibility || 'not_applicable');

  const reasons = [];
  const cleanWorktree = detectCleanWorktree(cwd);
  const trustedEvent = trustedEvents.includes(eventName);
  const trustedBranch = eventName !== 'push' || trustedBranches.includes(normalizeBranchRef(ref));
  const trustedPrSource = eventName !== 'pull_request' || (prHeadRepo && prHeadRepo === repository);
  const currentRefProtected = protectedBranches.includes(normalizeBranchRef(ref));
  const baseRefProtected = baseRef ? protectedBranches.includes(baseRef) : false;
  const protectedTarget = currentRefProtected || baseRefProtected;
  const attemptLimitReached = runAttempt > maxAutofixAttemptsPerSha;

  let status = 'not_needed';
  let mutationAllowed = false;
  let mode = 'apply';

  if (testExitCode !== 0) {
    if (triageFailureLayer === 'infra_failure' || triageAutomationEligibility === 'blocked_infra_failure') {
      reasons.push('infra failure classified by test-triage; remediation mutation is intentionally disabled');
    }
    if (triageFailureLayer === 'governance_failure' || triageAutomationEligibility === 'blocked_governance_failure') {
      reasons.push('governance failure classified by test-triage; run governance fixes before remediation mutation');
    }
    if (!enabled) reasons.push('autofix disabled by workflow input');
    if (!trustedEvent) reasons.push(`event ${eventName || '(unknown)'} is not in trusted-autofix-events`);
    if (!trustedBranch) reasons.push(`ref ${ref || '(unknown)'} is not in trusted-autofix-branches`);
    if (!trustedPrSource) reasons.push('pull_request head repository is untrusted for CI mutation');
    if (requireCleanWorktree && !cleanWorktree) reasons.push('worktree is not clean before CI autofix mutation');
    if (attemptLimitReached && !overrideUsed) {
      reasons.push(`commit ${sha || '(unknown sha)'} already consumed the per-SHA CI autofix attempt budget (${maxAutofixAttemptsPerSha}) for this workflow lifecycle; rerun blocked unless an explicit retry override is supplied`);
    }

    mutationAllowed = enabled
      && trustedEvent
      && trustedBranch
      && trustedPrSource
      && (!requireCleanWorktree || cleanWorktree)
      && (!attemptLimitReached || overrideUsed)
      && triageFailureLayer !== 'infra_failure'
      && triageFailureLayer !== 'governance_failure';
    status = mutationAllowed ? 'allowed' : 'blocked_by_policy';

    if (protectedTarget) {
      mode = 'dry_run';
    }
  }

  return {
    schemaVersion: '1.0',
    kind: 'ci-remediation-policy',
    generatedAt: new Date().toISOString(),
    status,
    mutation_allowed: mutationAllowed,
    test_exit_code: testExitCode,
    enabled,
    mode,
    confidence_threshold: confidenceThreshold,
    gating: {
      event_name: eventName,
      ref,
      sha,
      base_ref: baseRef,
      trusted_events: trustedEvents,
      trusted_branches: trustedBranches,
      protected_branches: protectedBranches,
      trusted_event: trustedEvent,
      trusted_branch: trustedBranch,
      trusted_pull_request_source: trustedPrSource,
      require_clean_worktree: requireCleanWorktree,
      clean_worktree: cleanWorktree,
      run_attempt: runAttempt,
      max_autofix_attempts_per_sha: maxAutofixAttemptsPerSha,
      attempt_limit_reached: attemptLimitReached,
      retry_override_labels: retryOverrideLabels,
      retry_override_used: overrideUsed,
      retry_override_source: allowRetryOverride ? 'workflow_input' : (overrideLabel ? 'pull_request_label' : 'none'),
      retry_override_label: overrideLabel,
      protected_target: protectedTarget,
      protected_target_source: currentRefProtected ? 'ref' : (baseRefProtected ? 'base_ref' : 'none')
    },
    triage: {
      failure_layer: triageFailureLayer,
      automation_eligibility: triageAutomationEligibility
    },
    reasons,
    artifact_paths: {
      failure_log_path: '.playbook/ci-failure.log',
      policy_path: '.playbook/ci-remediation-policy.json',
      triage_path: '.playbook/test-triage.json',
      fix_plan_path: '.playbook/test-fix-plan.json',
      apply_path: '.playbook/test-autofix-apply.json',
      autofix_result_path: '.playbook/test-autofix.json',
      remediation_history_path: '.playbook/test-autofix-history.json',
      remediation_status_path: '.playbook/remediation-status.json',
      remediation_comment_path: '.playbook/remediation-comment.md'
    }
  };
}

function writeArtifact(cwd, artifact) {
  const outPath = path.join(cwd, '.playbook', 'ci-remediation-policy.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  return outPath;
}

function readInputFromEnv(env = process.env) {
  const eventPayload = readGitHubEvent(env.GITHUB_EVENT_PATH);
  return {
    cwd: process.cwd(),
    eventPayload,
    testExitCode: Number(env.PLAYBOOK_TEST_EXIT_CODE || '0'),
    enabled: toBoolean(env.PLAYBOOK_AUTOFIX_ENABLED, false),
    requireCleanWorktree: toBoolean(env.PLAYBOOK_REQUIRE_CLEAN_WORKTREE, true),
    trustedEvents: env.PLAYBOOK_TRUSTED_AUTOFIX_EVENTS || '',
    trustedBranches: env.PLAYBOOK_TRUSTED_AUTOFIX_BRANCHES || '',
    protectedBranches: env.PLAYBOOK_PROTECTED_BRANCHES || '',
    retryOverrideLabels: env.PLAYBOOK_RETRY_OVERRIDE_LABELS || '',
    confidenceThreshold: env.PLAYBOOK_AUTOFIX_CONFIDENCE_THRESHOLD || '0.7',
    repository: env.GITHUB_REPOSITORY || '',
    eventName: env.GITHUB_EVENT_NAME || '',
    ref: env.GITHUB_REF || '',
    sha: env.GITHUB_SHA || '',
    baseRef: env.GITHUB_BASE_REF || '',
    prHeadRepo: env.GITHUB_EVENT_PULL_REQUEST_HEAD_REPO_FULL_NAME || '',
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT || '1'),
    maxAutofixAttemptsPerSha: Number(env.PLAYBOOK_MAX_AUTOFIX_ATTEMPTS_PER_SHA || '1'),
    allowRetryOverride: toBoolean(env.PLAYBOOK_ALLOW_AUTOFIX_RETRY_OVERRIDE, false)
  };
}

if (require.main === module) {
  const input = readInputFromEnv(process.env);
  const artifact = evaluateCiRemediationPolicy(input);
  writeArtifact(input.cwd, artifact);
  console.log(`status=${artifact.status}`);
  console.log(`mutation_allowed=${artifact.mutation_allowed}`);
  console.log(`mode=${artifact.mode}`);
  if (artifact.gating.retry_override_used) {
    console.log(`retry_override=${artifact.gating.retry_override_source}`);
  }
  if (artifact.status === 'blocked_by_policy') {
    console.log(`blocked_reasons=${artifact.reasons.join('; ') || '(none recorded)'}`);
  }
}

module.exports = {
  detectCleanWorktree,
  evaluateCiRemediationPolicy,
  normalizeBranchRef,
  readGitHubEvent,
  readInputFromEnv,
  splitCsv,
  toBoolean,
  writeArtifact,
};
