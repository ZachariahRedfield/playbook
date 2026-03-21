import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runLanes } from './lanes/index.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
const repoRoot = path.resolve(import.meta.dirname, '../../../..');

describe('runLanes', () => {
  it('derives lane-state from workset plan and writes artifact', async () => {
    const repo = createRepo('playbook-cli-lanes');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.copyFileSync(
      path.join(repoRoot, 'tests/contracts/workset-plan.fixture.json'),
      path.join(repo, '.playbook', 'workset-plan.json')
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runLanes(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(fs.existsSync(path.join(repo, '.playbook', 'lane-state.json'))).toBe(true);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { command: string; lane_state: { kind: string } };
    expect(payload.command).toBe('lanes');
    expect(payload.lane_state.kind).toBe('lane-state');

    logSpy.mockRestore();
  });

  it('applies proposal-only start and complete lifecycle transitions', async () => {
    const repo = createRepo('playbook-cli-lanes-transitions');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    const singleLaneWorkset = {
      schemaVersion: '1.0',
      kind: 'workset-plan',
      generatedAt: '1970-01-01T00:00:00.000Z',
      proposalOnly: true,
      input_tasks: [{ task_id: 'task-docs', task: 'update docs' }],
      routed_tasks: [],
      lanes: [
        {
          lane_id: 'lane-1',
          task_ids: ['task-docs'],
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
          codex_prompt: 'prompt',
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

    fs.writeFileSync(path.join(repo, '.playbook', 'workset-plan.json'), `${JSON.stringify(singleLaneWorkset, null, 2)}\n`, 'utf8');

    await runLanes(repo, { format: 'json', quiet: false });

    const startLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const startExit = await runLanes(repo, { format: 'json', quiet: false, action: 'start', laneId: 'lane-1' });
    expect(startExit).toBe(ExitCode.Success);
    const startedPayload = JSON.parse(String(startLog.mock.calls[0]?.[0])) as {
      applied: boolean;
      lane_state: { running_lanes: string[] };
    };
    expect(startedPayload.applied).toBe(true);
    expect(startedPayload.lane_state.running_lanes).toContain('lane-1');
    startLog.mockRestore();

    const completeLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const completeExit = await runLanes(repo, { format: 'json', quiet: false, action: 'complete', laneId: 'lane-1' });
    expect(completeExit).toBe(ExitCode.Success);
    const completedPayload = JSON.parse(String(completeLog.mock.calls[0]?.[0])) as {
      applied: boolean;
      lane_state: { merge_ready_lanes: string[] };
    };
    expect(completedPayload.applied).toBe(true);
    expect(completedPayload.lane_state.merge_ready_lanes).toContain('lane-1');
    completeLog.mockRestore();
  });

  it('returns deterministic missing-workset error in json mode', async () => {
    const repo = createRepo('playbook-cli-lanes-missing');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runLanes(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { command: string; error: string };
    expect(payload.command).toBe('lanes');
    expect(payload.error).toContain('missing workset plan');

    logSpy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the lanes command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'lanes');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Derive deterministic lane-state from .playbook/workset-plan.json');
  });
});
