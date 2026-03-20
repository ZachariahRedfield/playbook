export const TEST_AUTOFIX_SCHEMA_VERSION = '1.0' as const;
export const TEST_AUTOFIX_ARTIFACT_KIND = 'test-autofix' as const;

export const testAutofixFinalStatuses = [
  'fixed',
  'partially_fixed',
  'not_fixed',
  'blocked',
  'review_required_only'
] as const;
export type TestAutofixFinalStatus = (typeof testAutofixFinalStatuses)[number];

export type TestAutofixSourceReference = {
  path: string | null;
  command: 'test-triage' | 'test-fix-plan';
};

export type TestAutofixApplySummary = {
  attempted: boolean;
  ok: boolean;
  exitCode: number;
  applied: number;
  skipped: number;
  unsupported: number;
  failed: number;
  message: string | null;
};

export type TestAutofixVerificationCommandResult = {
  command: string;
  exitCode: number;
  ok: boolean;
};

export type TestAutofixVerificationSummary = {
  attempted: boolean;
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
};

export type TestAutofixExcludedFindingSummary = {
  total: number;
  review_required: number;
  by_reason: Array<{
    reason: string;
    count: number;
  }>;
};

export type TestAutofixArtifact = {
  schemaVersion: typeof TEST_AUTOFIX_SCHEMA_VERSION;
  kind: typeof TEST_AUTOFIX_ARTIFACT_KIND;
  command: 'test-autofix';
  generatedAt: string;
  input: string;
  source_triage: TestAutofixSourceReference;
  source_fix_plan: TestAutofixSourceReference;
  apply_result: TestAutofixApplySummary;
  verification_result: TestAutofixVerificationSummary;
  executed_verification_commands: TestAutofixVerificationCommandResult[];
  applied_task_ids: string[];
  excluded_finding_summary: TestAutofixExcludedFindingSummary;
  final_status: TestAutofixFinalStatus;
  reason: string;
};
