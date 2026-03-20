import { describe, expect, it } from 'vitest';
import { TEST_TRIAGE_ARTIFACT_KIND, TEST_TRIAGE_SCHEMA_VERSION, testTriageFailureKinds, testTriageRepairClasses } from '../src/contracts/testTriage.js';

describe('test triage contracts', () => {
  it('defines the first-class test triage artifact contract constants', () => {
    expect(TEST_TRIAGE_SCHEMA_VERSION).toBe('1.0');
    expect(TEST_TRIAGE_ARTIFACT_KIND).toBe('test-triage');
    expect(testTriageFailureKinds).toEqual([
      'snapshot_drift',
      'stale_assertion',
      'fixture_drift',
      'ordering_drift',
      'missing_artifact',
      'environment_limitation',
      'likely_regression'
    ]);
    expect(testTriageRepairClasses).toEqual(['autofix_plan_only', 'review_required']);
  });
});
