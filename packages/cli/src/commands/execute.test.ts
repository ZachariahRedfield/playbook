import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands, runRegisteredCommand } from './index.js';
import { runExecution } from './execute.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const absolute = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeWorksetPlan = (repo: string): void => {
  const workset = {
    schemaVersion: '1.0',
    kind: 'workset-plan',
    generatedAt: '1970-01-01T00:00:00.000Z',
    proposalOnly: true,
    input_tasks: [],
    routed_tasks: [],
    lanes: [
      {
        lane_id: 'lane-1',
        task_ids: ['task-1'],
        task_families: ['docs_only'],
        expected_surfaces: ['docs/README.md'],
        likely_conflict_surfaces: [],
        readiness_status: 'ready',
        blocking_reasons: [],
        conflict_surface_paths: [],
        shared_artifact_risk: 'low',
        assignment_confidence: 0.94,
        dependency_level: 'low',
        recommended_pr_size: 'small',
        worker_ready: true,
        codex_prompt: 'Prompt lane 1',
        protected_doc_consolidation: {
          has_protected_doc_work: false,
          stage: 'not_applicable',
          summary: 'no protected-doc work',
          next_command: null
        }
      },
      {
        lane_id: 'lane-2',
        task_ids: ['task-2'],
        task_families: ['cli_command'],
        expected_surfaces: ['packages/cli/src/commands/index.ts'],
        likely_conflict_surfaces: [],
        readiness_status: 'ready',
        blocking_reasons: [],
        conflict_surface_paths: [],
        shared_artifact_risk: 'low',
        assignment_confidence: 0.84,
        dependency_level: 'medium',
        recommended_pr_size: 'small',
        worker_ready: true,
        codex_prompt: 'Prompt lane 2',
        protected_doc_consolidation: {
          has_protected_doc_work: false,
          stage: 'not_applicable',
          summary: 'no protected-doc work',
          next_command: null
        }
      }
    ],
    blocked_tasks: [],
    dependency_edges: [],
    validation: {
      overlapping_file_domains: [],
      conflicting_artifact_ownership: [],
      blocked_lane_dependencies: []
    },
    merge_risk_notes: [],
    sourceArtifacts: {
      tasksFile: { available: true, artifactPath: './fixtures/tasks.json' },
      taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
      learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
    },
    warnings: []
  };

  writeJson(repo, '.playbook/workset-plan.json', workset);
};

const writeAdoptionRepo = (repo: string): void => {
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
};

const writeAdapter = (repo: string, body: string): string => {
  const adapterPath = path.join(repo, 'adapter.mjs');
  fs.writeFileSync(adapterPath, body, 'utf8');
  return `node ${adapterPath}`;
};

describe('runExecution', () => {
  it('prints help and exits successfully without requiring workset plan', async () => {
    const repo = createRepo('playbook-cli-execute-help');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runExecution(repo, { format: 'text', quiet: false, help: true });

    expect(code).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Usage: playbook execute [options]');
    expect(fs.existsSync(path.join(repo, '.playbook', 'workset-plan.json'))).toBe(false);

    logSpy.mockRestore();
  });

  it('returns deterministic missing artifact failure when workset plan is absent', async () => {
    const repo = createRepo('playbook-cli-execute-missing');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runExecution(repo, { format: 'json', quiet: false });

    expect(code).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('execute');
    expect(payload.findings[0].id).toBe('execute.workset-plan.missing');

    logSpy.mockRestore();
  });

  it('runs deterministic supervisor flow and writes execution-state', async () => {
    const repo = createRepo('playbook-cli-execute');
    writeWorksetPlan(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const code = await runExecution(repo, { format: 'json', quiet: false });

    expect(code).toBe(ExitCode.Success);
    expect(fs.existsSync(path.join(repo, '.playbook', 'execution-state.json'))).toBe(true);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { command: string; execution_status: string; lanes: Array<{ state: string }> };
    expect(payload.command).toBe('execute');
    expect(payload.execution_status).toBe('SUCCESS');
    expect(payload.lanes.every((lane) => lane.state === 'completed')).toBe(true);

    logSpy.mockRestore();
  });

  it('bridges successful worker adapter results into canonical receipt/update artifacts', async () => {
    const repo = createRepo('playbook-cli-execute-bridge-success');
    writeAdoptionRepo(repo);
    const adapter = writeAdapter(repo, `
      import fs from 'node:fs';
      const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
      const result = payload.prompt_id.includes('index_lane')
        ? { repo_id: payload.repo_id, prompt_id: payload.prompt_id, status: 'success', observed_transition: { from: 'playbook_detected_index_pending', to: 'indexed_plan_pending' } }
        : { repo_id: payload.repo_id, prompt_id: payload.prompt_id, status: 'success', observed_transition: { from: 'playbook_detected_index_pending', to: 'planned_apply_pending' } };
      process.stdout.write(JSON.stringify(result));
    `);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const code = await runExecution(repo, { format: 'json', quiet: false, workerAdapter: adapter });

    expect(code).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('bridge');
    expect(payload.execution_outcome_input.prompt_outcomes).toHaveLength(2);
    expect(payload.updated_state.summary.completed_repo_ids).toEqual(['current-repo']);
    expect(fs.existsSync(path.join(repo, '.playbook', 'execution-outcome-input.json'))).toBe(true);
    expect(fs.existsSync(path.join(repo, '.playbook', 'execution-updated-state.json'))).toBe(true);

    logSpy.mockRestore();
  });

  it('preserves deterministic ordering and surfaces partial failure outcomes', async () => {
    const repo = createRepo('playbook-cli-execute-bridge-partial');
    writeAdoptionRepo(repo);
    const adapter = writeAdapter(repo, `
      import fs from 'node:fs';
      const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
      const result = payload.prompt_id.includes('index_lane')
        ? { repo_id: payload.repo_id, prompt_id: payload.prompt_id, status: 'failed', error: 'index unavailable' }
        : { repo_id: payload.repo_id, prompt_id: payload.prompt_id, status: 'not_run', error: 'blocked on prior lane' };
      process.stdout.write(JSON.stringify(result));
    `);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const code = await runExecution(repo, { format: 'json', quiet: false, workerAdapter: adapter });

    expect(code).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.execution_outcome_input.prompt_outcomes.map((entry: { prompt_id: string }) => entry.prompt_id)).toEqual([
      'wave_1:index_lane:current-repo',
      'wave_2:verify/plan_lane:current-repo'
    ]);
    expect(payload.updated_state.summary.repos_needing_retry).toEqual(['current-repo']);

    logSpy.mockRestore();
  });

  it('fails cleanly when the worker adapter is unavailable', async () => {
    const repo = createRepo('playbook-cli-execute-bridge-unavailable');
    writeAdoptionRepo(repo);

    await expect(runExecution(repo, { format: 'json', quiet: false, workerAdapter: 'definitely-missing-adapter-command' })).rejects.toThrow(/worker adapter/);
    expect(fs.existsSync(path.join(repo, '.playbook', 'execution-outcome-input.json'))).toBe(false);
  });

  it('fails before canonical ingest when worker adapter output is malformed and preserves committed state', async () => {
    const repo = createRepo('playbook-cli-execute-bridge-malformed');
    writeAdoptionRepo(repo);
    writeJson(repo, '.playbook/execution-updated-state.json', { preserved: true });
    const adapter = writeAdapter(repo, `process.stdout.write('{"bad":true}')`);

    await expect(runExecution(repo, { format: 'json', quiet: false, workerAdapter: adapter })).rejects.toThrow(/missing repo_id/);
    const preserved = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'execution-updated-state.json'), 'utf8'));
    expect(preserved).toEqual({ preserved: true });
    expect(fs.existsSync(path.join(repo, '.playbook', 'execution-outcome-input.json'))).toBe(false);
  });
});

describe('command registry', () => {
  it('registers execute command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'execute');
    expect(command).toBeDefined();
  });

  it('short-circuits execute --help before runtime artifacts', async () => {
    const repo = createRepo('playbook-cli-execute-registry-help');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await runRegisteredCommand('execute', {
      cwd: repo,
      args: ['execute', '--help'],
      commandArgs: ['--help'],
      ci: false,
      explain: false,
      format: 'text',
      quiet: false
    });

    expect(result.exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Usage: playbook execute [options]');

    logSpy.mockRestore();
  });
});
