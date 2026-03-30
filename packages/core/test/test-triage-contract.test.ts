import { describe, expect, it } from 'vitest';
import {
  TEST_TRIAGE_ARTIFACT_KIND,
  TEST_TRIAGE_SCHEMA_VERSION,
  testTriageAutomationEligibilityStates,
  testTriageFailureKinds,
  testTriageFailureLayers,
  testTriageRepairClasses
} from '../src/contracts/testTriage.js';

describe('test triage contracts', () => {
  it('defines the first-class test triage artifact contract constants', () => {
    expect(TEST_TRIAGE_SCHEMA_VERSION).toBe('1.0');
    expect(TEST_TRIAGE_ARTIFACT_KIND).toBe('test-triage');
    expect(testTriageFailureKinds).toEqual([
      'registry_timeout_install_failure',
      'cache_restore_failure',
      'composite_action_manifest_parse_failure',
      'tool_bootstrap_failure',
      'release_governance_preflight_failure',
      'contracts_snapshot_drift',
      'docs_audit_contract_failure',
      'command_governance_enforcement_failure',
      'snapshot_drift',
      'stale_assertion',
      'fixture_drift',
      'ordering_drift',
      'missing_artifact',
      'environment_limitation',
      'likely_regression',
      'missing_expected_finding',
      'contract_drift',
      'test_expectation_drift',
      'lint_failure',
      'typecheck_failure',
      'runtime_failure',
      'recursive_workspace_failure'
    ]);
    expect(testTriageFailureLayers).toEqual(['infra_failure', 'governance_failure', 'product_failure', 'unknown']);
    expect(testTriageAutomationEligibilityStates).toEqual([
      'eligible_for_product_remediation',
      'blocked_infra_failure',
      'blocked_governance_failure',
      'not_applicable'
    ]);
    expect(testTriageRepairClasses).toEqual(['autofix_plan_only', 'review_required']);
  });
});
