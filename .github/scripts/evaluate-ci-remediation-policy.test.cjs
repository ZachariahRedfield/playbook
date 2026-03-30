const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { evaluateCiRemediationPolicy } = require('./evaluate-ci-remediation-policy.cjs');

function createRepo() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-ci-policy-'));
  cp.execFileSync('git', ['init'], { cwd, stdio: 'ignore' });
  fs.writeFileSync(path.join(cwd, 'README.md'), '# temp\n', 'utf8');
  cp.execFileSync('git', ['add', 'README.md'], { cwd, stdio: 'ignore' });
  cp.execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'init'], { cwd, stdio: 'ignore' });
  return cwd;
}

test('blocks repeated autofix attempt for same SHA without explicit override', () => {
  const cwd = createRepo();
  const artifact = evaluateCiRemediationPolicy({
    cwd,
    testExitCode: 1,
    enabled: true,
    requireCleanWorktree: true,
    trustedEvents: 'workflow_dispatch',
    trustedBranches: 'refs/heads/main',
    protectedBranches: '',
    eventName: 'workflow_dispatch',
    ref: 'refs/heads/main',
    sha: 'abc123',
    runAttempt: 2,
    maxAutofixAttemptsPerSha: 1,
    repository: 'owner/repo',
  });

  assert.equal(artifact.status, 'blocked_by_policy');
  assert.equal(artifact.mutation_allowed, false);
  assert.equal(artifact.gating.attempt_limit_reached, true);
  assert.match(artifact.reasons.join('\n'), /per-SHA CI autofix attempt budget/);
});

test('allows retry override to bypass transport-level retry suppression only', () => {
  const cwd = createRepo();
  const artifact = evaluateCiRemediationPolicy({
    cwd,
    testExitCode: 1,
    enabled: true,
    requireCleanWorktree: true,
    trustedEvents: 'workflow_dispatch',
    trustedBranches: 'refs/heads/main',
    protectedBranches: '',
    eventName: 'workflow_dispatch',
    ref: 'refs/heads/main',
    sha: 'abc123',
    runAttempt: 2,
    maxAutofixAttemptsPerSha: 1,
    allowRetryOverride: true,
    repository: 'owner/repo',
  });

  assert.equal(artifact.status, 'allowed');
  assert.equal(artifact.mutation_allowed, true);
  assert.equal(artifact.gating.retry_override_used, true);
  assert.equal(artifact.gating.retry_override_source, 'workflow_input');
  assert.equal(artifact.gating.attempt_limit_reached, true);
});

test('keeps protected branch targets in dry-run mode for pull requests', () => {
  const cwd = createRepo();
  const artifact = evaluateCiRemediationPolicy({
    cwd,
    testExitCode: 1,
    enabled: true,
    requireCleanWorktree: true,
    trustedEvents: 'pull_request',
    trustedBranches: '',
    protectedBranches: 'refs/heads/main',
    eventName: 'pull_request',
    ref: 'refs/pull/42/merge',
    baseRef: 'main',
    sha: 'abc123',
    runAttempt: 1,
    maxAutofixAttemptsPerSha: 1,
    repository: 'owner/repo',
    prHeadRepo: 'owner/repo',
    eventPayload: {
      pull_request: {
        base: { ref: 'main' },
        head: { repo: { full_name: 'owner/repo' } },
        labels: []
      }
    }
  });

  assert.equal(artifact.status, 'allowed');
  assert.equal(artifact.mutation_allowed, true);
  assert.equal(artifact.mode, 'dry_run');
  assert.equal(artifact.gating.protected_target, true);
  assert.equal(artifact.gating.protected_target_source, 'base_ref');
});

test('accepts retry override label from pull request metadata', () => {
  const cwd = createRepo();
  const artifact = evaluateCiRemediationPolicy({
    cwd,
    testExitCode: 1,
    enabled: true,
    requireCleanWorktree: true,
    trustedEvents: 'pull_request',
    trustedBranches: '',
    protectedBranches: '',
    retryOverrideLabels: 'playbook:retry-autofix',
    eventName: 'pull_request',
    ref: 'refs/pull/42/merge',
    sha: 'abc123',
    runAttempt: 2,
    maxAutofixAttemptsPerSha: 1,
    repository: 'owner/repo',
    prHeadRepo: 'owner/repo',
    eventPayload: {
      pull_request: {
        base: { ref: 'main' },
        head: { repo: { full_name: 'owner/repo' } },
        labels: [{ name: 'playbook:retry-autofix' }]
      }
    }
  });

  assert.equal(artifact.status, 'allowed');
  assert.equal(artifact.gating.retry_override_used, true);
  assert.equal(artifact.gating.retry_override_source, 'pull_request_label');
  assert.equal(artifact.gating.retry_override_label, 'playbook:retry-autofix');
});

test('blocks mutation when test-triage classifies infra failure', () => {
  const cwd = createRepo();
  fs.mkdirSync(path.join(cwd, '.playbook'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.playbook', 'test-triage.json'), JSON.stringify({
    failureLayer: 'infra_failure',
    automationEligibility: 'blocked_infra_failure'
  }), 'utf8');

  const artifact = evaluateCiRemediationPolicy({
    cwd,
    testExitCode: 1,
    enabled: true,
    requireCleanWorktree: true,
    trustedEvents: 'workflow_dispatch',
    trustedBranches: 'refs/heads/main',
    protectedBranches: '',
    eventName: 'workflow_dispatch',
    ref: 'refs/heads/main',
    sha: 'abc123',
    runAttempt: 1,
    maxAutofixAttemptsPerSha: 1,
    repository: 'owner/repo',
  });

  assert.equal(artifact.status, 'blocked_by_policy');
  assert.equal(artifact.mutation_allowed, false);
  assert.equal(artifact.triage.failure_layer, 'infra_failure');
  assert.match(artifact.reasons.join('\n'), /infra failure classified by test-triage/);
});
