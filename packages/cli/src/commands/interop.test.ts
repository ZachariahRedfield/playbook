import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runInterop } from './interop.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-interop-'));

const writeArtifact = (repo: string, relativePath: string, payload: unknown): void => {
  const absolute = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, JSON.stringify(payload, null, 2));
};

describe('runInterop', () => {
  it('registers interop command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'interop');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Inspect and run remediation-first Playbook↔Lifeline interop contracts from rendezvous artifacts');
  });

  it('returns stable JSON payload for capabilities read surface', async () => {
    const repo = createRepo();
    await runInterop(repo, ['register', '--capability', 'lifeline-remediation-v1', '--action', 'adjust_upcoming_workout_load'], { format: 'json', quiet: false });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runInterop(repo, ['capabilities'], { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as {
      command: string;
      subcommand: string;
      payload: Array<{ capability_id: string; action_kind: string; receipt_type: string; routing: { topic: string } }>;
    };

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.command).toBe('interop');
    expect(payload.subcommand).toBe('capabilities');
    expect(payload.payload).toEqual([
      {
        capability_id: 'lifeline-remediation-v1',
        action_kind: 'adjust_upcoming_workout_load',
        receipt_type: 'schedule_adjustment_applied',
        routing: {
          topic: 'fitness.actions.training-load',
          must_route_through_playbook_plan: true,
          no_direct_lifeline_bypass: true
        },
        version: '1.0.0',
        runtime_id: 'lifeline-mock-runtime',
        idempotency_key_prefix: 'lifeline:adjust_upcoming_workout_load',
        registered_at: expect.any(String)
      }
    ]);
  });

  it('supports deterministic register -> emit -> run-mock lifecycle against temp artifact fixtures', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/rendezvous-manifest.json', {
      remediationId: 'remediation-001',
      requiredArtifactIds: ['fitness-contract', 'rendezvous-status']
    });

    expect(await runInterop(repo, ['register', '--capability', 'lifeline-remediation-v1', '--action', 'adjust_upcoming_workout_load'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runInterop(repo, ['emit', '--capability', 'lifeline-remediation-v1', '--action', 'adjust_upcoming_workout_load'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runInterop(repo, ['run-mock'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const runtime = JSON.parse(fs.readFileSync(path.join(repo, '.playbook/lifeline-interop-runtime.json'), 'utf8')) as {
      requests: Array<{ request_state: string; action_kind: string; receipt_type: string; routing: { topic: string } }>;
      receipts: Array<{ outcome: string; action_kind: string; receipt_type: string; routing: { topic: string } }>;
      heartbeat: { health: string };
    };

    expect(runtime.requests).toHaveLength(1);
    expect(runtime.requests[0]).toMatchObject({
      request_state: 'completed',
      action_kind: 'adjust_upcoming_workout_load',
      receipt_type: 'schedule_adjustment_applied',
      routing: { topic: 'fitness.actions.training-load' }
    });
    expect(runtime.receipts[0]).toMatchObject({
      outcome: 'completed',
      action_kind: 'adjust_upcoming_workout_load',
      receipt_type: 'schedule_adjustment_applied',
      routing: { topic: 'fitness.actions.training-load' }
    });
    expect(runtime.heartbeat.health).toBe('healthy');
  });
});
