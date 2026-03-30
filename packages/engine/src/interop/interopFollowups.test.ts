import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileInteropFollowups } from './interopFollowups.js';
import { reconcileInteropRuntime, type InteropUpdatedTruthArtifact } from './playbookLifelineInterop.js';

const createRepo = (name: string): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  return repo;
};

const writeUpdatedTruth = (repo: string, updates: InteropUpdatedTruthArtifact['updates']): void => {
  const artifact: InteropUpdatedTruthArtifact = {
    schemaVersion: '1.0',
    kind: 'interop-updated-truth-artifact',
    contract: {
      sourceHash: 'fitness-contract-hash',
      sourceRef: 'main',
      sourcePath: 'fawxzzy-fitness/src/lib/ecosystem/fitness-integration-contract.ts'
    },
    updates
  };
  fs.writeFileSync(path.join(repo, '.playbook', 'interop-updated-truth.json'), `${JSON.stringify(artifact, null, 2)}\n`);
};

describe('compileInteropFollowups', () => {
  it('compiles deterministic proposal-only followups from canonical updated truth', () => {
    const repo = createRepo('playbook-engine-interop-followups');
    writeUpdatedTruth(repo, [
      {
        receiptId: 'receipt-interop-0001',
        requestId: 'interop-0001',
        action: 'adjust_upcoming_workout_load',
        receiptType: 'schedule_adjustment_applied',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: {
          outcome: 'completed',
          detail: 'Applied safely.',
          completedAt: '2026-03-30T00:00:00.000Z'
        },
        boundedStateDelta: {
          requestState: 'completed',
          outputArtifactPath: '.playbook/rendezvous-manifest.json',
          outputSha256: 'abc'
        },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json', 'request:interop-0001'],
        nextActionHints: ['Run interop health.']
      },
      {
        receiptId: 'receipt-interop-0002',
        requestId: 'interop-0002',
        action: 'revise_weekly_goal_plan',
        receiptType: 'goal_plan_amended',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: {
          outcome: 'completed',
          detail: 'Goal plan amended.',
          completedAt: '2026-03-30T00:00:00.000Z'
        },
        boundedStateDelta: {
          requestState: 'completed',
          outputArtifactPath: '.playbook/rendezvous-manifest.json',
          outputSha256: 'def'
        },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json', 'request:interop-0002'],
        nextActionHints: ['Continue with bounded next remediation action only through explicit request emission.']
      }
    ]);

    const first = compileInteropFollowups(repo);
    const firstText = fs.readFileSync(path.join(repo, first.artifactPath), 'utf8');
    const second = compileInteropFollowups(repo);
    const secondText = fs.readFileSync(path.join(repo, second.artifactPath), 'utf8');

    expect(first.artifactPath).toBe('.playbook/interop-followups.json');
    expect(first.followups.kind).toBe('interop-followups-artifact');
    expect(first.followups.reviewOnly).toBe(true);
    expect(first.followups.authority.mutation).toBe('read-only');
    expect(first.followups.followups.some((entry) => entry.followupType === 'docs-story-followup')).toBe(true);
    expect(first.followups.followups.every((entry) => entry.provenanceRefs.length > 0)).toBe(true);
    expect(firstText).toBe(secondText);
  });

  it('rejects non-canonical updated truth path overrides', () => {
    const repo = createRepo('playbook-engine-interop-followups-paths');
    writeUpdatedTruth(repo, []);

    expect(() => compileInteropFollowups(repo, { updatedTruthPath: '.playbook/not-canonical.json' })).toThrow(/only canonical/);
    expect(() => compileInteropFollowups(repo, { artifactPath: '.playbook/not-canonical-followups.json' })).toThrow(/only canonical/);
  });
});

describe('reconcileInteropRuntime', () => {
  it('fails closed when receipt metadata drifts from canonical request contract', async () => {
    const repo = createRepo('playbook-engine-interop-reconcile-mismatch');
    const runtime = {
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
          capability_id: 'cap-1',
          created_at: '2026-03-30T00:00:00.000Z',
          updated_at: '2026-03-30T00:00:00.000Z',
          request_state: 'pending',
          idempotency_key: 'idempotency',
          rendezvous_manifest_path: '.playbook/rendezvous-manifest.json',
          rendezvous_manifest_sha256: 'abc',
          bounded_inputs: [],
          bounded_action_input: {
            athlete_id: 'athlete-1',
            week_id: 'week-1',
            workout_id: 'workout-1',
            load_adjustment_percent: 5,
            duration_days: 3,
            reason_code: 'fatigue_spike'
          },
          blocked_reason: null,
          retry: {
            attempts: 0,
            max_attempts: 3,
            reconcile_token: 'token',
            last_attempt_at: null,
            next_retry_at: null
          }
        }
      ],
      statuses: [],
      receipts: [
        {
          receipt_id: 'receipt-interop-0001',
          request_id: 'interop-0001',
          runtime_id: 'runtime-1',
          action_kind: 'adjust_upcoming_workout_load',
          receipt_type: 'goal_plan_amended',
          routing: { channel: 'fitness.actions', target: 'training-load', priority: 'high', maxDeliveryLatencySeconds: 300 },
          received_at: '2026-03-30T00:00:00.000Z',
          completed_at: '2026-03-30T00:00:01.000Z',
          outcome: 'completed',
          output_artifact_path: '.playbook/rendezvous-manifest.json',
          output_sha256: 'abc',
          detail: 'Drifted receipt type'
        }
      ],
      heartbeat: null
    } as const;

    await expect(reconcileInteropRuntime(repo, runtime as any)).rejects.toThrow(/receipt mismatch/);
  });
});
