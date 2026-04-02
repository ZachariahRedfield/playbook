import { describe, expect, it } from 'vitest';
import type { PlaybookLifelineInteropRuntimeArtifact } from '@zachariahredfield/playbook-core';
import { evaluateRuntimeCapabilityAuthorization } from './launchCapabilityAuthorization.js';
import type { WorkerLaunchPlanArtifact } from '../orchestration/workerLaunchPlan.js';

const launchPlanFixture = (requiredCapabilities: string[]): WorkerLaunchPlanArtifact => ({
  schemaVersion: '1.0',
  kind: 'worker-launch-plan',
  proposalOnly: true,
  generatedAt: '1970-01-01T00:00:00.000Z',
  sourceArtifacts: {
    worksetPlanPath: '.playbook/workset-plan.json',
    laneStatePath: '.playbook/lane-state.json',
    workerAssignmentsPath: '.playbook/worker-assignments.json',
    verifyPath: '.playbook/verify-report.json',
    policyEvaluationPath: '.playbook/policy-evaluation.json'
  },
  summary: {
    launchEligibleLanes: ['lane-1'],
    blockedLanes: [],
    failClosedReasons: []
  },
  lanes: [
    {
      lane_id: 'lane-1',
      worker_id: 'worker-lane-1',
      worker_type: 'general',
      launchEligible: true,
      blockers: [],
      requiredCapabilities,
      allowedWriteSurfaces: [],
      scopeBoundaries: {
        scope_id: null,
        allowed_write_surfaces: [],
        blocked_surfaces: [],
        patch_size_budget: null
      },
      protectedSingletonImpact: {
        hasProtectedSingletonWork: false,
        targets: [],
        consolidationStage: 'not_applicable',
        unresolved: false
      },
      requiredReceipts: [],
      releaseReadyPreconditions: []
    }
  ]
});

const runtimeFixture = (capabilities: PlaybookLifelineInteropRuntimeArtifact['capabilities']): PlaybookLifelineInteropRuntimeArtifact => ({
  schemaVersion: '1.0',
  kind: 'playbook-lifeline-interop-runtime',
  generatedAt: '1970-01-01T00:00:00.000Z',
  capabilities,
  requests: [],
  statuses: [],
  receipts: [],
  heartbeat: null
});

describe('evaluateRuntimeCapabilityAuthorization', () => {
  it('passes when capability and required action family are registered', () => {
    const plan = launchPlanFixture(['interop-capability:lifeline-remediation-v1', 'interop-action-family:recovery']);
    const runtime = runtimeFixture([
      {
        capability_id: 'lifeline-remediation-v1',
        action_kind: 'schedule_recovery_block',
        receipt_type: 'recovery_guardrail_applied',
        routing: { channel: 'fitness.actions', target: 'recovery', priority: 'high', maxDeliveryLatencySeconds: 300 },
        version: '1.0.0',
        registered_at: '1970-01-01T00:00:00.000Z',
        runtime_id: 'lifeline-mock-runtime',
        idempotency_key_prefix: 'lifeline'
      }
    ]);

    const evaluation = evaluateRuntimeCapabilityAuthorization(plan, runtime);
    expect(evaluation.ok).toBe(true);
    expect(evaluation.blockers).toEqual([]);
  });

  it('fails closed for stale/conflicted capability registrations', () => {
    const plan = launchPlanFixture(['interop-capability:lifeline-remediation-v1', 'interop-action-family:recovery']);
    const runtime = runtimeFixture([
      {
        capability_id: 'lifeline-remediation-v1',
        action_kind: 'schedule_recovery_block',
        receipt_type: 'recovery_guardrail_applied',
        routing: { channel: 'fitness.actions', target: 'weekly-plan', priority: 'high', maxDeliveryLatencySeconds: 300 },
        version: '1.0.0',
        registered_at: '1970-01-01T00:00:00.000Z',
        runtime_id: 'lifeline-mock-runtime',
        idempotency_key_prefix: 'lifeline'
      }
    ]);

    const evaluation = evaluateRuntimeCapabilityAuthorization(plan, runtime);
    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers.some((entry) => entry.blocker_code === 'runtime-capability-registration-stale-or-conflicted')).toBe(true);
  });

  it('is deterministic for the same launch plan and runtime state', () => {
    const plan = launchPlanFixture(['interop-capability:lifeline-remediation-v1', 'interop-action-family:recovery']);
    const runtime = runtimeFixture([
      {
        capability_id: 'lifeline-remediation-v1',
        action_kind: 'schedule_recovery_block',
        receipt_type: 'recovery_guardrail_applied',
        routing: { channel: 'fitness.actions', target: 'recovery', priority: 'high', maxDeliveryLatencySeconds: 300 },
        version: '1.0.0',
        registered_at: '1970-01-01T00:00:00.000Z',
        runtime_id: 'lifeline-mock-runtime',
        idempotency_key_prefix: 'lifeline'
      }
    ]);

    const first = evaluateRuntimeCapabilityAuthorization(plan, runtime);
    const second = evaluateRuntimeCapabilityAuthorization(plan, runtime);
    expect(first).toEqual(second);
  });
});
