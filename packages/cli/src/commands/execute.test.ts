import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runExecution } from './execute.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

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
        dependency_level: 'low',
        recommended_pr_size: 'small',
        worker_ready: true,
        codex_prompt: 'Prompt lane 1'
      },
      {
        lane_id: 'lane-2',
        task_ids: ['task-2'],
        task_families: ['cli_command'],
        expected_surfaces: ['packages/cli/src/commands/index.ts'],
        likely_conflict_surfaces: [],
        dependency_level: 'medium',
        recommended_pr_size: 'small',
        worker_ready: true,
        codex_prompt: 'Prompt lane 2'
      }
    ],
    blocked_tasks: [],
    dependency_edges: [],
    merge_risk_notes: [],
    sourceArtifacts: {
      tasksFile: { available: true, artifactPath: './fixtures/tasks.json' },
      taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
      learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
    },
    warnings: []
  };

  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.playbook', 'workset-plan.json'), `${JSON.stringify(workset, null, 2)}\n`, 'utf8');
};

describe('runExecution', () => {
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
});

describe('command registry', () => {
  it('registers execute command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'execute');
    expect(command).toBeDefined();
  });
});
