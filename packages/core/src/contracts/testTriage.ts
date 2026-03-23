export const TEST_TRIAGE_SCHEMA_VERSION = '1.0' as const;
export const TEST_TRIAGE_ARTIFACT_KIND = 'test-triage' as const;

export const testTriageFailureKinds = [
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
] as const;
export type TestTriageFailureKind = (typeof testTriageFailureKinds)[number];

export const testTriageRepairClasses = ['autofix_plan_only', 'review_required'] as const;
export type TestTriageRepairClass = (typeof testTriageRepairClasses)[number];

export type TestTriageFailureModeNote = {
  rule: string;
  pattern: string;
  failure_mode: string;
};

export type TestTriageFailure = {
  type: TestTriageFailureKind;
  workspace: string | null;
  suite: string | null;
  test: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  message: string;
  likelyCauses: string[];
};

export type TestTriageFinding = {
  failure_signature: string;
  failure_kind: TestTriageFailureKind;
  confidence: number;
  package: string | null;
  test_file: string | null;
  test_name: string | null;
  likely_files_to_modify: string[];
  suggested_fix_strategy: string;
  verification_commands: string[];
  docs_update_recommendation: string;
  rule_pattern_failure_mode: TestTriageFailureModeNote;
  repair_class: TestTriageRepairClass;
  summary: string;
  evidence: string[];
  normalized_failure: TestTriageFailure;
};

export type TestTriageRepairPlan = {
  summary: string;
  codex_prompt: string;
  suggested_actions: string[];
};

export type TestTriageArtifact = {
  schemaVersion: typeof TEST_TRIAGE_SCHEMA_VERSION;
  kind: typeof TEST_TRIAGE_ARTIFACT_KIND;
  command: 'test-triage';
  status: 'failed' | 'passed' | 'unknown';
  summary: string;
  primaryFailureClass: TestTriageFailureKind | 'unknown';
  generatedAt: string;
  source: {
    input: 'file' | 'stdin';
    path: string | null;
  };
  failures: TestTriageFailure[];
  crossCuttingDiagnosis: string[];
  recommendedNextChecks: string[];
  findings: TestTriageFinding[];
  rerun_plan: {
    strategy: 'file_first_then_package_then_workspace';
    commands: string[];
  };
  repair_plan: TestTriageRepairPlan;
};
