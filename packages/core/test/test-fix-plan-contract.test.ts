import { describe, expect, it } from 'vitest';
import {
  TEST_FIX_PLAN_ARTIFACT_KIND,
  TEST_FIX_PLAN_SCHEMA_VERSION,
  testFixPlanExclusionReasons,
  testFixPlanTaskKinds
} from '../src/contracts/testFixPlan.js';

describe('test fix plan contracts', () => {
  it('defines the first-class test fix plan artifact contract constants', () => {
    expect(TEST_FIX_PLAN_SCHEMA_VERSION).toBe('1.0');
    expect(TEST_FIX_PLAN_ARTIFACT_KIND).toBe('test-fix-plan');
    expect(testFixPlanTaskKinds).toEqual([
      'snapshot_refresh',
      'stale_assertion_update',
      'fixture_normalization',
      'deterministic_ordering_stabilization'
    ]);
    expect(testFixPlanExclusionReasons).toEqual([
      'not_auto_fixable',
      'unsupported_failure_kind',
      'missing_target_file',
      'risky_or_review_required'
    ]);
  });
});
