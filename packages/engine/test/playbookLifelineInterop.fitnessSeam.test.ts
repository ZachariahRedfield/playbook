import { describe, expect, it } from 'vitest';
import {
  createEmptyInteropRuntime,
  emitBoundedInteropActionRequest,
  registerInteropCapability,
  runLifelineMockRuntimeOnce
} from '../src/interop/playbookLifelineInterop.js';
import { getFitnessActionContract, getFitnessReceiptTypeForAction } from '../src/integrations/fitnessContract.js';

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
      routing: action.routing
    });

    const afterRuntime = runLifelineMockRuntimeOnce(emitted.runtime, 'lifeline-mock-runtime');
    expect(afterRuntime.receipts[0]).toMatchObject({
      action_kind,
      receipt_type: 'recovery_guardrail_applied',
      routing: action.routing
    });
  });
});
