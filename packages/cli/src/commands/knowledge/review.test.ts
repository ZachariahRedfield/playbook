import { describe, expect, it, vi } from 'vitest';

const buildReviewQueue = vi.fn();
const writeReviewQueueArtifact = vi.fn();
const readFileSync = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  REVIEW_QUEUE_RELATIVE_PATH: '.playbook/review-queue.json',
  buildReviewQueue,
  writeReviewQueueArtifact
}));

vi.mock('node:fs', () => ({
  default: { readFileSync },
  readFileSync
}));

describe('runKnowledgeReview', () => {
  it('materializes queue artifact and applies deterministic filters', async () => {
    const { runKnowledgeReview } = await import('./review.js');

    const queueArtifact = {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: [
        {
          targetKind: 'knowledge',
          targetId: 'knowledge.one',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          evidenceRefs: ['.playbook/memory/knowledge/patterns.json'],
          recommendedAction: 'reaffirm',
          reviewPriority: 'high',
          generatedAt: '2026-03-24T00:00:00.000Z'
        },
        {
          targetKind: 'doc',
          path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
          sourceSurface: 'governed-docs',
          reasonCode: 'governed-doc-staleness-window',
          evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md'],
          recommendedAction: 'revise',
          reviewPriority: 'low',
          generatedAt: '2026-03-24T00:00:00.000Z'
        }
      ]
    };

    buildReviewQueue.mockReturnValue(queueArtifact);
    readFileSync.mockReturnValue(JSON.stringify(queueArtifact));

    const filtered = runKnowledgeReview('/repo', ['review', '--action', 'reaffirm', '--kind', 'knowledge']);
    expect(buildReviewQueue).toHaveBeenCalledWith('/repo');
    expect(writeReviewQueueArtifact).toHaveBeenCalledWith('/repo', queueArtifact);
    expect(filtered.queuePath).toBe('.playbook/review-queue.json');
    expect(filtered.entries).toHaveLength(1);
    expect(filtered.entries[0].targetKind).toBe('knowledge');

    const noPatternKind = runKnowledgeReview('/repo', ['review', '--kind', 'pattern']);
    expect(noPatternKind.entries).toHaveLength(1);
    expect(noPatternKind.entries[0].targetKind).toBe('knowledge');
  });

  it('rejects unsupported filter values', async () => {
    const { runKnowledgeReview } = await import('./review.js');
    buildReviewQueue.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T00:00:00.000Z',
      entries: []
    });
    readFileSync.mockReturnValue(
      JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-review-queue',
        proposalOnly: true,
        authority: 'read-only',
        generatedAt: '2026-03-24T00:00:00.000Z',
        entries: []
      })
    );

    expect(() => runKnowledgeReview('/repo', ['review', '--action', 'invalid'])).toThrow(
      'playbook knowledge review: invalid --action value "invalid"; expected reaffirm, revise, or supersede'
    );
    expect(() => runKnowledgeReview('/repo', ['review', '--kind', 'invalid'])).toThrow(
      'playbook knowledge review: invalid --kind value "invalid"; expected knowledge, doc, rule, or pattern'
    );
  });
});
