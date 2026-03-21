export const TEST_AUTOFIX_REMEDIATION_HISTORY_SCHEMA_VERSION = '1.0' as const;
export const TEST_AUTOFIX_REMEDIATION_HISTORY_ARTIFACT_KIND = 'test-autofix-remediation-history' as const;

export type TestAutofixRemediationHistorySourceProvenance = {
  failure_log_path: string;
  triage_artifact_path: string;
  fix_plan_artifact_path: string;
  apply_result_path: string | null;
  autofix_result_path: string;
};

export type TestAutofixRemediationClassification = {
  failure_signature: string;
  failure_kind: string;
  repair_class: string;
  package: string | null;
  test_file: string | null;
  test_name: string | null;
};

export type TestAutofixRemediationVerificationOutcome = {
  command: string;
  exitCode: number;
  ok: boolean;
};

export type TestAutofixRemediationHistoryMergeProvenance = {
  source_id: string;
  artifact_path: string;
  original_run_id: string;
};

export type TestAutofixRemediationHistoryEntry = {
  run_id: string;
  generatedAt: string;
  input: {
    path: string;
  };
  mode?: 'dry_run' | 'apply';
  retry_policy_decision?: string;
  confidence_threshold?: number;
  autofix_confidence?: number;
  failure_signatures: string[];
  triage_classifications: TestAutofixRemediationClassification[];
  admitted_findings: string[];
  excluded_findings: string[];
  applied_task_ids: string[];
  applied_repair_classes: string[];
  files_touched: string[];
  verification_commands: string[];
  verification_outcomes: TestAutofixRemediationVerificationOutcome[];
  final_status: string;
  stop_reasons: string[];
  provenance: TestAutofixRemediationHistorySourceProvenance;
  source_provenance?: TestAutofixRemediationHistoryMergeProvenance;
};

export type TestAutofixRemediationHistoryArtifact = {
  schemaVersion: typeof TEST_AUTOFIX_REMEDIATION_HISTORY_SCHEMA_VERSION;
  kind: typeof TEST_AUTOFIX_REMEDIATION_HISTORY_ARTIFACT_KIND;
  generatedAt: string;
  runs: TestAutofixRemediationHistoryEntry[];
};
