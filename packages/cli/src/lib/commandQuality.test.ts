import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCommandQualityTracker } from './commandQuality.js';

const readJson = <T>(repo: string, relativePath: string): T =>
  JSON.parse(fs.readFileSync(path.join(repo, relativePath), 'utf8')) as T;

describe('createCommandQualityTracker', () => {
  it('writes deterministic command-quality records and command_execution memory event', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-command-quality-'));
    const tracker = createCommandQualityTracker(repo, 'telemetry');

    tracker.finish({
      inputsSummary: 'subcommand=summary',
      artifactsRead: ['.playbook/process-telemetry.json', '.playbook/outcome-telemetry.json'],
      artifactsWritten: ['.playbook/telemetry/command-quality.json'],
      downstreamArtifactsProduced: ['.playbook/telemetry/command-quality.json'],
      successStatus: 'partial',
      warningsCount: 1,
      openQuestionsCount: 2,
      confidenceScore: 0.55
    });

    const qualityArtifact = readJson<{ records: Array<Record<string, unknown>> }>(repo, '.playbook/telemetry/command-quality.json');
    expect(qualityArtifact.records).toHaveLength(1);
    expect(Object.keys(qualityArtifact.records[0] ?? {})).toEqual([...Object.keys(qualityArtifact.records[0] ?? {})].sort((a, b) => a.localeCompare(b)));
    expect(qualityArtifact.records[0]).toMatchObject({
      command_name: 'telemetry',
      success_status: 'partial',
      warnings_count: 1,
      open_questions_count: 2
    });

    const eventsDir = path.join(repo, '.playbook', 'memory', 'events');
    const eventFiles = fs.readdirSync(eventsDir).sort((left, right) => left.localeCompare(right));
    expect(eventFiles.length).toBeGreaterThanOrEqual(2);

    const commandExecutionEvent = eventFiles
      .map((file) => readJson<{ event_type: string; payload: { command_name?: string } }>(repo, path.join('.playbook/memory/events', file)))
      .find((event) => event.event_type === 'command_execution');

    expect(commandExecutionEvent).toBeDefined();
    expect(commandExecutionEvent?.payload.command_name).toBe('telemetry');
  });

  it('does not throw when command-quality artifact append fails', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-command-quality-readonly-'));
    const telemetryDir = path.join(repo, '.playbook', 'telemetry');
    fs.mkdirSync(telemetryDir, { recursive: true });
    fs.chmodSync(telemetryDir, 0o555);

    const tracker = createCommandQualityTracker(repo, 'telemetry');

    expect(() =>
      tracker.finish({
        inputsSummary: 'subcommand=summary',
        successStatus: 'failure',
        warningsCount: 1
      })
    ).not.toThrow();

    fs.chmodSync(telemetryDir, 0o755);
  });

});
