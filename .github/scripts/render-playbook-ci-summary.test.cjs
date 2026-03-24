const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildSummary, renderMarkdown, readJsonArtifact } = require('./render-playbook-ci-summary.cjs');

test('buildSummary renders compact success summary with verify, release, and merge-guard sections', () => {
  const summary = buildSummary({
    verify: {
      ok: true,
      findings: [
        {
          id: 'protected-doc.governance',
          evidence: 'decision=pass; status=clear; affected_surfaces=none; blockers=none; next_action=No protected-doc action required.'
        }
      ],
      nextActions: ['No verify follow-up required.']
    },
    releasePlan: {
      summary: { recommendedBump: 'minor' },
      packages: [{ name: '@scope/alpha', currentVersion: '1.2.3', recommendedBump: 'minor' }],
      versionGroups: []
    },
    verifyArtifactPath: '.playbook/verify-preflight.json',
    releaseArtifactPath: '.playbook/release-plan.json',
    remediationPolicy: null,
    remediationPolicyArtifactPath: '.playbook/ci-remediation-policy.json',
    failureSummary: null,
    failureSummaryArtifactPath: '.playbook/failure-summary.json',
    remediationStatus: null,
    remediationStatusArtifactPath: '.playbook/remediation-status.json',
  });

  assert.equal(summary.overall.status, 'clear');
  assert.equal(summary.verify.status, 'PASS');
  assert.equal(summary.release.recommendedBump, 'minor');
  assert.equal(summary.mergeGuard.status, 'clear');
  assert.equal(summary.remediation, null);
});

test('buildSummary includes remediation only when a test failure artifact exists', () => {
  const summary = buildSummary({
    verify: {
      ok: false,
      findings: [{ id: 'rule.test', level: 'error', message: 'tests failed' }],
      nextActions: ['Run pnpm test after remediation.']
    },
    releasePlan: null,
    verifyArtifactPath: '.playbook/verify.json',
    releaseArtifactPath: '.playbook/release-plan.json',
    remediationPolicy: {
      status: 'blocked_by_policy',
      reasons: ['autofix disabled by workflow input'],
    },
    remediationPolicyArtifactPath: '.playbook/ci-remediation-policy.json',
    failureSummary: {
      primaryFailureClass: 'vitest_assertion',
      summary: { totalFailures: 3 },
    },
    failureSummaryArtifactPath: '.playbook/failure-summary.json',
    remediationStatus: {
      latest_run: {
        final_status: 'blocked_low_confidence',
        retry_policy_decision: 'hold',
        preferred_repair_class: 'snapshot_refresh',
      }
    },
    remediationStatusArtifactPath: '.playbook/remediation-status.json',
  });

  assert.equal(summary.overall.status, 'blocked · test failure');
  assert.equal(summary.remediation.status, 'blocked_low_confidence');
  assert.equal(summary.remediation.failureClass, 'vitest_assertion');
  assert.equal(summary.remediation.failureCount, 3);
  assert.equal(summary.remediation.nextAction, 'autofix disabled by workflow input');
});

test('renderMarkdown uses one compact operator brief', () => {
  const markdown = renderMarkdown({
    overall: { decision: 'verify blocked', status: 'blocked · test failure' },
    verify: { status: 'FAIL', blockers: ['rule.test: tests failed'], nextAction: 'Run pnpm test after remediation.' },
    mergeGuard: { decision: 'fail_closed', status: 'merge guard blocked', blockers: ['lane:docs'], nextAction: 'Resolve docs lane.' },
    release: { recommendedBump: 'patch', status: 'release plan ready', currentVersion: '1.2.3', nextVersion: '1.2.4', affected: '@scope/alpha' },
    remediation: { status: 'blocked_low_confidence', failureClass: 'vitest_assertion', failureCount: 2, retryDecision: 'hold', preferredRepairClass: 'snapshot_refresh', nextAction: 'Manual review required.' },
    firstFailure: { file: 'packages/core/test/foo.test.ts', test: 'matches expected output', message: 'expected 2 to equal 3' },
    artifacts: ['.playbook/verify.json', '.playbook/release-plan.json', '.playbook/ci-remediation-policy.json', '.playbook/failure-summary.json', '.playbook/remediation-status.json', '.playbook/first-test-failure.json'],
  }, { marker: '<!-- marker -->', title: 'Playbook CI Summary' });

  assert.match(markdown, /Overall decision \/ status \| verify blocked \/ blocked · test failure/);
  assert.match(markdown, /Verify blockers \| rule\.test: tests failed/);
  assert.match(markdown, /Merge guard \| fail_closed \/ merge guard blocked/);
  assert.match(markdown, /Release bump \| patch \/ release plan ready/);
  assert.match(markdown, /Remediation \| blocked_low_confidence/);
  assert.match(markdown, /First failing suite \| packages\/core\/test\/foo\.test\.ts/);
  assert.match(markdown, /Artifacts: `\.playbook\/verify\.json`, `\.playbook\/release-plan\.json`/);
});

test('readJsonArtifact reports path+preview for malformed JSON and degrades for non-critical artifacts', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-ci-summary-'));
  const artifactPath = path.join(tempDir, 'bad-artifact.json');
  fs.writeFileSync(artifactPath, '> playbook-monorepo@0.1.8 playbook\n{ "ok": true }\n', 'utf8');

  const warningLogs = [];
  const warn = console.warn;
  console.warn = (message) => warningLogs.push(String(message));

  const optionalArtifact = readJsonArtifact(artifactPath, { required: false, label: '.playbook/failure-summary.json' });
  console.warn = warn;
  assert.equal(optionalArtifact, null);
  assert.match(warningLogs[0], /Invalid JSON artifact at \.playbook\/failure-summary\.json/);
  assert.match(warningLogs[0], /preview=/);

  assert.throws(
    () => readJsonArtifact(artifactPath, { required: true, label: '.playbook/verify.json' }),
    /Invalid JSON artifact at \.playbook\/verify\.json/
  );
});

test('readJsonArtifact unwraps Playbook artifact envelopes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-ci-summary-'));
  const artifactPath = path.join(tempDir, 'verify.json');
  fs.writeFileSync(
    artifactPath,
    JSON.stringify({ artifact: 'playbook.findings', data: { command: 'verify', ok: true, findings: [] } }),
    'utf8'
  );

  const parsed = readJsonArtifact(artifactPath, { required: true, label: '.playbook/verify.json' });
  assert.deepEqual(parsed, { command: 'verify', ok: true, findings: [] });
});
