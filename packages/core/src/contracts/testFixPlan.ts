export const TEST_FIX_PLAN_SCHEMA_VERSION = '1.0' as const;
export const TEST_FIX_PLAN_ARTIFACT_KIND = 'test-fix-plan' as const;

export const testFixPlanStatusValues = ['ready', 'rejected'] as const;
export type TestFixPlanStatus = (typeof testFixPlanStatusValues)[number];

export type TestFixPlanAction = {
  finding_key: string;
  repair_class: 'autofix_plan_only';
  failure_kind: string;
  package: string | null;
  test_file: string | null;
  test_name: string | null;
  summary: string;
  files_to_modify: string[];
  strategy: string;
  docs_update_recommendation: string;
  verification_commands: string[];
};

export type TestFixPlanBlockedFinding = {
  finding_key: string;
  failure_kind: string;
  repair_class: string;
  package: string | null;
  test_file: string | null;
  test_name: string | null;
  summary: string;
  reason: string;
};

export type TestFixPlanArtifact = {
  schemaVersion: typeof TEST_FIX_PLAN_SCHEMA_VERSION;
  kind: typeof TEST_FIX_PLAN_ARTIFACT_KIND;
  command: 'test-fix-plan';
  generatedAt: string;
  source: {
    from_triage: string | null;
  };
  status: TestFixPlanStatus;
  summary: string;
  artifact_path: string | null;
  actions: TestFixPlanAction[];
  blocked_findings: TestFixPlanBlockedFinding[];
  verification_commands: string[];
  governance: {
    rule: string;
    pattern: string;
    failure_mode: string;
  };
};
