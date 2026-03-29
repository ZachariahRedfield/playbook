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
      payload: Array<{ capability_id: string; action_kind: string; receipt_type: string; routing: { channel: string; target: string; priority: string; maxDeliveryLatencySeconds: number } }>;
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
          channel: 'fitness.actions',
          target: 'training-load',
          priority: 'high',
          maxDeliveryLatencySeconds: 300
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
      requests: Array<{ request_state: string; action_kind: string; receipt_type: string; routing: { channel: string; target: string; priority: string; maxDeliveryLatencySeconds: number } }>;
      receipts: Array<{ outcome: string; action_kind: string; receipt_type: string; routing: { channel: string; target: string; priority: string; maxDeliveryLatencySeconds: number } }>;
      heartbeat: { health: string };
    };

    expect(runtime.requests).toHaveLength(1);
    expect(runtime.requests[0]).toMatchObject({
      request_state: 'completed',
      action_kind: 'adjust_upcoming_workout_load',
      receipt_type: 'schedule_adjustment_applied',
      routing: { channel: 'fitness.actions', target: 'training-load', priority: 'high', maxDeliveryLatencySeconds: 300 },
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        workout_id: 'workout-001',
        load_adjustment_percent: -10,
        duration_days: 3,
        reason_code: 'fatigue_spike'
      }
    });
    expect(runtime.receipts[0]).toMatchObject({
      outcome: 'completed',
      action_kind: 'adjust_upcoming_workout_load',
      receipt_type: 'schedule_adjustment_applied',
      routing: { channel: 'fitness.actions', target: 'training-load', priority: 'high', maxDeliveryLatencySeconds: 300 }
    });
    expect(runtime.heartbeat.health).toBe('healthy');
  });

  it('rejects emit when provided bounded action input violates canonical fitness contract fields', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/rendezvous-manifest.json', {
      remediationId: 'remediation-001',
      requiredArtifactIds: ['fitness-contract', 'rendezvous-status']
    });

    expect(await runInterop(repo, ['register', '--capability', 'lifeline-remediation-v1', '--action', 'adjust_upcoming_workout_load'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const exitCode = await runInterop(
      repo,
      [
        'emit',
        '--capability',
        'lifeline-remediation-v1',
        '--action',
        'adjust_upcoming_workout_load',
        '--action-input-json',
        '{"athlete_id":"athlete-001","week_id":"week-2026-W13","workout_id":"workout-001","load_adjustment_percent":-10,"duration_days":3,"reason_code":"not_in_contract"}'
      ],
      { format: 'json', quiet: false }
    );

    expect(exitCode).toBe(ExitCode.Failure);
  });

  it('emits Fitness request from rendezvous/plan-derived command path and preserves canonical routing/receipt metadata', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/rendezvous-manifest.json', {
      remediationId: 'remediation-interop-fit-1',
      requiredArtifactIds: ['fitness-contract']
    });
    writeArtifact(repo, '.playbook/rendezvous-status.json', {
      evaluation: { state: 'complete', releaseReady: true, blockers: [], missingArtifactIds: [], conflictingArtifactIds: [], stale: false }
    });

    expect(await runInterop(repo, ['register', '--capability', 'lifeline-remediation-v1', '--action', 'schedule_recovery_block'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runInterop(repo, ['emit-fitness-plan', '--capability', 'lifeline-remediation-v1', '--action', 'schedule_recovery_block'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const runtime = JSON.parse(fs.readFileSync(path.join(repo, '.playbook/lifeline-interop-runtime.json'), 'utf8')) as {
      requests: Array<{ action_kind: string; receipt_type: string; routing: { channel: string; target: string; priority: string; maxDeliveryLatencySeconds: number } }>;
    };
    expect(runtime.requests[0]).toMatchObject({
      action_kind: 'schedule_recovery_block',
      receipt_type: 'recovery_guardrail_applied',
      routing: {
        channel: 'fitness.actions',
        target: 'recovery',
        priority: 'high',
        maxDeliveryLatencySeconds: 300
      }
    });
  });

  it('blocks plan-derived Fitness request emission when plan state is not explicitly approved', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/plan.json', { command: 'plan', tasks: [] });
    expect(await runInterop(repo, ['register', '--capability', 'lifeline-remediation-v1', '--action', 'schedule_recovery_block'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const blockedExit = await runInterop(repo, ['emit-fitness-plan', '--capability', 'lifeline-remediation-v1', '--action', 'schedule_recovery_block'], { format: 'json', quiet: false });
    expect(blockedExit).toBe(ExitCode.Failure);

    const allowedExit = await runInterop(repo, ['emit-fitness-plan', '--capability', 'lifeline-remediation-v1', '--action', 'schedule_recovery_block', '--approved-plan'], { format: 'json', quiet: false });
    expect(allowedExit).toBe(ExitCode.Success);
  });

  it('exposes consumed fitness contract inspect surface with deterministic summary and artifact', async () => {
    const repo = createRepo();
    writeArtifact(repo, 'playbook.fitness.config.json', {
      fitnessContractSource: {
        sourceRepo: 'ZachariahRedfield/fawxzzy-fitness',
        sourceRef: 'main',
        sourcePath: 'src/lib/ecosystem/fitness-integration-contract.ts',
        syncMode: 'mirrored'
      }
    });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runInterop(repo, ['fitness-contract'], { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as {
      command: string;
      subcommand: string;
      payload: {
        sourceRepo: string;
        sourceRef: string;
        sourcePath: string;
        syncMode: string;
        sourceHash: string;
        canonicalPayloadSummary: {
          appIdentity: { kind: string; schemaVersion: string };
          signalNames: string[];
          stateSnapshotTypes: string[];
          boundedActionNames: string[];
          receiptTypes: string[];
        };
        contract: {
          signalTypes: string[];
          stateSnapshotTypes: string[];
          actions: Array<{ name: string; receiptType: string }>;
          receiptTypes: string[];
        };
      };
    };

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.command).toBe('interop');
    expect(payload.subcommand).toBe('fitness-contract');
    expect(payload.payload.sourceRepo).toBe('ZachariahRedfield/fawxzzy-fitness');
    expect(payload.payload.sourceRef).toBe('main');
    expect(payload.payload.sourcePath).toBe('src/lib/ecosystem/fitness-integration-contract.ts');
    expect(payload.payload.syncMode).toBe('mirrored');
    expect(payload.payload.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.payload.canonicalPayloadSummary).toEqual({
      appIdentity: {
        kind: 'fitness-integration-contract',
        schemaVersion: '1.0'
      },
      signalNames: [
        'fitness.session.events',
        'fitness.recovery.events',
        'fitness.goal.events'
      ],
      stateSnapshotTypes: [
        'fitness.session.snapshot',
        'fitness.recovery.snapshot',
        'fitness.goal.snapshot'
      ],
      boundedActionNames: [
        'adjust_upcoming_workout_load',
        'schedule_recovery_block',
        'revise_weekly_goal_plan'
      ],
      receiptTypes: [
        'schedule_adjustment_applied',
        'recovery_guardrail_applied',
        'goal_plan_amended'
      ]
    });
    expect(payload.payload.contract.actions.map((entry) => entry.name)).toEqual([
      'adjust_upcoming_workout_load',
      'schedule_recovery_block',
      'revise_weekly_goal_plan'
    ]);

    const artifact = JSON.parse(fs.readFileSync(path.join(repo, '.playbook/fitness-contract.json'), 'utf8')) as {
      kind: string;
      source: { sourceRepo: string; sourceRef: string; sourcePath: string; syncMode: string };
      fingerprint: string;
    };
    expect(artifact.kind).toBe('fitness-contract-artifact');
    expect(artifact.source).toMatchObject({
      sourceRepo: 'ZachariahRedfield/fawxzzy-fitness',
      sourceRef: 'main',
      sourcePath: 'src/lib/ecosystem/fitness-integration-contract.ts',
      syncMode: 'mirrored'
    });
    expect(artifact.fingerprint).toBe(payload.payload.sourceHash);
  });
});
