const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCiSummary,
  renderMarkdown,
} = require('./render-playbook-ci-summary.cjs');

test('buildCiSummary compacts successful verify, release, and merge-guard signals without remediation', () => {
  const summary = buildCiSummary({
    verify: {
      ok: true,
      findings: [
        {
          id: 'protected-doc.consolidation.blocked',
          evidence: 'decision=pass; status=clear; affected_surfaces=docs/CHANGELOG.md; blockers=none; next_action=No merge-guard action required.'
        }
      ],
      nextActions: ['No action required.']
    },
    releasePlan: {
      summary: { recommendedBump: 'minor' },
      packages: [
        { name: '@scope/alpha', currentVersion: '1.2.3', recommendedBump: 'minor' },
        { name: '@scope/beta', currentVersion: '1.2.3', recommendedBump: 'minor' },
      ],
      versionGroups: [{ name: 'lockstep', packages: ['@scope/alpha', '@scope/beta'], recommendedBump: 'minor' }],
    },
    remediationPolicy: { status: 'not_needed', mode: 'apply' },
    failureSummary: null,
    remediationStatus: null,
  });

  assert.deepEqual(summary.overall, {
    decision: 'pass_with_release_plan',
    status: 'release plan ready',
  });
  assert.equal(summary.verify.decision, 'pass');
  assert.equal(summary.release.recommendedBump, 'minor');
  assert.equal(summary.mergeGuard.status, 'clear');
  assert.equal(summary.remediation, null);
});

test('buildCiSummary includes remediation only when a test failure artifact exists', () => {
  const summary = buildCiSummary({
    verify: {
      ok: false,
      findings: [{ id: 'verify.docs', level: 'error', message: 'Docs drift detected.' }],
      nextActions: ['Refresh docs artifacts.']
    },
    releasePlan: null,
    remediationPolicy: {
      status: 'blocked_by_policy',
      mode: 'dry_run',
    },
    failureSummary: {
      status: 'failed',
      summary: 'Vitest reported snapshot drift.',
      primaryFailureClass: 'snapshot_drift',
      recommendedNextChecks: ['Inspect snapshot files before retrying.']
    },
    remediationStatus: {
      blocked_signatures: ['sig-a'],
      review_required_signatures: ['sig-b'],
      latest_run: {
        mode: 'dry_run',
        retry_policy_decision: 'blocked_repeat_failure',
        final_status: 'blocked',
      }
    },
  });

  assert.deepEqual(summary.overall, {
    decision: 'fail',
    status: 'tests failed; remediation blocked by policy',
  });
  assert.equal(summary.remediation.decision, 'blocked_by_policy');
  assert.equal(summary.remediation.failureClass, 'snapshot_drift');
  assert.equal(summary.remediation.mode, 'dry_run');
  assert.deepEqual(summary.remediation.blockedSignatures, ['sig-a']);
});

test('renderMarkdown emits one compact Playbook CI Summary with optional sections', () => {
  const markdown = renderMarkdown({
    overall: { decision: 'fail', status: 'tests failed; remediation blocked by policy' },
    verify: {
      decision: 'fail_closed',
      status: 'verify blockers present',
      blockers: ['verify.docs: Docs drift detected.'],
      nextAction: 'Refresh docs artifacts.',
    },
    mergeGuard: {
      decision: 'fail_closed',
      status: 'protected-doc consolidation blocked',
      blockers: ['lane:lane-2'],
      nextActions: ['Resolve consolidation conflicts.'],
    },
    release: {
      decision: 'plan_only',
      status: 'release plan ready',
      recommendedBump: 'minor',
      nextVersion: '1.3.0',
      affected: 'lockstep (@scope/alpha, @scope/beta)',
      nextAction: 'Review `.playbook/release-plan.json`; apply only through `pnpm playbook apply --from-plan .playbook/release-plan.json` in a reviewed boundary.',
    },
    remediation: {
      decision: 'blocked_by_policy',
      status: 'remediation blocked by policy',
      failureClass: 'snapshot_drift',
      summary: 'Vitest reported snapshot drift.',
      mode: 'dry_run',
      retryDecision: 'blocked_repeat_failure',
      blockedSignatures: ['sig-a'],
      reviewRequiredSignatures: ['sig-b'],
      nextAction: 'Inspect `.playbook/failure-summary.json` and `.playbook/ci-remediation-policy.json` before retrying.',
    },
    artifacts: {
      verify: '.playbook/verify.json',
      releasePlan: '.playbook/release-plan.json',
      remediationPolicy: '.playbook/ci-remediation-policy.json',
      failureSummary: '.playbook/failure-summary.json',
      remediationStatus: '.playbook/remediation-status.json',
    },
  }, { marker: '<!-- marker -->', title: 'Playbook CI Summary' });

  assert.match(markdown, /## Playbook CI Summary/);
  assert.match(markdown, /### Overall/);
  assert.match(markdown, /### Verify/);
  assert.match(markdown, /### Merge guard/);
  assert.match(markdown, /### Release bump/);
  assert.match(markdown, /### Remediation/);
  assert.match(markdown, /Decision \/ status \| fail \/ tests failed; remediation blocked by policy/);
  assert.match(markdown, /Artifact: `\.playbook\/verify\.json`\./);
  assert.match(markdown, /Artifact: `\.playbook\/release-plan\.json`\./);
  assert.match(markdown, /Artifact: `\.playbook\/failure-summary\.json`\./);
});
