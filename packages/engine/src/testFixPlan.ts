import { createHash } from 'node:crypto';
import {
  TEST_FIX_PLAN_ARTIFACT_KIND,
  TEST_FIX_PLAN_SCHEMA_VERSION,
  type TestFixPlanArtifact,
  type TestFixPlanExclusion,
  type TestFixPlanExclusionReason,
  type TestFixPlanTask,
  type TestFixPlanTaskKind,
  type TestTriageArtifact,
  type TestTriageFailureKind,
  type TestTriageFinding
} from '@zachariahredfield/playbook-core';

type MappingSpec = {
  taskKind: TestFixPlanTaskKind;
  ruleId: string;
  action: (finding: TestTriageFinding) => string;
};

const LOW_RISK_MAPPING: Record<Extract<TestTriageFailureKind, 'snapshot_drift' | 'stale_assertion' | 'fixture_drift' | 'ordering_drift'>, MappingSpec> = {
  snapshot_drift: {
    taskKind: 'snapshot_refresh',
    ruleId: 'test-triage.snapshot-refresh',
    action: (finding) => `Refresh deterministic snapshot expectations for ${finding.test_file ?? 'the failing test file'}.`
  },
  stale_assertion: {
    taskKind: 'stale_assertion_update',
    ruleId: 'test-triage.stale-assertion-update',
    action: (finding) => `Update stale deterministic assertions in ${finding.test_file ?? 'the failing test file'}.`
  },
  fixture_drift: {
    taskKind: 'fixture_normalization',
    ruleId: 'test-triage.fixture-normalization',
    action: (finding) => `Normalize fixture or seeded contract data referenced by ${finding.test_file ?? 'the failing test file'}.`
  },
  ordering_drift: {
    taskKind: 'deterministic_ordering_stabilization',
    ruleId: 'test-triage.ordering-stabilization',
    action: (finding) => `Stabilize deterministic ordering expectations for ${finding.test_file ?? 'the failing test file'}.`
  }
};

const compareStrings = (left: string, right: string): number => left.localeCompare(right);

const classifyEvidenceLine = (line: string, summary: string, testName: string | null): number => {
  const trimmed = line.trim();
  if (trimmed === summary.trim()) return 0;
  if (/^(?:AssertionError|Error:|Expected:|Received:|Snapshot\b|ENOENT|Cannot find module)/i.test(trimmed)) return 1;
  if (testName && trimmed.replace(/^(?:×|✕|❯)\s*/, '') === testName.trim()) return 2;
  return 3;
};

// Provenance evidence must use an explicit ordering rule so repeated parsing of the same
// failure shape cannot churn automation snapshots just because source collection order varied.
const orderEvidence = (finding: TestTriageFinding): string[] => ([...finding.evidence].sort((left, right) => {
  const bucketOrder = classifyEvidenceLine(left, finding.summary, finding.test_name) - classifyEvidenceLine(right, finding.summary, finding.test_name);
  if (bucketOrder !== 0) return bucketOrder;
  return left.localeCompare(right);
}));

const stableTaskId = (finding: TestTriageFinding, taskKind: TestFixPlanTaskKind, findingIndex: number): string => {
  const seed = [taskKind, finding.failure_kind, finding.package ?? '', finding.test_file ?? '', finding.test_name ?? '', String(findingIndex)].join('|');
  return `task-${createHash('sha256').update(seed).digest('hex').slice(0, 10)}-${findingIndex + 1}`;
};

const toExclusion = (
  finding: TestTriageFinding,
  findingIndex: number,
  reason: TestFixPlanExclusionReason,
  detail: string
): TestFixPlanExclusion => ({
  finding_index: findingIndex,
  failure_kind: finding.failure_kind,
  summary: finding.summary,
  reason,
  detail,
  repair_class: finding.repair_class,
  file: finding.test_file,
  evidence: orderEvidence(finding)
});

const toTask = (finding: TestTriageFinding, findingIndex: number, mapping: MappingSpec): TestFixPlanTask => ({
  id: stableTaskId(finding, mapping.taskKind, findingIndex),
  ruleId: mapping.ruleId,
  file: finding.test_file,
  action: mapping.action(finding),
  autoFix: true,
  task_kind: mapping.taskKind,
  provenance: {
    finding_index: findingIndex,
    failure_kind: finding.failure_kind,
    repair_class: finding.repair_class,
    summary: finding.summary,
    test_name: finding.test_name,
    verification_commands: [...finding.verification_commands].sort(compareStrings),
    evidence: orderEvidence(finding)
  }
});

export const buildTestFixPlanArtifact = (triage: TestTriageArtifact): TestFixPlanArtifact => {
  const tasks: TestFixPlanTask[] = [];
  const excluded: TestFixPlanExclusion[] = [];

  triage.findings.forEach((finding, findingIndex) => {
    const mapping = LOW_RISK_MAPPING[finding.failure_kind as keyof typeof LOW_RISK_MAPPING];

    if (finding.repair_class !== 'autofix_plan_only') {
      excluded.push(
        toExclusion(
          finding,
          findingIndex,
          'risky_or_review_required',
          'Diagnosis artifact marked this finding as review_required, so it cannot cross the remediation trust boundary into an executable auto-fix task.'
        )
      );
      return;
    }

    if (!mapping) {
      excluded.push(
        toExclusion(
          finding,
          findingIndex,
          'unsupported_failure_kind',
          'Only pre-approved low-risk classes may become executable tasks: snapshot refresh, stale assertion update, fixture normalization, and deterministic ordering stabilization.'
        )
      );
      return;
    }

    if (!finding.test_file) {
      excluded.push(
        toExclusion(
          finding,
          findingIndex,
          'missing_target_file',
          'Auto-fix planning requires a concrete failing test file so apply can target the bounded remediation surface deterministically.'
        )
      );
      return;
    }

    tasks.push(toTask(finding, findingIndex, mapping));
  });

  tasks.sort((left, right) => {
    const fileOrder = (left.file ?? '').localeCompare(right.file ?? '');
    if (fileOrder !== 0) return fileOrder;
    const ruleOrder = left.ruleId.localeCompare(right.ruleId);
    if (ruleOrder !== 0) return ruleOrder;
    return left.id.localeCompare(right.id);
  });

  excluded.sort((left, right) => {
    const fileOrder = (left.file ?? '').localeCompare(right.file ?? '');
    if (fileOrder !== 0) return fileOrder;
    const reasonOrder = left.reason.localeCompare(right.reason);
    if (reasonOrder !== 0) return reasonOrder;
    return left.summary.localeCompare(right.summary);
  });

  return {
    schemaVersion: TEST_FIX_PLAN_SCHEMA_VERSION,
    kind: TEST_FIX_PLAN_ARTIFACT_KIND,
    command: 'test-fix-plan',
    generatedAt: new Date(0).toISOString(),
    source: {
      kind: triage.kind,
      command: triage.command,
      generatedAt: triage.generatedAt,
      path: triage.source.path,
      input: triage.source.input
    },
    tasks,
    excluded,
    summary: {
      total_findings: triage.findings.length,
      eligible_findings: tasks.length,
      excluded_findings: excluded.length,
      auto_fix_tasks: tasks.filter((task) => task.autoFix).length
    }
  };
};
