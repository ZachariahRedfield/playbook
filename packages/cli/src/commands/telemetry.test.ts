import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runTelemetry } from './telemetry.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeTelemetryArtifacts = (repo: string): void => {
  fs.mkdirSync(path.join(repo, '.playbook', 'memory', 'events'), { recursive: true });
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
            ci_failure_categories: ['compile', 'compile'],
            task_family: 'engine_scoring'
          },
          {
            id: 'out-1',
            recordedAt: '2026-03-14T01:00:00.000Z',
            plan_churn: 2,
            apply_retries: 0,
            dependency_drift: 1,
            contract_breakage: 1,
            docs_mismatch: true,
            ci_failure_categories: ['lint'],
            task_family: 'docs_only'
          }
        ],
        lane_scores: [
          {
            lane_id: 'lane-1',
            execution_duration: 10000,
            retry_count: 0,
            success_rate: 1,
            score: 0.8333
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
            task_family: 'engine_scoring',
            route_id: 'deterministic_local:engine_scoring',
            task_duration_ms: 100,
            files_touched: ['a.md'],
            validators_run: ['pnpm test'],
            required_validations_selected: ['pnpm test'],
            retry_count: 2,
            merge_conflict_risk: 0.1,
            first_pass_success: false,
            prompt_size: 200,
            reasoning_scope: 'repository',
            over_validation_signal: true,
            validation_duration_ms: 50,
            parallel_lane_count: 2,
            router_fit_score: 0.8,
            predicted_parallel_lanes: 2,
            actual_parallel_lanes: 2,
            predicted_validation_cost: 10,
            actual_validation_cost: 10
          },
          {
            id: 'proc-2',
            recordedAt: '2026-03-14T03:00:00.000Z',
            task_family: 'docs_only',
            route_id: 'deterministic_local:docs_only',
            task_duration_ms: 90,
            files_touched: ['docs.md'],
            validators_run: ['pnpm playbook docs audit --json'],
            required_validations_selected: ['pnpm playbook docs audit --json'],
            retry_count: 0,
            merge_conflict_risk: 0.05,
            first_pass_success: true,
            prompt_size: 120,
            reasoning_scope: 'module',
            validation_duration_ms: 20,
            parallel_lane_count: 1,
            router_fit_score: 0.95,
            predicted_parallel_lanes: 1,
            actual_parallel_lanes: 1,
            predicted_validation_cost: 2,
            actual_validation_cost: 2
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

  fs.writeFileSync(
    path.join(repo, '.playbook', 'memory', 'events', '20260314010000-route_decision-a1.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        event_type: 'route_decision',
        event_id: '20260314010000-route_decision-a1',
        timestamp: '2026-03-14T01:00:00.000Z',
        subsystem: 'repository_memory',
        subject: 'deterministic_local:engine_scoring',
        related_artifacts: [],
        run_id: 'run-alpha',
        payload: {
          task_text: 'score lanes',
          task_family: 'engine_scoring',
          route_id: 'deterministic_local:engine_scoring',
          confidence: 0.8
        },
        task_text: 'score lanes',
        task_family: 'engine_scoring',
        route_id: 'deterministic_local:engine_scoring',
        confidence: 0.8
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(repo, '.playbook', 'memory', 'events', '20260314040000-execution_outcome-a2.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        event_type: 'execution_outcome',
        event_id: '20260314040000-execution_outcome-a2',
        timestamp: '2026-03-14T04:00:00.000Z',
        subsystem: 'repository_memory',
        subject: 'lane-1',
        related_artifacts: [],
        run_id: 'run-beta',
        payload: {
          lane_id: 'lane-1',
          outcome: 'success',
          summary: 'completed'
        },
        lane_id: 'lane-1',
        outcome: 'success',
        summary: 'completed'
      },
      null,
      2
    )
  );


  fs.mkdirSync(path.join(repo, '.playbook', 'telemetry'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.playbook', 'telemetry', 'command-quality.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'command-execution-quality',
        generatedAt: '2026-03-16T01:00:00.000Z',
        records: [
          {
            command_name: 'verify',
            run_id: 'cq-1',
            recorded_at: '2026-03-16T00:00:00.000Z',
            inputs_summary: 'ci=true',
            artifacts_read: ['playbook.config.json'],
            artifacts_written: ['.playbook/findings.json'],
            success_status: 'success',
            duration_ms: 100,
            warnings_count: 0,
            open_questions_count: 0,
            confidence_score: 0.9,
            downstream_artifacts_produced: ['.playbook/findings.json']
          },
          {
            command_name: 'verify',
            run_id: 'cq-2',
            recorded_at: '2026-03-16T00:01:00.000Z',
            inputs_summary: 'ci=false',
            artifacts_read: ['playbook.config.json'],
            artifacts_written: [],
            success_status: 'failure',
            duration_ms: 300,
            warnings_count: 1,
            open_questions_count: 1,
            confidence_score: 0.3,
            downstream_artifacts_produced: []
          },
          {
            command_name: 'route',
            run_id: 'cq-3',
            recorded_at: '2026-03-16T00:02:00.000Z',
            inputs_summary: 'task=docs',
            artifacts_read: [],
            artifacts_written: ['.playbook/execution-plan.json'],
            success_status: 'partial',
            duration_ms: 200,
            warnings_count: 1,
            open_questions_count: 1,
            confidence_score: 0.5,
            downstream_artifacts_produced: ['.playbook/execution-plan.json']
          }
        ],
        summary: {
          total_runs: 3,
          success_runs: 1,
          failure_runs: 1,
          partial_runs: 1,
          average_duration_ms: 200,
          average_confidence_score: 0.5667,
          total_warnings: 2,
          total_open_questions: 2
        }
      },
      null,
      2
    )
  );


  fs.writeFileSync(
    path.join(repo, '.playbook', 'cycle-history.json'),
    JSON.stringify(
      {
        history_version: 1,
        repo,
        cycles: [
          {
            cycle_id: 'cycle-001',
            started_at: '2026-03-16T00:00:00.000Z',
            result: 'success',
            duration_ms: 200
          },
          {
            cycle_id: 'cycle-002',
            started_at: '2026-03-16T01:00:00.000Z',
            result: 'failed',
            failed_step: 'verify',
            duration_ms: 300
          },
          {
            cycle_id: 'cycle-003',
            started_at: '2026-03-16T02:00:00.000Z',
            result: 'failed',
            failed_step: 'execute',
            duration_ms: 500
          }
        ]
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(repo, '.playbook', 'cycle-state.json'),
    JSON.stringify(
      {
        cycle_version: 1,
        repo,
        cycle_id: 'cycle-003',
        started_at: '2026-03-16T02:00:00.000Z',
        result: 'failed',
        failed_step: 'execute',
        steps: [
          { name: 'verify', status: 'success', duration_ms: 100 },
          { name: 'route', status: 'success', duration_ms: 100 },
          { name: 'execute', status: 'failure', duration_ms: 300 }
        ],
        artifacts_written: ['.playbook/cycle-state.json', '.playbook/cycle-history.json']
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(repo, '.playbook', 'memory', 'index.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        generatedAt: '2026-03-14T04:00:00.000Z',
        total_events: 2,
        by_event_type: {
          execution_outcome: { count: 1, latest_timestamp: '2026-03-14T04:00:00.000Z' },
          improvement_signal: { count: 0, latest_timestamp: null },
          lane_transition: { count: 0, latest_timestamp: null },
          route_decision: { count: 1, latest_timestamp: '2026-03-14T01:00:00.000Z' },
          worker_assignment: { count: 0, latest_timestamp: null },
          lane_outcome: { count: 0, latest_timestamp: null },
          improvement_candidate: { count: 0, latest_timestamp: null }
        }
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
    expect((payload.process as Record<string, unknown>).total_records).toBe(2);
    expect((payload.process as Record<string, unknown>).route_id_counts).toEqual({
      'deterministic_local:docs_only': 1,
      'deterministic_local:engine_scoring': 1
    });
    expect((payload.outcomes as Record<string, unknown>).sum_plan_churn).toBe(3);
    expect((payload.lane_scores as Record<string, unknown>).total_records).toBe(1);

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
    expect((payload.metrics as Record<string, unknown>).first_pass_yield).toBe(0.5);
    const sources = payload.sourceArtifacts as Record<string, Record<string, unknown>>;
    expect(sources.taskExecutionProfile.available).toBe(false);

    logSpy.mockRestore();
  });

  it('compacts telemetry+memory signals into deterministic learning artifact', async () => {
    const repo = createRepo('playbook-learning-compaction');
    writeTelemetryArtifacts(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTelemetry(repo, ['learning'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.kind).toBe('learning-compaction');
    const summary = payload.summary as Record<string, unknown>;
    expect(summary.source_run_ids).toEqual(['run-alpha', 'run-beta']);
    expect((summary.route_patterns as Array<Record<string, unknown>>)[0]?.route_id).toBe('deterministic_local:docs_only');
    expect((summary.recurring_failures as Array<Record<string, unknown>>).some((entry) => entry.signal_id === 'failure.retry-heavy.engine_scoring')).toBe(true);
    expect((summary.open_questions as string[]).includes('Low cross-run evidence: collect at least two run_ids before promotion decisions.')).toBe(false);

    const written = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'learning-compaction.json'), 'utf8')) as Record<string, unknown>;
    expect((written.summary as Record<string, unknown>).summary_id).toBe(summary.summary_id);

    logSpy.mockRestore();
  });

  it('degrades gracefully for partial artifacts with open questions', async () => {
    const repo = createRepo('playbook-learning-compaction-partial');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTelemetry(repo, ['learning'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const summary = payload.summary as Record<string, unknown>;
    expect(summary.source_run_ids).toEqual([]);
    expect(payload.sourceArtifacts).toBeDefined();
    expect((summary.open_questions as string[]).length).toBeGreaterThan(0);

    logSpy.mockRestore();
  });
});



  it('shows help side-effect-free', async () => {
    const repo = createRepo('playbook-telemetry-help');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTelemetry(repo, ['--help'], { format: 'text', quiet: false, help: true });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Usage: playbook telemetry <subcommand> [options]');
    expect(fs.existsSync(path.join(repo, '.playbook', 'learning-compaction.json'))).toBe(false);

    logSpy.mockRestore();
  });

  it('returns deterministic missing-artifact failure for outcomes', async () => {
    const repo = createRepo('playbook-telemetry-missing');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTelemetry(repo, ['outcomes'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('telemetry');
    expect(payload.findings[0].id).toBe('telemetry.outcomes.missing-artifact');

    logSpy.mockRestore();
  });


it('summarizes cycle telemetry as json from governed cycle artifacts', async () => {
  const repo = createRepo('playbook-telemetry-cycle-json');
  writeTelemetryArtifacts(repo);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const exitCode = await runTelemetry(repo, ['cycle'], { format: 'json', quiet: false });

  expect(exitCode).toBe(ExitCode.Success);
  const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
  expect(payload.cycles_total).toBe(3);
  expect(payload.cycles_success).toBe(1);
  expect(payload.cycles_failed).toBe(2);
  expect(payload.success_rate).toBeCloseTo(0.3333, 4);
  expect(payload.average_duration_ms).toBe(333.33);
  expect(payload.most_common_failed_step).toBe('execute');
  expect(payload.failure_distribution).toEqual({ execute: 1, verify: 1 });
  expect((payload.recent_cycles as Array<Record<string, unknown>>)[0]?.cycle_id).toBe('cycle-003');
  expect((payload.latest_cycle_state as Record<string, unknown>).cycle_id).toBe('cycle-003');

  logSpy.mockRestore();
});

it('returns safe deterministic empty cycle telemetry when history artifact is missing', async () => {
  const repo = createRepo('playbook-telemetry-cycle-missing');
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const exitCode = await runTelemetry(repo, ['cycle'], { format: 'json', quiet: false });

  expect(exitCode).toBe(ExitCode.Success);
  const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
  expect(payload).toEqual({
    cycles_total: 0,
    cycles_success: 0,
    cycles_failed: 0,
    success_rate: 0,
    average_duration_ms: 0,
    most_common_failed_step: null,
    failure_distribution: {},
    recent_cycles: []
  });

  logSpy.mockRestore();
});

describe('command registry', () => {
  it('registers the telemetry command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'telemetry');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Inspect deterministic repository/process telemetry and compact cross-run learning summaries');
  });
});


it('prints command-quality summary as json with stable shape', async () => {
  const repo = createRepo('playbook-telemetry-commands-json');
  writeTelemetryArtifacts(repo);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const exitCode = await runTelemetry(repo, ['commands'], { format: 'json', quiet: false });

  expect(exitCode).toBe(ExitCode.Success);
  const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
  expect(payload.kind).toBe('command-quality-summary');
  const commands = payload.commands as Array<Record<string, unknown>>;
  expect(commands.map((entry) => entry.command_name)).toEqual(['verify', 'route', 'orchestrate', 'execute', 'telemetry', 'improve']);
  expect(commands[0]?.success_rate).toBe(0.5);
  expect(commands[3]?.total_runs).toBe(0);

  logSpy.mockRestore();
});

it('returns deterministic missing-artifact failure for commands', async () => {
  const repo = createRepo('playbook-telemetry-commands-missing');
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const exitCode = await runTelemetry(repo, ['commands'], { format: 'json', quiet: false });

  expect(exitCode).toBe(ExitCode.Failure);
  const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
  expect(payload.command).toBe('telemetry');
  expect(payload.findings[0].id).toBe('telemetry.commands.missing-artifact');

  logSpy.mockRestore();
});
