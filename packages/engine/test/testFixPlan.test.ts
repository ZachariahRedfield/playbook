import { describe, expect, it } from 'vitest';
import { buildTestTriageArtifact } from '../src/testTriage.js';
import { buildTestFixPlanArtifact } from '../src/testFixPlan.js';

describe('test fix plan engine', () => {
  it('maps approved low-risk triage findings into deterministic apply-compatible tasks', () => {
    const log = [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch',
      '',
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/query.test.ts',
      '  × sorts module names deterministically',
      '    Expected: ["alpha", "beta"]',
      '    Received: ["beta", "alpha"]'
    ].join('\n');

    const triage = buildTestTriageArtifact(log, { input: 'file', path: '.playbook/ci-failure.log' });
    const plan = buildTestFixPlanArtifact(triage);

    expect(plan.tasks.map((task) => ({ ruleId: task.ruleId, file: task.file, task_kind: task.task_kind, autoFix: task.autoFix }))).toEqual([
      {
        ruleId: 'test-triage.ordering-stabilization',
        file: 'packages/cli/src/commands/query.test.ts',
        task_kind: 'deterministic_ordering_stabilization',
        autoFix: true
      },
      {
        ruleId: 'test-triage.snapshot-refresh',
        file: 'packages/cli/src/commands/schema.test.ts',
        task_kind: 'snapshot_refresh',
        autoFix: true
      }
    ]);
    expect(plan.summary).toEqual({
      total_findings: 2,
      eligible_findings: 2,
      excluded_findings: 0,
      auto_fix_tasks: 2
    });
    expect(plan.tasks[0]?.id).toBe(buildTestFixPlanArtifact(triage).tasks[0]?.id);
  });

  it('excludes risky or unsupported findings with deterministic reasons and preserves triage provenance', () => {
    const log = [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch',
      '',
      'Error: Cannot find module @esbuild/linux-x64',
      'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook test: `node ./scripts/run-tests.mjs`'
    ].join('\n');

    const triage = buildTestTriageArtifact(log, { input: 'stdin', path: null });
    const plan = buildTestFixPlanArtifact(triage);

    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]?.provenance.failure_kind).toBe('snapshot_drift');
    expect(plan.tasks[0]?.provenance.evidence).toEqual([
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      'Snapshot `renders schema snapshot 1` mismatch',
      '× renders schema snapshot'
    ]);
    expect(plan.excluded[0]?.evidence).toEqual([
      'Error: Cannot find module @esbuild/linux-x64',
      'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook test: `node ./scripts/run-tests.mjs`'
    ]);
    expect(plan.excluded).toEqual([
      expect.objectContaining({
        failure_kind: 'environment_limitation',
        reason: 'risky_or_review_required',
        repair_class: 'review_required'
      })
    ]);
  });

  it('keeps the full artifact deterministic for the same triage input', () => {
    const log = [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/contract.test.ts',
      '  × keeps fixture data aligned',
      '    Error: expected undefined to equal {"ok":true}'
    ].join('\n');

    const triage = buildTestTriageArtifact(log, { input: 'file', path: 'fixture.log' });
    const first = buildTestFixPlanArtifact(triage);
    const second = buildTestFixPlanArtifact(triage);

    expect(first).toEqual(second);
    expect(first).toMatchInlineSnapshot(`
      {
        "command": "test-fix-plan",
        "excluded": [],
        "generatedAt": "1970-01-01T00:00:00.000Z",
        "kind": "test-fix-plan",
        "schemaVersion": "1.0",
        "source": {
          "command": "test-triage",
          "generatedAt": "1970-01-01T00:00:00.000Z",
          "input": "file",
          "kind": "test-triage",
          "path": "fixture.log",
        },
        "summary": {
          "auto_fix_tasks": 1,
          "eligible_findings": 1,
          "excluded_findings": 0,
          "total_findings": 1,
        },
        "tasks": [
          {
            "action": "Normalize fixture or seeded contract data referenced by packages/cli/src/commands/contract.test.ts.",
            "autoFix": true,
            "file": "packages/cli/src/commands/contract.test.ts",
            "id": "task-4d90ed1d4d-1",
            "provenance": {
              "evidence": [
                "@fawxzzy/playbook test: FAIL  packages/cli/src/commands/contract.test.ts",
                "Error: expected undefined to equal {\"ok\":true}",
                "× keeps fixture data aligned",
              ],
              "failure_kind": "fixture_drift",
              "finding_index": 0,
              "repair_class": "autofix_plan_only",
              "summary": "@fawxzzy/playbook test: FAIL  packages/cli/src/commands/contract.test.ts",
              "test_name": "keeps fixture data aligned",
              "verification_commands": [
                "pnpm --filter @fawxzzy/playbook exec vitest run packages/cli/src/commands/contract.test.ts",
                "pnpm --filter @fawxzzy/playbook test",
                "pnpm -r test",
              ],
            },
            "ruleId": "test-triage.fixture-normalization",
            "task_kind": "fixture_normalization",
          },
        ],
      }
    `);
  });
});
