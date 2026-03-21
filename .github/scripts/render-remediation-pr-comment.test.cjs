const test = require('node:test');
const assert = require('node:assert/strict');
const { renderRemediationComment } = require('./render-remediation-pr-comment.cjs');

test('renderRemediationComment renders canonical artifact fields from autofix and remediation-status artifacts', () => {
  const body = renderRemediationComment({
    policy: {
      status: 'allowed',
      mutation_allowed: true,
      reasons: [],
      artifact_paths: {
        failure_log_path: '.playbook/ci-failure.log',
        policy_path: '.playbook/ci-remediation-policy.json',
        autofix_result_path: '.playbook/test-autofix.json',
        remediation_status_path: '.playbook/remediation-status.json',
      },
      gating: {
        run_attempt: 1,
        max_autofix_attempts_per_sha: 1,
        retry_override_used: false,
        retry_override_source: 'none',
      },
    },
    autofix: {
      final_status: 'blocked_low_confidence',
      mode: 'dry_run',
      would_apply: false,
      confidence_threshold: 0.7,
      autofix_confidence: 0.62,
      confidence_reasoning: ['reason-1', 'reason-2'],
      retry_policy_decision: 'allow_with_preferred_repair_class',
      preferred_repair_class: 'snapshot_refresh',
      applied_task_ids: ['task-a', 'task-b'],
      stop_reasons: ['blocked for confidence'],
      apply_result: { attempted: false, ok: false },
      verification_result: { attempted: false, ok: false },
      source_triage: { path: '.playbook/test-triage.json' },
      source_fix_plan: { path: '.playbook/test-fix-plan.json' },
      source_apply: { path: null },
      remediation_history_path: '.playbook/test-autofix-history.json',
    },
    remediationStatus: {
      blocked_signatures: ['sig-a'],
      review_required_signatures: ['sig-b'],
      latest_run: { mode: 'dry_run' }
    },
  });

  assert.match(body, /Final status \| blocked_low_confidence/);
  assert.match(body, /Mode \| dry_run/);
  assert.match(body, /Retry override \| not_used/);
  assert.match(body, /Attempt budget \| 1\/1/);
  assert.match(body, /Autofix confidence \| 0\.62/);
  assert.match(body, /Low-confidence skip \| yes/);
  assert.match(body, /reason-1; reason-2/);
  assert.match(body, /task-a/);
  assert.match(body, /sig-a/);
  assert.match(body, /\.playbook\/test-autofix-history\.json/);
});

test('renderRemediationComment surfaces blocked-by-policy state when mutation gates fail closed', () => {
  const body = renderRemediationComment({
    policy: {
      status: 'blocked_by_policy',
      mutation_allowed: false,
      reasons: ['autofix disabled by workflow input'],
      artifact_paths: {
        failure_log_path: '.playbook/ci-failure.log',
        policy_path: '.playbook/ci-remediation-policy.json',
      },
      gating: {
        run_attempt: 2,
        max_autofix_attempts_per_sha: 1,
        retry_override_used: false,
        retry_override_source: 'none',
      },
    },
    autofix: null,
    remediationStatus: null,
  });

  assert.match(body, /Final status \| blocked_by_policy/);
  assert.match(body, /Mutation gate \| blocked/);
  assert.match(body, /autofix disabled by workflow input/);
  assert.match(body, /failure_log/);
});


test('renderRemediationComment shows retry override provenance when CI transport suppression was bypassed', () => {
  const body = renderRemediationComment({
    policy: {
      status: 'allowed',
      mutation_allowed: true,
      reasons: ['explicit retry override accepted'],
      gating: {
        run_attempt: 2,
        max_autofix_attempts_per_sha: 1,
        retry_override_used: true,
        retry_override_source: 'pull_request_label',
      },
      artifact_paths: {
        failure_log_path: '.playbook/ci-failure.log',
        policy_path: '.playbook/ci-remediation-policy.json',
      },
    },
    autofix: null,
    remediationStatus: null,
  });

  assert.match(body, /Retry override \| pull_request_label/);
  assert.match(body, /Attempt budget \| 2\/1/);
  assert.match(body, /explicit retry override accepted/);
});
