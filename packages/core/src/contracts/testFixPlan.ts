export const TEST_FIX_PLAN_SCHEMA_VERSION = '1.0' as const;
export const TEST_FIX_PLAN_ARTIFACT_KIND = 'test-fix-plan' as const;

export const testFixPlanTaskKinds = [
  'snapshot_refresh',
  'stale_assertion_update',
  'fixture_normalization',
  'deterministic_ordering_stabilization'
] as const;
export type TestFixPlanTaskKind = (typeof testFixPlanTaskKinds)[number];

export const testFixPlanExclusionReasons = [
  'not_auto_fixable',
  'unsupported_failure_kind',
  'missing_target_file',
  'risky_or_review_required'
] as const;
export type TestFixPlanExclusionReason = (typeof testFixPlanExclusionReasons)[number];

export type TestFixPlanTaskProvenance = {
  finding_index: number;
  failure_kind: string;
  repair_class: string;
  summary: string;
  test_name: string | null;
  verification_commands: string[];
  evidence: string[];
};

export type TestFixPlanTask = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
  task_kind: TestFixPlanTaskKind;
  provenance: TestFixPlanTaskProvenance;
};

export type TestFixPlanExclusion = {
  finding_index: number;
  failure_kind: string;
  summary: string;
  reason: TestFixPlanExclusionReason;
  detail: string;
  repair_class: string;
  file: string | null;
  evidence: string[];
};

export type TestFixPlanArtifact = {
  schemaVersion: typeof TEST_FIX_PLAN_SCHEMA_VERSION;
  kind: typeof TEST_FIX_PLAN_ARTIFACT_KIND;
  command: 'test-fix-plan';
  generatedAt: string;
  source: {
    kind: 'test-triage';
    command: 'test-triage';
    generatedAt: string;
    path: string | null;
    input: 'file' | 'stdin';
  };
  tasks: TestFixPlanTask[];
  excluded: TestFixPlanExclusion[];
  summary: {
    total_findings: number;
    eligible_findings: number;
    excluded_findings: number;
    auto_fix_tasks: number;
  };
};
