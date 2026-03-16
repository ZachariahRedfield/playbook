import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendCommandExecutionQualityRecord,
  readCommandExecutionQualityArtifact,
  summarizeCommandExecutionQuality
} from './commandQuality.js';

const repos: string[] = [];

afterEach(() => {
  for (const repo of repos.splice(0)) {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe('commandQuality telemetry', () => {
  it('emits deterministic records and aggregate summary', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-command-quality-'));
    repos.push(repo);

    appendCommandExecutionQualityRecord(repo, {
      command_name: 'verify',
      run_id: 'run-001',
      recorded_at: '2026-01-01T00:00:00.000Z',
      inputs_summary: 'policy=off',
      artifacts_read: ['.playbook/config.json'],
      artifacts_written: ['.playbook/findings.json'],
      success_status: 'success',
      duration_ms: 120,
      warnings_count: 0,
      open_questions_count: 0,
      confidence_score: 0.9,
      downstream_artifacts_produced: ['.playbook/findings.json']
    });

    appendCommandExecutionQualityRecord(repo, {
      command_name: 'route',
      run_id: 'run-002',
      recorded_at: '2026-01-01T00:00:01.000Z',
      inputs_summary: 'task=unknown',
      artifacts_read: [],
      artifacts_written: ['.playbook/execution-plan.json'],
      success_status: 'partial',
      duration_ms: 80,
      warnings_count: 2,
      open_questions_count: 1,
      confidence_score: 0.4,
      downstream_artifacts_produced: ['.playbook/execution-plan.json']
    });

    const artifact = readCommandExecutionQualityArtifact(repo);
    expect(artifact.records).toHaveLength(2);
    expect(artifact.summary.partial_runs).toBe(1);
    expect(artifact.summary.average_duration_ms).toBe(100);

    const persisted = JSON.parse(
      fs.readFileSync(path.join(repo, '.playbook', 'telemetry', 'command-quality.json'), 'utf8')
    ) as { summary: { total_runs: number } };
    expect(persisted.summary.total_runs).toBe(2);
  });

  it('summarizes partial-failure behavior deterministically', () => {
    const summary = summarizeCommandExecutionQuality([
      {
        command_name: 'execute',
        run_id: 'run-100',
        recorded_at: '2026-01-01T00:00:00.000Z',
        inputs_summary: 'workset=true',
        artifacts_read: ['.playbook/workset-plan.json'],
        artifacts_written: ['.playbook/execution-state.json'],
        success_status: 'partial',
        duration_ms: 250,
        warnings_count: 1,
        open_questions_count: 2,
        confidence_score: 0.5,
        downstream_artifacts_produced: ['.playbook/execution-state.json']
      }
    ]);

    expect(summary.total_runs).toBe(1);
    expect(summary.partial_runs).toBe(1);
    expect(summary.failure_runs).toBe(0);
    expect(summary.total_open_questions).toBe(2);
  });
});
