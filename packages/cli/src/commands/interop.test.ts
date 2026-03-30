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

  it('returns deterministic followups payload with type/surface filtering and no mutation', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/interop-followups.json', {
      schemaVersion: '1.0',
      kind: 'interop-followups-artifact',
      command: 'interop followups',
      reviewOnly: true,
      authority: { mutation: 'read-only', promotion: 'review-required' },
      sourceArtifact: {
        path: '.playbook/interop-updated-truth.json',
        contractSourceHash: 'hash-1',
        contractSourceRef: 'main',
        contractSourcePath: 'src/lib/ecosystem/fitness-integration-contract.ts'
      },
      followups: [
        {
          followupId: 'followup-1',
          source: { receiptId: 'receipt-1', requestId: 'request-1' },
          action: 'queue-next-plan-hint',
          targetSurface: '.playbook/plan.json',
          followupType: 'next-plan-hint',
          provenanceRefs: ['.playbook/interop-updated-truth.json'],
          nextActionText: 'Use request request-1 outcome as a bounded next-plan hint.',
          confidence: { score: 0.87, rationale: 'deterministic' }
        },
        {
          followupId: 'followup-2',
          source: { receiptId: 'receipt-2', requestId: 'request-2' },
          action: 'queue-review-cue',
          targetSurface: '.playbook/review-queue.json',
          followupType: 'review-cue',
          provenanceRefs: ['.playbook/interop-updated-truth.json'],
          nextActionText: 'Attach receipt receipt-2 to review queue evidence.',
          confidence: { score: 0.85, rationale: 'deterministic' }
        }
      ]
    });

    const before = fs.readFileSync(path.join(repo, '.playbook/interop-followups.json'), 'utf8');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runInterop(
      repo,
      ['followups', '--type', 'next-plan-hint', '--surface', '.playbook/plan.json'],
      { format: 'json', quiet: false }
    );
    const after = fs.readFileSync(path.join(repo, '.playbook/interop-followups.json'), 'utf8');
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as {
      command: string;
      subcommand: string;
      payload: {
        command: string;
        authority: string;
        proposalOnly: boolean;
        summary: { total: number; returned: number };
        followups: Array<{
          followupId: string;
          followupType: string;
          targetSurface: string;
          action: string;
          nextActionText: string;
          provenanceRefs: string[];
          confidence: { score: number };
          source: { requestId: string; receiptId: string };
        }>;
      };
    };

    expect(exitCode).toBe(ExitCode.Success);
    expect(before).toBe(after);
    expect(payload.command).toBe('interop');
    expect(payload.subcommand).toBe('followups');
    expect(payload.payload.command).toBe('interop-followups');
    expect(payload.payload.authority).toBe('read-only');
    expect(payload.payload.proposalOnly).toBe(true);
    expect(payload.payload.summary).toEqual({ total: 2, returned: 1 });
    expect(payload.payload.followups).toMatchObject([
      {
        followupId: 'followup-1',
        followupType: 'next-plan-hint',
        targetSurface: '.playbook/plan.json',
        action: expect.any(String),
        nextActionText: expect.any(String),
        provenanceRefs: expect.any(Array),
        confidence: { score: expect.any(Number) },
        source: {
          requestId: expect.any(String),
          receiptId: expect.any(String)
        }
      }
    ]);
  });

  it('followups include deterministic enrichment fields', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/interop-followups.json', {
      schemaVersion: '1.0',
      kind: 'interop-followups-artifact',
      command: 'interop followups',
      followups: [
        {
          followupId: 'followup-1',
          source: { receiptId: 'receipt-1', requestId: 'request-1' },
          action: 'queue-memory-candidate',
          targetSurface: '.playbook/memory/candidates.json',
          followupType: 'memory-candidate',
          provenanceRefs: ['.playbook/interop-updated-truth.json', 'receipt:receipt-1'],
          nextActionText: 'Queue request request-1 receipt receipt-1 as memory candidate evidence.',
          confidence: { score: 0.91, rationale: 'deterministic' }
        }
      ]
    });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runInterop(repo, ['followups'], { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as {
      payload: { followups: Array<Record<string, unknown>> };
    };
    const followups = payload.payload.followups as Array<Record<string, unknown>>;
    expect(followups.length).toBeGreaterThan(0);

    const followup = followups[0] as {
      action?: unknown;
      confidence?: { score?: unknown };
      provenanceRefs?: unknown;
      source?: { requestId?: unknown; receiptId?: unknown };
    };

    expect(exitCode).toBe(ExitCode.Success);
    expect(followup.action).toBeTypeOf('string');
    expect(followup.confidence?.score).toBeTypeOf('number');
    expect(Array.isArray(followup.provenanceRefs)).toBe(true);
    expect(followup.source?.requestId).toBeTypeOf('string');
    expect(followup.source?.receiptId).toBeTypeOf('string');
  });

  it('renders compact followups text output', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/interop-followups.json', {
      schemaVersion: '1.0',
      kind: 'interop-followups-artifact',
      command: 'interop followups',
      followups: [
        {
          followupId: 'followup-1',
          targetSurface: '.playbook/plan.json',
          followupType: 'next-plan-hint',
          nextActionText: 'Use request request-1 outcome as a bounded next-plan hint.'
        }
      ]
    });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runInterop(repo, ['followups'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(spy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Status: 1 interop followup(s) queued.',
      'Affected targets: .playbook/plan.json',
      'Next action: Use request request-1 outcome as a bounded next-plan hint.'
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

  it('reconciles canonical fitness receipts into deterministic updated-truth artifact', async () => {
    const repo = createRepo();
    writeArtifact(repo, 'playbook.fitness.config.json', {
      fitnessContractSource: {
        sourceRepo: 'ZachariahRedfield/fawxzzy-fitness',
        sourceRef: 'main',
        sourcePath: 'src/lib/ecosystem/fitness-integration-contract.ts',
        syncMode: 'mirrored'
      }
    });
    writeArtifact(repo, '.playbook/rendezvous-manifest.json', {
      remediationId: 'remediation-interop-fit-2',
      requiredArtifactIds: ['fitness-contract']
    });
    writeArtifact(repo, '.playbook/rendezvous-status.json', {
      evaluation: { state: 'complete', releaseReady: true, blockers: [], missingArtifactIds: [], conflictingArtifactIds: [], stale: false }
    });

    expect(await runInterop(repo, ['register', '--capability', 'lifeline-remediation-v1', '--action', 'adjust_upcoming_workout_load'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runInterop(repo, ['emit-fitness-plan', '--capability', 'lifeline-remediation-v1', '--action', 'adjust_upcoming_workout_load'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runInterop(repo, ['run-mock'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await runInterop(repo, ['reconcile'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const firstPayload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as {
      command: string;
      subcommand: string;
      payload: { updated_truth: { kind: string; updates: Array<{ action: string; receiptType: string; sourceHash: string }> } };
    };
    const firstArtifactRaw = fs.readFileSync(path.join(repo, '.playbook/interop-updated-truth.json'), 'utf8');

    expect(await runInterop(repo, ['reconcile'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const secondArtifactRaw = fs.readFileSync(path.join(repo, '.playbook/interop-updated-truth.json'), 'utf8');

    expect(firstPayload.command).toBe('interop');
    expect(firstPayload.subcommand).toBe('reconcile');
    expect(firstPayload.payload.updated_truth.kind).toBe('interop-updated-truth-artifact');
    expect(firstPayload.payload.updated_truth.updates[0]).toMatchObject({
      action: 'adjust_upcoming_workout_load',
      receiptType: 'schedule_adjustment_applied',
      sourceHash: expect.any(String)
    });
    expect(firstArtifactRaw).toBe(secondArtifactRaw);
  });

  it('rejects reconcile when receipt type/action drift from canonical fitness contract', async () => {
    const repo = createRepo();
    writeArtifact(repo, 'playbook.fitness.config.json', {
      fitnessContractSource: {
        sourceRepo: 'ZachariahRedfield/fawxzzy-fitness',
        sourceRef: 'main',
        sourcePath: 'src/lib/ecosystem/fitness-integration-contract.ts',
        syncMode: 'mirrored'
      }
    });
    writeArtifact(repo, '.playbook/lifeline-interop-runtime.json', {
      schemaVersion: '1.0',
      kind: 'playbook-lifeline-interop-runtime',
      generatedAt: '2026-03-30T00:00:00.000Z',
      capabilities: [],
      requests: [
        {
          request_id: 'interop-0001',
          remediation_id: 'remediation-1',
          action_kind: 'adjust_upcoming_workout_load',
          receipt_type: 'schedule_adjustment_applied',
          routing: { channel: 'fitness.actions', target: 'training-load', priority: 'high', maxDeliveryLatencySeconds: 300 },
          capability_id: 'lifeline-remediation-v1',
          created_at: '2026-03-30T00:00:00.000Z',
          updated_at: '2026-03-30T00:00:00.000Z',
          request_state: 'running',
          idempotency_key: 'x',
          rendezvous_manifest_path: '.playbook/rendezvous-manifest.json',
          rendezvous_manifest_sha256: 'y',
          bounded_inputs: ['artifact:fitness-contract'],
          bounded_action_input: { athlete_id: 'athlete-001', week_id: 'week-2026-W13', workout_id: 'workout-001', load_adjustment_percent: -10, duration_days: 3, reason_code: 'fatigue_spike' },
          blocked_reason: null,
          retry: { attempts: 1, max_attempts: 3, reconcile_token: 'token', last_attempt_at: '2026-03-30T00:00:00.000Z', next_retry_at: null }
        }
      ],
      statuses: [],
      receipts: [
        {
          receipt_id: 'receipt-interop-0001',
          request_id: 'interop-0001',
          runtime_id: 'lifeline-mock-runtime',
          action_kind: 'schedule_recovery_block',
          receipt_type: 'recovery_guardrail_applied',
          routing: { channel: 'fitness.actions', target: 'training-load', priority: 'high', maxDeliveryLatencySeconds: 300 },
          received_at: '2026-03-30T00:00:00.000Z',
          completed_at: '2026-03-30T00:01:00.000Z',
          outcome: 'completed',
          output_artifact_path: '.playbook/rendezvous-manifest.json',
          output_sha256: 'abc',
          detail: 'drifted receipt'
        }
      ],
      heartbeat: null
    });

    const exitCode = await runInterop(repo, ['reconcile'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
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

  it('emits Fitness request from canonical interop-request-draft artifact via --from-draft', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/rendezvous-manifest.json', {
      remediationId: 'remediation-interop-fit-draft-1',
      requiredArtifactIds: ['fitness-contract']
    });
    writeArtifact(repo, '.playbook/rendezvous-status.json', {
      evaluation: { state: 'complete', releaseReady: true, blockers: [], missingArtifactIds: [], conflictingArtifactIds: [], stale: false }
    });
    writeArtifact(repo, '.playbook/interop-request-draft.json', {
      schemaVersion: '1.0',
      kind: 'interop-request-draft',
      command: 'interop draft',
      draftId: 'interop-draft-abc123',
      proposalId: 'ai-proposal-abc123',
      target: 'fitness',
      capability: 'lifeline-remediation-v1',
      action: 'schedule_recovery_block',
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        start_date: '2026-03-30',
        duration_days: 3,
        recovery_mode: 'rest'
      },
      expected_receipt_type: 'recovery_guardrail_applied',
      routing_metadata: {
        channel: 'fitness.actions',
        target: 'recovery',
        priority: 'high',
        maxDeliveryLatencySeconds: 300,
        constraints: ['same_week_only', 'max_duration_days_14']
      },
      blockers: [],
      assumptions: ['canonical'],
      confidence: 0.84,
      provenance_refs: ['.playbook/ai-proposal.json', 'playbook-engine:fitnessIntegrationContract'],
      nextActionText: 'Run emit-fitness-plan --from-draft after review.'
    });

    expect(await runInterop(repo, ['register', '--capability', 'lifeline-remediation-v1', '--action', 'schedule_recovery_block'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runInterop(repo, ['emit-fitness-plan', '--from-draft', '.playbook/interop-request-draft.json'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const runtime = JSON.parse(fs.readFileSync(path.join(repo, '.playbook/lifeline-interop-runtime.json'), 'utf8')) as {
      requests: Array<{
        action_kind: string;
        capability_id: string;
        receipt_type: string;
        routing: { channel: string; target: string; priority: string; maxDeliveryLatencySeconds: number };
        bounded_action_input: { recovery_mode: string };
      }>;
    };
    expect(runtime.requests[0]).toMatchObject({
      action_kind: 'schedule_recovery_block',
      capability_id: 'lifeline-remediation-v1',
      receipt_type: 'recovery_guardrail_applied',
      routing: {
        channel: 'fitness.actions',
        target: 'recovery',
        priority: 'high',
        maxDeliveryLatencySeconds: 300
      },
      bounded_action_input: {
        recovery_mode: 'rest'
      }
    });
  });

  it('rejects --from-draft when path is not the canonical interop-request-draft artifact', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/rendezvous-manifest.json', {
      remediationId: 'remediation-interop-fit-draft-2',
      requiredArtifactIds: ['fitness-contract']
    });
    writeArtifact(repo, '.playbook/rendezvous-status.json', {
      evaluation: { state: 'complete', releaseReady: true, blockers: [], missingArtifactIds: [], conflictingArtifactIds: [], stale: false }
    });
    expect(await runInterop(repo, ['register', '--capability', 'lifeline-remediation-v1', '--action', 'schedule_recovery_block'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const exitCode = await runInterop(repo, ['emit-fitness-plan', '--from-draft', '.playbook/non-canonical-draft.json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
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

  it('compiles fitness-targeted ai proposal into deterministic interop request draft', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/ai-proposal.json', {
      schemaVersion: '1.0',
      command: 'ai-propose',
      proposalId: 'ai-proposal-abc123',
      scope: {
        mode: 'proposal-only',
        boundaries: ['no-direct-apply', 'no-memory-promotion', 'no-pattern-promotion', 'no-external-interop-emit', 'artifact-only-output'],
        allowedInputs: ['.playbook/ai-context.json', '.playbook/ai-contract.json', '.playbook/repo-index.json', 'playbook-engine:fitnessIntegrationContract'],
        optionalInputs: [],
        target: 'fitness'
      },
      reasoningSummary: ['fitness suggestion'],
      recommendedNextGovernedSurface: 'interop emit-fitness-plan',
      suggestedArtifactPath: '.playbook/ai-proposal.json',
      blockers: [],
      assumptions: ['advisory only'],
      confidence: 0.82,
      provenance: [
        { artifactPath: '.playbook/repo-index.json', source: 'file', required: true, available: true, used: true }
      ],
      fitnessRequestSuggestion: {
        canonicalActionName: 'adjust_upcoming_workout_load',
        boundedActionInput: {
          athlete_id: 'athlete-001',
          week_id: 'week-2026-W13',
          workout_id: 'workout-001',
          load_adjustment_percent: -10,
          duration_days: 3,
          reason_code: 'fatigue_spike'
        },
        canonicalExpectedReceiptType: 'schedule_adjustment_applied',
        routingMetadataSummary: {
          channel: 'fitness.actions',
          target: 'training-load',
          priority: 'high',
          maxDeliveryLatencySeconds: 300,
          constraints: ['same_week_only', 'max_duration_days_14']
        },
        recommendedNextGovernedSurface: 'interop emit-fitness-plan',
        blockers: [],
        assumptions: ['canonical'],
        confidence: 0.84
      }
    });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runInterop(repo, ['draft'], { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as {
      command: string;
      subcommand: string;
      payload: { artifactPath: string; draft: { kind: string; action: string; expected_receipt_type: string } };
    };

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.command).toBe('interop');
    expect(payload.subcommand).toBe('draft');
    expect(payload.payload.artifactPath).toBe('.playbook/interop-request-draft.json');
    expect(payload.payload.draft).toMatchObject({
      kind: 'interop-request-draft',
      action: 'adjust_upcoming_workout_load',
      expected_receipt_type: 'schedule_adjustment_applied'
    });
  });

  it('rejects draft compilation for invalid non-canonical action suggestion', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/ai-proposal.json', {
      schemaVersion: '1.0',
      command: 'ai-propose',
      proposalId: 'ai-proposal-bad',
      scope: {
        mode: 'proposal-only',
        boundaries: ['no-direct-apply', 'no-memory-promotion', 'no-pattern-promotion', 'no-external-interop-emit', 'artifact-only-output'],
        allowedInputs: ['.playbook/ai-context.json', '.playbook/ai-contract.json', '.playbook/repo-index.json', 'playbook-engine:fitnessIntegrationContract'],
        optionalInputs: [],
        target: 'fitness'
      },
      reasoningSummary: ['fitness suggestion'],
      recommendedNextGovernedSurface: 'interop emit-fitness-plan',
      suggestedArtifactPath: '.playbook/ai-proposal.json',
      blockers: [],
      assumptions: ['advisory only'],
      confidence: 0.82,
      provenance: [],
      fitnessRequestSuggestion: {
        canonicalActionName: 'non_canonical_action',
        boundedActionInput: {},
        canonicalExpectedReceiptType: 'schedule_adjustment_applied',
        routingMetadataSummary: {
          channel: 'fitness.actions',
          target: 'training-load',
          priority: 'high',
          maxDeliveryLatencySeconds: 300,
          constraints: ['same_week_only', 'max_duration_days_14']
        },
        recommendedNextGovernedSurface: 'interop emit-fitness-plan',
        blockers: [],
        assumptions: [],
        confidence: 0.84
      }
    });

    const exitCode = await runInterop(repo, ['draft'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
  });
});
