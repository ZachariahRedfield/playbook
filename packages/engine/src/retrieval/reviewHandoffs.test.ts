import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReviewHandoffsArtifact } from './reviewHandoffs.js';

const touchedDirs: string[] = [];

const createTempRepo = (): string => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-review-handoffs-'));
  touchedDirs.push(repoRoot);
  return repoRoot;
};

const writeJson = (repoRoot: string, relativePath: string, payload: unknown): void => {
  const filePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

afterEach(() => {
  while (touchedDirs.length > 0) {
    const directory = touchedDirs.pop();
    if (directory && fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('buildReviewHandoffsArtifact', () => {
  it('emits deterministic handoff row for revise receipts', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-queue.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          queueEntryId: 'queue-revise-1',
          targetKind: 'knowledge',
          targetId: 'k-revise',
          cadenceKind: 'knowledge',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          evidenceRefs: ['candidate:c-revise'],
          triggerType: 'cadence',
          triggerSource: 'memory-knowledge-cadence',
          triggerReasonCode: 'cadence-window-due',
          triggerEvidenceRefs: ['candidate:c-revise'],
          triggerStrength: 75,
          recommendedAction: 'revise',
          reviewPriority: 'medium',
          generatedAt: '2026-03-24T00:00:00.000Z'
        }
      ]
    });

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'receipt-revise-1',
          queueEntryId: 'queue-revise-1',
          targetKind: 'knowledge',
          targetId: 'k-revise',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          decision: 'revise',
          evidenceRefs: ['candidate:c-revise', 'event:e-1'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const artifact = buildReviewHandoffsArtifact(repoRoot, '2026-03-24T02:00:00.000Z');
    expect(artifact.handoffs).toHaveLength(1);
    expect(artifact.handoffs[0]).toMatchObject({
      queueEntryId: 'queue-revise-1',
      receiptId: 'receipt-revise-1',
      targetKind: 'knowledge',
      targetId: 'k-revise',
      decision: 'revise',
      recommendedFollowupType: 'revise-target',
      recommendedFollowupRef: 'knowledge:k-revise'
    });
  });

  it('emits deterministic handoff row for supersede receipts', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-queue.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          queueEntryId: 'queue-supersede-1',
          targetKind: 'knowledge',
          targetId: 'k-old',
          cadenceKind: 'knowledge',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'superseded-knowledge-lineage-check',
          evidenceRefs: ['knowledge:k-new'],
          triggerType: 'evidence',
          triggerSource: 'memory-knowledge',
          triggerReasonCode: 'knowledge-supersession-state',
          triggerEvidenceRefs: ['knowledge:k-new'],
          triggerStrength: 90,
          recommendedAction: 'supersede',
          reviewPriority: 'high',
          generatedAt: '2026-03-24T00:00:00.000Z'
        }
      ]
    });

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'receipt-supersede-1',
          queueEntryId: 'queue-supersede-1',
          targetKind: 'knowledge',
          targetId: 'k-old',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'superseded-knowledge-lineage-check',
          decision: 'supersede',
          evidenceRefs: ['knowledge:k-new'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const artifact = buildReviewHandoffsArtifact(repoRoot, '2026-03-24T02:00:00.000Z');
    expect(artifact.handoffs).toHaveLength(1);
    expect(artifact.handoffs[0]).toMatchObject({
      queueEntryId: 'queue-supersede-1',
      receiptId: 'receipt-supersede-1',
      decision: 'supersede',
      recommendedFollowupType: 'supersede-target',
      recommendedFollowupRef: 'knowledge:k-old'
    });
  });

  it('does not emit actionable handoff for reaffirm receipts', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-queue.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          queueEntryId: 'queue-reaffirm-1',
          targetKind: 'doc',
          path: 'docs/postmortems/example.md',
          cadenceKind: 'doc',
          sourceSurface: 'governed-docs',
          reasonCode: 'governed-doc-staleness-window',
          evidenceRefs: ['docs/postmortems/example.md'],
          triggerType: 'cadence',
          triggerSource: 'governed-docs',
          triggerReasonCode: 'cadence-window-due',
          triggerEvidenceRefs: ['docs/postmortems/example.md'],
          triggerStrength: 35,
          recommendedAction: 'reaffirm',
          reviewPriority: 'low',
          generatedAt: '2026-03-24T00:00:00.000Z'
        }
      ]
    });

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'receipt-reaffirm-1',
          queueEntryId: 'queue-reaffirm-1',
          targetKind: 'doc',
          path: 'docs/postmortems/example.md',
          sourceSurface: 'governed-docs',
          reasonCode: 'governed-doc-staleness-window',
          decision: 'reaffirm',
          evidenceRefs: ['docs/postmortems/example.md'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const artifact = buildReviewHandoffsArtifact(repoRoot, '2026-03-24T02:00:00.000Z');
    expect(artifact.handoffs).toEqual([]);
    expect(artifact.deferred).toEqual([]);
  });

  it('tracks defer metadata without immediate handoff rows', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-queue.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          queueEntryId: 'queue-defer-1',
          targetKind: 'knowledge',
          targetId: 'k-defer',
          cadenceKind: 'pattern',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          evidenceRefs: ['candidate:c-defer'],
          triggerType: 'cadence',
          triggerSource: 'memory-knowledge-cadence',
          triggerReasonCode: 'cadence-window-due',
          triggerEvidenceRefs: ['candidate:c-defer'],
          triggerStrength: 60,
          recommendedAction: 'reaffirm',
          reviewPriority: 'medium',
          generatedAt: '2026-03-24T00:00:00.000Z'
        }
      ]
    });

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'receipt-defer-1',
          queueEntryId: 'queue-defer-1',
          targetKind: 'knowledge',
          targetId: 'k-defer',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          decision: 'defer',
          evidenceRefs: ['candidate:c-defer'],
          deferUntil: '2026-03-31',
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const artifact = buildReviewHandoffsArtifact(repoRoot, '2026-03-24T02:00:00.000Z');
    expect(artifact.handoffs).toEqual([]);
    expect(artifact.deferred).toEqual([
      {
        queueEntryId: 'queue-defer-1',
        receiptId: 'receipt-defer-1',
        decision: 'defer',
        deferUntil: '2026-03-31T00:00:00.000Z',
        evidenceRefs: ['candidate:c-defer', 'review-receipt:receipt-defer-1']
      }
    ]);
  });

  it('is deterministic for same queue and receipts inputs', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-queue.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          queueEntryId: 'queue-revise-2',
          targetKind: 'doc',
          path: 'docs/postmortems/example-two.md',
          cadenceKind: 'doc',
          sourceSurface: 'governed-docs',
          reasonCode: 'governed-doc-staleness-window',
          evidenceRefs: ['docs/postmortems/example-two.md'],
          triggerType: 'cadence',
          triggerSource: 'governed-docs',
          triggerReasonCode: 'cadence-window-due',
          triggerEvidenceRefs: ['docs/postmortems/example-two.md'],
          triggerStrength: 45,
          recommendedAction: 'revise',
          reviewPriority: 'low',
          generatedAt: '2026-03-24T00:00:00.000Z'
        }
      ]
    });

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'receipt-revise-2',
          queueEntryId: 'queue-revise-2',
          targetKind: 'doc',
          path: 'docs/postmortems/example-two.md',
          sourceSurface: 'governed-docs',
          reasonCode: 'governed-doc-staleness-window',
          decision: 'revise',
          evidenceRefs: ['docs/postmortems/example-two.md'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const left = buildReviewHandoffsArtifact(repoRoot, '2026-03-24T02:00:00.000Z');
    const right = buildReviewHandoffsArtifact(repoRoot, '2026-03-24T02:00:00.000Z');

    expect(left).toEqual(right);
  });
});
