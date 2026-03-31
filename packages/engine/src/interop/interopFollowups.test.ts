import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileInteropFollowups, materializeInteropMemoryCandidates } from './interopFollowups.js';
import { reconcileInteropRuntime, type InteropUpdatedTruthArtifact } from './playbookLifelineInterop.js';

const createRepo = (name: string): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  return repo;
};


const writeFitnessConfig = (repo: string): void => {
  fs.writeFileSync(
    path.join(repo, 'playbook.fitness.config.json'),
    `${JSON.stringify({
      fitnessContractSource: {
        sourceRepo: 'ZachariahRedfield/fawxzzy-fitness',
        sourceRef: 'main',
        sourcePath: 'src/lib/ecosystem/fitness-integration-contract.ts',
        syncMode: 'mirrored'
      }
    }, null, 2)}
`,
    'utf8'
  );
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
      },
      {
        receiptId: 'receipt-interop-0003',
        requestId: 'interop-0003',
        action: 'adjust_upcoming_workout_load',
        receiptType: 'schedule_adjustment_applied',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: {
          outcome: 'blocked',
          detail: 'Blocked by policy guard.',
          completedAt: '2026-03-30T00:00:00.000Z'
        },
        boundedStateDelta: {
          requestState: 'blocked',
          outputArtifactPath: null,
          outputSha256: null
        },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json', 'request:interop-0003'],
        nextActionHints: ['Review policy assumptions before retrying.']
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
    expect(
      first.followups.followups.find((entry) => entry.followupId === 'followup-receipt-interop-0002-review')?.reviewQueueEntry
    ).toEqual(
      expect.objectContaining({
        targetKind: 'doc',
        path: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
        triggerReasonCode: 'interop-domain-state-change'
      })
    );
    expect(
      first.followups.followups.find((entry) => entry.followupId === 'followup-receipt-interop-0003-review')?.reviewQueueEntry
    ).toEqual(
      expect.objectContaining({
        targetKind: 'knowledge',
        targetId: 'interop-request:interop-0003',
        triggerReasonCode: 'interop-runtime-outcome-repeat',
        recommendedAction: 'revise'
      })
    );
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
    writeFitnessConfig(repo);
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

describe('materializeInteropMemoryCandidates', () => {
  it('deterministically materializes only eligible interop followups into memory candidates', () => {
    const repo = createRepo('playbook-engine-interop-memory-candidates');
    writeUpdatedTruth(repo, [
      {
        receiptId: 'receipt-interop-1001',
        requestId: 'interop-1001',
        action: 'adjust_upcoming_workout_load',
        receiptType: 'schedule_adjustment_applied',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: { outcome: 'blocked', detail: 'Policy gate blocked update.', completedAt: '2026-03-30T00:00:00.000Z' },
        boundedStateDelta: { requestState: 'blocked', outputArtifactPath: null, outputSha256: null },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json', 'request:interop-1001'],
        nextActionHints: ['Review guardrails before retrying.']
      },
      {
        receiptId: 'receipt-interop-1002',
        requestId: 'interop-1002',
        action: 'adjust_upcoming_workout_load',
        receiptType: 'schedule_adjustment_applied',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: { outcome: 'blocked', detail: 'Policy gate blocked update again.', completedAt: '2026-03-30T01:00:00.000Z' },
        boundedStateDelta: { requestState: 'blocked', outputArtifactPath: null, outputSha256: null },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json', 'request:interop-1002'],
        nextActionHints: ['Assumption review required.']
      },
      {
        receiptId: 'receipt-interop-1003',
        requestId: 'interop-1003',
        action: 'revise_weekly_goal_plan',
        receiptType: 'goal_plan_amended',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: { outcome: 'completed', detail: 'Goal plan revised to reflect readiness.', completedAt: '2026-03-30T02:00:00.000Z' },
        boundedStateDelta: { requestState: 'completed', outputArtifactPath: '.playbook/rendezvous-manifest.json', outputSha256: 'abc' },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json', 'request:interop-1003'],
        nextActionHints: ['Use revised plan for next bounded action.']
      },
      {
        receiptId: 'receipt-interop-1004',
        requestId: 'interop-1004',
        action: 'adjust_upcoming_workout_load',
        receiptType: 'schedule_adjustment_applied',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: { outcome: 'failed', detail: 'Single failure should not create noise.', completedAt: '2026-03-30T03:00:00.000Z' },
        boundedStateDelta: { requestState: 'failed', outputArtifactPath: null, outputSha256: null },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json', 'request:interop-1004'],
        nextActionHints: ['Wait for more evidence.']
      }
    ]);

    compileInteropFollowups(repo);
    const first = materializeInteropMemoryCandidates(repo);
    const firstText = fs.readFileSync(path.join(repo, '.playbook', 'memory', 'candidates.json'), 'utf8');
    const second = materializeInteropMemoryCandidates(repo);
    const secondText = fs.readFileSync(path.join(repo, '.playbook', 'memory', 'candidates.json'), 'utf8');
    const parsed = JSON.parse(firstText) as {
      authority: { mutation: string; promotion: string };
      candidates: Array<{ candidateId: string }>;
      interopDerivedCandidates: Array<{ eligibilityReason: string; source: { receiptId: string } }>;
    };

    expect(first.memoryCandidatesPath).toBe('.playbook/memory/candidates.json');
    expect(second.memoryCandidatesPath).toBe('.playbook/memory/candidates.json');
    expect(firstText).toBe(secondText);
    expect(parsed.authority).toEqual({ mutation: 'read-only', promotion: 'review-required' });
    expect(first.derivedCandidates).toHaveLength(3);
    expect(first.derivedCandidates.every((entry) => entry.action === 'queue-memory-candidate')).toBe(true);
    expect(parsed.interopDerivedCandidates.some((entry) => entry.eligibilityReason === 'repeated-blocked-runtime-outcome')).toBe(true);
    expect(parsed.interopDerivedCandidates.some((entry) => entry.eligibilityReason === 'meaningful-domain-state-change')).toBe(true);
    expect(parsed.interopDerivedCandidates.some((entry) => entry.source.receiptId === 'receipt-interop-1004')).toBe(false);
    expect(parsed.candidates.filter((entry) => entry.candidateId.startsWith('interop-')).length).toBe(3);
  });
});
