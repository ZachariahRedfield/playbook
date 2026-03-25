import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReviewHandoffRoutesArtifact } from './reviewHandoffRoutes.js';

const touchedDirs: string[] = [];

const createTempRepo = (): string => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-review-handoff-routes-'));
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

describe('buildReviewHandoffRoutesArtifact', () => {
  it('routes revise doc handoffs to deterministic docs follow-up', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-handoffs.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-handoffs',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T02:00:00.000Z',
      handoffs: [
        {
          handoffId: 'handoff-doc-1',
          queueEntryId: 'queue-doc-1',
          receiptId: 'receipt-doc-1',
          targetKind: 'doc',
          path: 'docs/postmortems/review-gap.md',
          decision: 'revise',
          recommendedFollowupType: 'revise-target',
          recommendedFollowupRef: 'path:docs/postmortems/review-gap.md',
          evidenceRefs: ['docs/postmortems/review-gap.md'],
          nextActionText: 'Follow up on docs update.'
        }
      ],
      deferred: []
    });

    writeJson(repoRoot, '.playbook/review-queue.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          queueEntryId: 'queue-doc-1',
          targetKind: 'doc',
          cadenceKind: 'doc',
          path: 'docs/postmortems/review-gap.md',
          sourceSurface: 'governed-docs',
          reasonCode: 'governed-doc-staleness-window',
          evidenceRefs: ['docs/postmortems/review-gap.md'],
          triggerType: 'cadence',
          triggerSource: 'governed-docs',
          triggerReasonCode: 'cadence-window-due',
          triggerEvidenceRefs: ['docs/postmortems/review-gap.md'],
          triggerStrength: 40,
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
          receiptId: 'receipt-doc-1',
          queueEntryId: 'queue-doc-1',
          targetKind: 'doc',
          path: 'docs/postmortems/review-gap.md',
          sourceSurface: 'governed-docs',
          reasonCode: 'governed-doc-staleness-window',
          decision: 'revise',
          evidenceRefs: ['docs/postmortems/review-gap.md'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const artifact = buildReviewHandoffRoutesArtifact(repoRoot, '2026-03-24T03:00:00.000Z');
    expect(artifact.routes).toHaveLength(1);
    expect(artifact.routes[0]).toMatchObject({
      handoffId: 'handoff-doc-1',
      targetKind: 'doc',
      path: 'docs/postmortems/review-gap.md',
      recommendedSurface: 'docs',
      reasonCode: 'docs-revision-follow-up'
    });
  });

  it('routes revise knowledge handoffs to deterministic memory/promote follow-up', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-handoffs.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-handoffs',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T02:00:00.000Z',
      handoffs: [
        {
          handoffId: 'handoff-knowledge-1',
          queueEntryId: 'queue-knowledge-1',
          receiptId: 'receipt-knowledge-1',
          targetKind: 'knowledge',
          targetId: 'k-123',
          decision: 'revise',
          recommendedFollowupType: 'revise-target',
          recommendedFollowupRef: 'knowledge:k-123',
          evidenceRefs: ['event:e-123'],
          nextActionText: 'Capture follow-up.'
        }
      ],
      deferred: []
    });

    writeJson(repoRoot, '.playbook/review-queue.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          queueEntryId: 'queue-knowledge-1',
          targetKind: 'knowledge',
          cadenceKind: 'knowledge',
          targetId: 'k-123',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          evidenceRefs: ['event:e-123'],
          triggerType: 'cadence',
          triggerSource: 'memory-knowledge-cadence',
          triggerReasonCode: 'cadence-window-due',
          triggerEvidenceRefs: ['event:e-123'],
          triggerStrength: 70,
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
          receiptId: 'receipt-knowledge-1',
          queueEntryId: 'queue-knowledge-1',
          targetKind: 'knowledge',
          targetId: 'k-123',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          decision: 'revise',
          evidenceRefs: ['event:e-123'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const artifact = buildReviewHandoffRoutesArtifact(repoRoot, '2026-03-24T03:00:00.000Z');
    expect(artifact.routes).toHaveLength(1);
    expect(artifact.routes[0]).toMatchObject({
      handoffId: 'handoff-knowledge-1',
      targetKind: 'knowledge',
      targetId: 'k-123',
      recommendedSurface: 'memory',
      reasonCode: 'memory-revision-follow-up'
    });
  });

  it('routes supersede handoffs to deterministic supersession follow-up', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-handoffs.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-handoffs',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T02:00:00.000Z',
      handoffs: [
        {
          handoffId: 'handoff-supersede-1',
          queueEntryId: 'queue-supersede-1',
          receiptId: 'receipt-supersede-1',
          targetKind: 'knowledge',
          targetId: 'k-old',
          decision: 'supersede',
          recommendedFollowupType: 'supersede-target',
          recommendedFollowupRef: 'knowledge:k-old',
          evidenceRefs: ['knowledge:k-new'],
          nextActionText: 'Supersede old target.'
        }
      ],
      deferred: []
    });

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
          cadenceKind: 'knowledge',
          targetId: 'k-old',
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

    const artifact = buildReviewHandoffRoutesArtifact(repoRoot, '2026-03-24T03:00:00.000Z');
    expect(artifact.routes).toHaveLength(1);
    expect(artifact.routes[0]).toMatchObject({
      handoffId: 'handoff-supersede-1',
      targetKind: 'knowledge',
      targetId: 'k-old',
      recommendedSurface: 'promote',
      reasonCode: 'supersession-follow-up'
    });
  });

  it('is deterministic for same handoffs and preserves read-only proposal authority', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-handoffs.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-handoffs',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T02:00:00.000Z',
      handoffs: [
        {
          handoffId: 'handoff-backlog-1',
          queueEntryId: 'queue-backlog-1',
          receiptId: 'receipt-backlog-1',
          targetKind: 'doc',
          path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
          decision: 'revise',
          recommendedFollowupType: 'revise-target',
          recommendedFollowupRef: 'path:docs/PLAYBOOK_DEV_WORKFLOW.md',
          evidenceRefs: ['backlog:follow-up-needed'],
          nextActionText: 'Follow up needed.'
        }
      ],
      deferred: []
    });

    writeJson(repoRoot, '.playbook/review-queue.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          queueEntryId: 'queue-backlog-1',
          targetKind: 'doc',
          cadenceKind: 'doc',
          path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
          sourceSurface: 'operational-gap-tracker',
          reasonCode: 'operational-gap-detected',
          evidenceRefs: ['backlog:follow-up-needed'],
          triggerType: 'evidence',
          triggerSource: 'operational-gap-tracker',
          triggerReasonCode: 'operational-gap-detected',
          triggerEvidenceRefs: ['backlog:follow-up-needed'],
          triggerStrength: 80,
          recommendedAction: 'revise',
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
          receiptId: 'receipt-backlog-1',
          queueEntryId: 'queue-backlog-1',
          targetKind: 'doc',
          path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
          sourceSurface: 'operational-gap-tracker',
          reasonCode: 'operational-gap-detected',
          decision: 'revise',
          evidenceRefs: ['backlog:follow-up-needed'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const left = buildReviewHandoffRoutesArtifact(repoRoot, '2026-03-24T03:00:00.000Z');
    const right = buildReviewHandoffRoutesArtifact(repoRoot, '2026-03-24T03:00:00.000Z');

    expect(left).toEqual(right);
    expect(left.proposalOnly).toBe(true);
    expect(left.authority).toBe('read-only');
    expect(left.routes[0]).toMatchObject({
      recommendedSurface: 'story',
      recommendedArtifact: '.playbook/stories.json',
      reasonCode: 'story-seed-operational-gap'
    });
  });
});
