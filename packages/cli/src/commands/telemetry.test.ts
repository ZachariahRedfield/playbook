import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runTelemetry } from './telemetry.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeTelemetryArtifacts = (repo: string): void => {
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.playbook', 'outcome-telemetry.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'outcome-telemetry',
        generatedAt: '2026-03-14T00:00:00.000Z',
        records: [
          {
            id: 'out-2',
            recordedAt: '2026-03-14T02:00:00.000Z',
            plan_churn: 1,
            apply_retries: 1,
            dependency_drift: 0,
            contract_breakage: 0,
            docs_mismatch: false,
            ci_failure_categories: ['compile', 'compile']
          },
          {
            id: 'out-1',
            recordedAt: '2026-03-14T01:00:00.000Z',
            plan_churn: 2,
            apply_retries: 0,
            dependency_drift: 1,
            contract_breakage: 1,
            docs_mismatch: true,
            ci_failure_categories: ['lint']
          }
        ],
        summary: {
          total_records: 999,
          sum_plan_churn: 999,
          sum_apply_retries: 999,
          sum_dependency_drift: 999,
          sum_contract_breakage: 999,
          docs_mismatch_count: 999,
          ci_failure_category_counts: { stale: 999 }
        }
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(repo, '.playbook', 'process-telemetry.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'process-telemetry',
        generatedAt: '2026-03-15T00:00:00.000Z',
        records: [
          {
            id: 'proc-1',
            recordedAt: '2026-03-14T01:00:00.000Z',
            task_family: 'governance',
            task_duration_ms: 100,
            files_touched: ['a.md'],
            validators_run: ['pnpm test'],
            retry_count: 0,
            merge_conflict_risk: 0.1,
            first_pass_success: true,
            prompt_size: 200,
            reasoning_scope: 'repository'
          }
        ],
        summary: {
          total_records: 0,
          total_task_duration_ms: 0,
          average_task_duration_ms: 0,
          total_retry_count: 0,
          first_pass_success_count: 0,
          average_merge_conflict_risk: 0,
          total_files_touched_unique: 0,
          total_validators_run_unique: 0,
          task_family_counts: {},
          validators_run_counts: {},
          reasoning_scope_counts: { narrow: 0, module: 0, repository: 0, 'cross-repo': 0 }
        }
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(repo, '.playbook', 'task-execution-profile.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'task-execution-profile',
        generatedAt: '2026-03-16T00:00:00.000Z',
        proposalOnly: true,
        profiles: [
          {
            task_family: 'docs_only',
            scope: 'single-file',
            affected_surfaces: ['docs'],
            rule_packs: ['docs-governance'],
            required_validations: ['pnpm playbook docs audit --json'],
            optional_validations: ['pnpm -r build'],
            docs_requirements: ['docs/CHANGELOG.md'],
            parallel_safe: true,
            estimated_change_surface: 'small'
          }
        ]
      },
      null,
      2
    )
  );
};

describe('runTelemetry', () => {
  it('prints deterministic summary as json', async () => {
    const repo = createRepo('playbook-telemetry');
    writeTelemetryArtifacts(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTelemetry(repo, ['summary'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.kind).toBe('telemetry-summary');
    expect((payload.process as Record<string, unknown>).total_records).toBe(1);
    expect((payload.process as Record<string, unknown>).route_id_counts).toEqual({});
    expect((payload.outcomes as Record<string, unknown>).sum_plan_churn).toBe(3);

    logSpy.mockRestore();
  });


  it('prints learning-state snapshot as json and degrades when optional profile is missing', async () => {
    const repo = createRepo('playbook-learning-state');
    writeTelemetryArtifacts(repo);
    fs.rmSync(path.join(repo, '.playbook', 'task-execution-profile.json'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTelemetry(repo, ['learning-state'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.kind).toBe('learning-state-snapshot');
    expect((payload.metrics as Record<string, unknown>).first_pass_yield).toBe(1);
    const sources = payload.sourceArtifacts as Record<string, Record<string, unknown>>;
    expect(sources.taskExecutionProfile.available).toBe(false);

    logSpy.mockRestore();
  });

});

describe('command registry', () => {
  it('registers the telemetry command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'telemetry');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Inspect deterministic repository/process telemetry and compact learning-state snapshots');
  });
});
