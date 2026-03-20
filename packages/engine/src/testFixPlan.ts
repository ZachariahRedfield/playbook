import {
  TEST_FIX_PLAN_ARTIFACT_KIND,
  TEST_FIX_PLAN_SCHEMA_VERSION,
  TEST_TRIAGE_ARTIFACT_KIND,
  type TestFixPlanAction,
  type TestFixPlanArtifact,
  type TestFixPlanBlockedFinding,
  type TestTriageArtifact,
  type TestTriageFinding
} from '@zachariahredfield/playbook-core';

type FixPlanSource = { from_triage: string | null };

const GOVERNANCE = {
  rule: 'Every canonical command must have one stable artifact contract and one authoritative operator doc.',
  pattern: 'Add remediation commands as artifact-producing seams before orchestration wrappers.',
  failure_mode: 'Hidden CLI-only behavior without contract/docs coverage drifts faster than engine truth.'
} as const;

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
const uniqueSorted = (values: Array<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))].sort(compareStrings);
const findingKey = (finding: TestTriageFinding): string => [finding.package ?? 'unknown-package', finding.test_file ?? 'unknown-test-file', finding.test_name ?? finding.failure_kind].join('::');

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`playbook test-fix-plan: ${label} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const expectString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`playbook test-fix-plan: ${label} must be a non-empty string.`);
  }
  return value;
};

const expectNullableString = (value: unknown, label: string): string | null => {
  if (value === null) return null;
  return expectString(value, label);
};

const expectStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`playbook test-fix-plan: ${label} must be an array of strings.`);
  }
  return value.map((entry) => entry.trim()).filter(Boolean);
};

const normalizeFinding = (value: unknown): TestTriageFinding => {
  const record = asRecord(value, 'finding');
  return {
    failure_kind: expectString(record.failure_kind, 'findings[].failure_kind') as TestTriageFinding['failure_kind'],
    confidence: typeof record.confidence === 'number' ? record.confidence : 0,
    package: expectNullableString(record.package ?? null, 'findings[].package'),
    test_file: expectNullableString(record.test_file ?? null, 'findings[].test_file'),
    test_name: expectNullableString(record.test_name ?? null, 'findings[].test_name'),
    likely_files_to_modify: expectStringArray(record.likely_files_to_modify, 'findings[].likely_files_to_modify'),
    suggested_fix_strategy: expectString(record.suggested_fix_strategy, 'findings[].suggested_fix_strategy'),
    verification_commands: expectStringArray(record.verification_commands, 'findings[].verification_commands'),
    docs_update_recommendation: expectString(record.docs_update_recommendation, 'findings[].docs_update_recommendation'),
    rule_pattern_failure_mode: asRecord(record.rule_pattern_failure_mode, 'findings[].rule_pattern_failure_mode') as TestTriageFinding['rule_pattern_failure_mode'],
    repair_class: expectString(record.repair_class, 'findings[].repair_class') as TestTriageFinding['repair_class'],
    summary: expectString(record.summary, 'findings[].summary'),
    evidence: expectStringArray(record.evidence, 'findings[].evidence')
  };
};

export const readTestTriageArtifact = (value: unknown): TestTriageArtifact => {
  const record = asRecord(value, 'artifact');
  if (record.kind !== TEST_TRIAGE_ARTIFACT_KIND || record.command !== 'test-triage') {
    throw new Error('playbook test-fix-plan: input artifact must be a test-triage artifact.');
  }
  if (!Array.isArray(record.findings)) {
    throw new Error('playbook test-fix-plan: findings must be an array.');
  }
  return {
    schemaVersion: expectString(record.schemaVersion, 'schemaVersion') as TestTriageArtifact['schemaVersion'],
    kind: TEST_TRIAGE_ARTIFACT_KIND,
    command: 'test-triage',
    generatedAt: expectString(record.generatedAt, 'generatedAt'),
    source: asRecord(record.source, 'source') as TestTriageArtifact['source'],
    findings: record.findings.map((entry) => normalizeFinding(entry)),
    rerun_plan: asRecord(record.rerun_plan, 'rerun_plan') as TestTriageArtifact['rerun_plan'],
    repair_plan: asRecord(record.repair_plan, 'repair_plan') as TestTriageArtifact['repair_plan']
  };
};

export const buildTestFixPlanArtifact = (triage: TestTriageArtifact, source: FixPlanSource): TestFixPlanArtifact => {
  const actions: TestFixPlanAction[] = triage.findings
    .filter((finding) => finding.repair_class === 'autofix_plan_only')
    .map((finding) => ({
      finding_key: findingKey(finding),
      repair_class: 'autofix_plan_only' as const,
      failure_kind: finding.failure_kind,
      package: finding.package,
      test_file: finding.test_file,
      test_name: finding.test_name,
      summary: finding.summary,
      files_to_modify: uniqueSorted(finding.likely_files_to_modify),
      strategy: finding.suggested_fix_strategy,
      docs_update_recommendation: finding.docs_update_recommendation,
      verification_commands: uniqueSorted(finding.verification_commands)
    }))
    .sort((left, right) => left.finding_key.localeCompare(right.finding_key));

  const blocked_findings: TestFixPlanBlockedFinding[] = triage.findings
    .filter((finding) => finding.repair_class !== 'autofix_plan_only')
    .map((finding) => ({
      finding_key: findingKey(finding),
      failure_kind: finding.failure_kind,
      repair_class: finding.repair_class,
      package: finding.package,
      test_file: finding.test_file,
      test_name: finding.test_name,
      summary: finding.summary,
      reason: 'Finding requires review before repair planning can propose deterministic edits.'
    }))
    .sort((left, right) => left.finding_key.localeCompare(right.finding_key));

  const status = blocked_findings.length > 0 ? 'rejected' : 'ready';
  const verification_commands = uniqueSorted(actions.flatMap((action) => action.verification_commands));
  const summary = status === 'ready'
    ? `${actions.length} low-risk finding(s) accepted for deterministic test-fix planning.`
    : `${blocked_findings.length} risky finding(s) block deterministic test-fix planning; ${actions.length} low-risk finding(s) were not promoted.`;

  return {
    schemaVersion: TEST_FIX_PLAN_SCHEMA_VERSION,
    kind: TEST_FIX_PLAN_ARTIFACT_KIND,
    command: 'test-fix-plan',
    generatedAt: new Date(0).toISOString(),
    source,
    status,
    summary,
    artifact_path: null,
    actions,
    blocked_findings,
    verification_commands,
    governance: GOVERNANCE
  };
};

export const renderTestFixPlanText = (artifact: TestFixPlanArtifact): string => {
  const lines = [
    'Playbook Test Fix Plan',
    `Status: ${artifact.status}`,
    artifact.summary,
    `Actions: ${artifact.actions.length}`,
    ...artifact.actions.map((action) => `- ${action.failure_kind} :: ${action.test_file ?? 'unknown'} :: ${action.strategy}`),
    `Blocked findings: ${artifact.blocked_findings.length}`,
    ...artifact.blocked_findings.map((finding) => `- ${finding.failure_kind} :: ${finding.test_file ?? 'unknown'} :: ${finding.reason}`)
  ];

  if (artifact.verification_commands.length > 0) {
    lines.push('Verification commands:');
    lines.push(...artifact.verification_commands.map((command) => `- ${command}`));
  }

  return lines.join('\n');
};
