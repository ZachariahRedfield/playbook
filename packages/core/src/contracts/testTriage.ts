export const TEST_TRIAGE_SCHEMA_VERSION = '1.0' as const;
export const TEST_TRIAGE_ARTIFACT_KIND = 'test-triage' as const;

export const testTriageFailureKinds = [
  'snapshot_drift',
  'stale_assertion',
  'fixture_drift',
  'ordering_drift',
  'missing_artifact',
  'environment_limitation',
  'likely_regression'
] as const;
export type TestTriageFailureKind = (typeof testTriageFailureKinds)[number];

export const testTriageRepairClasses = ['autofix_plan_only', 'review_required'] as const;
export type TestTriageRepairClass = (typeof testTriageRepairClasses)[number];

export type TestTriageFailureModeNote = {
  rule: string;
  pattern: string;
  failure_mode: string;
};

export type TestTriageFinding = {
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
  generatedAt: string;
  source: {
    input: 'file' | 'stdin';
    path: string | null;
  };
  findings: TestTriageFinding[];
  rerun_plan: {
    strategy: 'file_first_then_package_then_workspace';
    commands: string[];
  };
  repair_plan: TestTriageRepairPlan;
};
