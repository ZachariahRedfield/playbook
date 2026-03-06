import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveVerifyCounts, validateFinalVerifyStatus, validateRemediationStatus } from './demo-validate.mjs';

test('deriveVerifyCounts handles warning-only verify payloads as zero failures', () => {
  const counts = deriveVerifyCounts({
    findings: [{ id: 'verify.warning.config-missing', level: 'warning', message: 'Config missing.' }],
    summary: { failures: 0, warnings: 1 }
  });

  assert.equal(counts.findings, 1);
  assert.equal(counts.failures, 0);
  assert.equal(counts.warnings, 1);

  assert.doesNotThrow(() => {
    validateRemediationStatus({ remediationStatus: 'not_needed', planSteps: 0, initialFailures: counts.failures });
  });
});

test('validateRemediationStatus requires unavailable when failures exist and no tasks are present', () => {
  assert.doesNotThrow(() => {
    validateRemediationStatus({ remediationStatus: 'unavailable', planSteps: 0, initialFailures: 2 });
  });

  assert.throws(
    () => {
      validateRemediationStatus({ remediationStatus: 'not_needed', planSteps: 0, initialFailures: 1 });
    },
    /not_needed remediation despite initial verify failures/
  );
});

test('validateRemediationStatus requires ready when failures exist and tasks are available', () => {
  assert.doesNotThrow(() => {
    validateRemediationStatus({ remediationStatus: 'ready', planSteps: 2, initialFailures: 2 });
  });

  assert.throws(
    () => {
      validateRemediationStatus({ remediationStatus: 'unavailable', planSteps: 1, initialFailures: 2 });
    },
    /unavailable remediation despite including remediation steps/
  );
});


test('validateFinalVerifyStatus allows warning-only final verify', () => {
  const finalVerifyCounts = deriveVerifyCounts({
    findings: [{ id: 'verify.warning.unpinned', level: 'warning', message: 'Dependency should be pinned.' }],
    summary: { failures: 0, warnings: 1 }
  });

  assert.doesNotThrow(() => {
    validateFinalVerifyStatus({ finalVerifyCounts });
  });
});

test('validateFinalVerifyStatus fails when final verify still has failures', () => {
  const finalVerifyCounts = deriveVerifyCounts({
    findings: [{ id: 'verify.failure.outdated-lockfile', level: 'failure', message: 'Lockfile is outdated.' }],
    summary: { failures: 1, warnings: 0 }
  });

  assert.throws(
    () => {
      validateFinalVerifyStatus({ finalVerifyCounts });
    },
    /Final verify still has 1 failure\(s\) \(0 warning\(s\), 1 total finding\(s\)\)/
  );
});
