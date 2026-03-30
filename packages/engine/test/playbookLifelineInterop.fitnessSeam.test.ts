import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createEmptyInteropRuntime,
  emitBoundedInteropActionRequest,
  emitPlanDerivedFitnessRequest,
  reconcileInteropRuntime,
  registerInteropCapability,
  runLifelineMockRuntimeOnce
} from '../src/interop/playbookLifelineInterop.js';
import { getFitnessActionContract, getFitnessReceiptTypeForAction } from '../src/integrations/fitnessContract.js';

const createRepoWithFitnessConfig = (): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-engine-interop-'));
  fs.writeFileSync(
    path.join(repo, 'playbook.fitness.config.json'),
    `${JSON.stringify({
      fitnessContractSource: {
        sourceRepo: 'ZachariahRedfield/fawxzzy-fitness',
        sourceRef: 'main',
        sourcePath: 'src/lib/ecosystem/fitness-integration-contract.ts',
        syncMode: 'mirrored'
      }
    }, null, 2)}\n`,
    'utf8'
  );
  return repo;
};

describe('playbook lifeline interop fitness seam', () => {
  it('emits request and receipt using canonical fitness action, receipt type, and routing metadata', () => {
    const action_kind = 'schedule_recovery_block' as const;
    const action = getFitnessActionContract(action_kind);
    const runtime = registerInteropCapability(createEmptyInteropRuntime(), {
      capability_id: 'lifeline-fitness-v1',
      action_kind,
      receipt_type: getFitnessReceiptTypeForAction(action_kind),
      routing: action.routing,
      version: '1.0.0',
      runtime_id: 'lifeline-mock-runtime',
      idempotency_key_prefix: `lifeline:${action_kind}`
    });

    const emitted = emitBoundedInteropActionRequest({
      runtime,
      action_kind,
      capability_id: 'lifeline-fitness-v1',
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        start_date: '2026-03-30',
        duration_days: 3,
        recovery_mode: 'rest'
      },
      manifest: { remediationId: 'remediation-fit-001', requiredArtifactIds: ['fitness-contract'] },
      evaluation: {
        state: 'complete',
        releaseReady: true,
        blockers: [],
        missingArtifactIds: [],
        conflictingArtifactIds: [],
        stale: false
      }
    });

    expect(emitted.request).toMatchObject({
      action_kind,
      receipt_type: 'recovery_guardrail_applied',
      routing: action.routing,
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        start_date: '2026-03-30',
        duration_days: 3,
        recovery_mode: 'rest'
      }
    });

    const afterRuntime = runLifelineMockRuntimeOnce(emitted.runtime, 'lifeline-mock-runtime');
    expect(afterRuntime.receipts[0]).toMatchObject({
      action_kind,
      receipt_type: 'recovery_guardrail_applied',
      routing: action.routing
    });
  });

  it('rejects mismatched action->receipt pairings during reconciliation', async () => {
    const repo = createRepoWithFitnessConfig();
    const action_kind = 'adjust_upcoming_workout_load' as const;
    const action = getFitnessActionContract(action_kind);
    const runtime = registerInteropCapability(createEmptyInteropRuntime(), {
      capability_id: 'lifeline-fitness-v1',
      action_kind,
      receipt_type: getFitnessReceiptTypeForAction(action_kind),
      routing: action.routing,
      version: '1.0.0',
      runtime_id: 'lifeline-mock-runtime',
      idempotency_key_prefix: `lifeline:${action_kind}`
    });

    const emitted = emitBoundedInteropActionRequest({
      runtime,
      action_kind,
      capability_id: 'lifeline-fitness-v1',
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        workout_id: 'workout-001',
        load_adjustment_percent: -15,
        duration_days: 3,
        reason_code: 'fatigue_spike'
      },
      manifest: { remediationId: 'remediation-fit-002', requiredArtifactIds: ['fitness-contract'] },
      evaluation: {
        state: 'complete',
        releaseReady: true,
        blockers: [],
        missingArtifactIds: [],
        conflictingArtifactIds: [],
        stale: false
      }
    });

    const mismatched = {
      ...emitted.runtime,
      receipts: [
        {
          receipt_id: 'receipt-interop-0001',
          request_id: emitted.request.request_id,
          runtime_id: 'lifeline-mock-runtime',
          action_kind,
          receipt_type: 'goal_plan_amended' as const,
          routing: action.routing,
          received_at: emitted.request.created_at,
          completed_at: emitted.request.created_at,
          outcome: 'completed' as const,
          output_artifact_path: '.playbook/rendezvous-manifest.json',
          output_sha256: emitted.request.rendezvous_manifest_sha256,
          detail: 'invalid receipt pairing'
        }
      ]
    };

    await expect(reconcileInteropRuntime(repo, mismatched)).rejects.toThrow(/receipt mismatch/);
  });

  it('rejects registration when canonical routing metadata drifts', () => {
    const action_kind = 'schedule_recovery_block' as const;
    const action = getFitnessActionContract(action_kind);

    expect(() => registerInteropCapability(createEmptyInteropRuntime(), {
      capability_id: 'lifeline-fitness-v1',
      action_kind,
      receipt_type: getFitnessReceiptTypeForAction(action_kind),
      routing: {
        ...action.routing,
        target: 'topic-style-target'
      },
      version: '1.0.0',
      runtime_id: 'lifeline-mock-runtime',
      idempotency_key_prefix: `lifeline:${action_kind}`
    })).toThrow(/routing mismatch/);
  });

  it('keeps routing metadata canonical and separate from Fitness constraints', () => {
    const action_kind = 'adjust_upcoming_workout_load' as const;
    const action = getFitnessActionContract(action_kind);
    const runtime = registerInteropCapability(createEmptyInteropRuntime(), {
      capability_id: 'lifeline-fitness-v1',
      action_kind,
      receipt_type: getFitnessReceiptTypeForAction(action_kind),
      routing: action.routing,
      version: '1.0.0',
      runtime_id: 'lifeline-mock-runtime',
      idempotency_key_prefix: `lifeline:${action_kind}`
    });

    const { request } = emitBoundedInteropActionRequest({
      runtime,
      action_kind,
      capability_id: 'lifeline-fitness-v1',
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        workout_id: 'workout-001',
        load_adjustment_percent: -15,
        duration_days: 3,
        reason_code: 'fatigue_spike'
      },
      manifest: { remediationId: 'remediation-fit-003', requiredArtifactIds: ['fitness-contract'] },
      evaluation: {
        state: 'complete',
        releaseReady: true,
        blockers: [],
        missingArtifactIds: [],
        conflictingArtifactIds: [],
        stale: false
      }
    });

    expect(Object.keys(request.routing).sort()).toEqual([
      'channel',
      'maxDeliveryLatencySeconds',
      'priority',
      'target'
    ]);
    expect(request.routing).toEqual(action.routing);
    expect(action.constraints).toEqual(['same_week_only', 'max_duration_days_14']);
    expect((request.routing as Record<string, unknown>).constraints).toBeUndefined();
  });

  it('emits a Fitness request from release-ready rendezvous via plan-derived helper', () => {
    const action_kind = 'adjust_upcoming_workout_load' as const;
    const action = getFitnessActionContract(action_kind);
    const runtime = registerInteropCapability(createEmptyInteropRuntime(), {
      capability_id: 'lifeline-fitness-v1',
      action_kind,
      receipt_type: getFitnessReceiptTypeForAction(action_kind),
      routing: action.routing,
      version: '1.0.0',
      runtime_id: 'lifeline-mock-runtime',
      idempotency_key_prefix: `lifeline:${action_kind}`
    });

    const emitted = emitPlanDerivedFitnessRequest({
      runtime,
      readiness: {
        source: 'rendezvous',
        manifest: { remediationId: 'remediation-fit-004', requiredArtifactIds: ['fitness-contract'] },
        evaluation: { state: 'complete', releaseReady: true, blockers: [], missingArtifactIds: [], conflictingArtifactIds: [], stale: false }
      },
      action_kind,
      capability_id: 'lifeline-fitness-v1',
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        workout_id: 'workout-001',
        load_adjustment_percent: -10,
        duration_days: 3,
        reason_code: 'fatigue_spike'
      }
    });

    expect(emitted.request.action_kind).toBe('adjust_upcoming_workout_load');
    expect(emitted.request.receipt_type).toBe('schedule_adjustment_applied');
    expect(emitted.request.routing).toEqual(action.routing);
  });

  it('emits a Fitness request from explicit approved plan state and blocks non-approved plan state', () => {
    const action_kind = 'schedule_recovery_block' as const;
    const action = getFitnessActionContract(action_kind);
    const runtime = registerInteropCapability(createEmptyInteropRuntime(), {
      capability_id: 'lifeline-fitness-v1',
      action_kind,
      receipt_type: getFitnessReceiptTypeForAction(action_kind),
      routing: action.routing,
      version: '1.0.0',
      runtime_id: 'lifeline-mock-runtime',
      idempotency_key_prefix: `lifeline:${action_kind}`
    });

    expect(() => emitPlanDerivedFitnessRequest({
      runtime,
      readiness: {
        source: 'approved-plan',
        plan: { command: 'plan' },
        approved: false,
        remediation_id: 'plan-remediation-1',
        required_artifact_ids: ['apply-result']
      },
      action_kind,
      capability_id: 'lifeline-fitness-v1',
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        start_date: '2026-03-30',
        duration_days: 3,
        recovery_mode: 'rest'
      }
    })).toThrow(/approved plan state is required/);

    const emitted = emitPlanDerivedFitnessRequest({
      runtime,
      readiness: {
        source: 'approved-plan',
        plan: { command: 'plan' },
        approved: true,
        remediation_id: 'plan-remediation-2',
        required_artifact_ids: ['apply-result']
      },
      action_kind,
      capability_id: 'lifeline-fitness-v1',
      bounded_action_input: {
        athlete_id: 'athlete-001',
        week_id: 'week-2026-W13',
        start_date: '2026-03-30',
        duration_days: 3,
        recovery_mode: 'rest'
      }
    });
    expect(emitted.request.action_kind).toBe('schedule_recovery_block');
    expect(emitted.request.receipt_type).toBe('recovery_guardrail_applied');
  });
});
