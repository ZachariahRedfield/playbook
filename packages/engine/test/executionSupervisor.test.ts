import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { finalizeExecution, recordWorkerResult, startExecution, updateLaneState, type WorksetPlanArtifact } from '../src/index.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-exec-supervisor-'));

const worksetPlanFixture = (): WorksetPlanArtifact => ({
  schemaVersion: '1.0',
  kind: 'workset-plan',
  generatedAt: new Date(0).toISOString(),
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
      codex_prompt: 'lane-1'
    }
  ],
  blocked_tasks: [],
  dependency_edges: [],
  merge_risk_notes: [],
  sourceArtifacts: {
    tasksFile: { available: true, artifactPath: 'tasks.json' },
    taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
    learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
  },
  warnings: []
});

describe('execution supervisor', () => {
  it('writes deterministic execution-state and telemetry records', async () => {
    const repo = createRepo();
    const run = await startExecution(worksetPlanFixture(), repo);

    await updateLaneState('lane-1', 'running', repo);
    await recordWorkerResult('lane-1', 'worker-1', { status: 'completed', retries: 0 }, repo);
    await finalizeExecution(run.runId, repo);

    const executionState = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'execution-state.json'), 'utf8')) as {
      data: { status: string; lanes: Record<string, { state: string }>; workers: Record<string, { status: string }> };
    };
    expect(executionState.data.status).toBe('completed');
    expect(executionState.data.lanes['lane-1']?.state).toBe('completed');
    expect(executionState.data.workers['worker-1']?.status).toBe('completed');

    const processTelemetry = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'process-telemetry.json'), 'utf8')) as { records: Array<{ task_family: string }> };
    expect(processTelemetry.records.map((record) => record.task_family).sort((a, b) => a.localeCompare(b))).toEqual([
      'lane_execution_duration',
      'retry_pressure',
      'worker_success_rate'
    ]);

    const outcomeTelemetry = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'outcome-telemetry.json'), 'utf8')) as { lane_scores: Array<{ lane_id: string; score: number }> };
    expect(outcomeTelemetry.lane_scores[0]?.lane_id).toBe('lane-1');
    expect(outcomeTelemetry.lane_scores[0]?.score).toBeGreaterThanOrEqual(0);
  });
});
