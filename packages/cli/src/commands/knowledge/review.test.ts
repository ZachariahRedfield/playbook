import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../../lib/cliContract.js';

const buildReviewQueue = vi.fn();
const writeReviewQueueArtifact = vi.fn();
const writeKnowledgeReviewReceipt = vi.fn();
const existsSync = vi.fn();
const readFileSync = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  buildReviewQueue,
  writeReviewQueueArtifact,
  writeKnowledgeReviewReceipt,
  REVIEW_QUEUE_RELATIVE_PATH: '.playbook/review-queue.json',
  KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH: '.playbook/knowledge-review-receipts.json'
}));

vi.mock('node:fs', () => ({
  default: { existsSync, readFileSync },
  existsSync,
  readFileSync
}));

const reviewQueueFixture = () => ({
  schemaVersion: '1.0',
  kind: 'playbook-review-queue',
  proposalOnly: true,
  authority: 'read-only' as const,
  generatedAt: '2026-03-24T00:00:00.000Z',
  entries: [
    {
      queueEntryId: 'q-knowledge-1',
      targetKind: 'knowledge',
      targetId: 'knowledge:stale-runtime-guard',
      sourceSurface: 'memory-knowledge',
      reasonCode: 'stale-active-knowledge',
      evidenceRefs: ['.playbook/memory/knowledge/patterns.json'],
      recommendedAction: 'reaffirm',
      reviewPriority: 'high',
      generatedAt: '2026-03-24T00:00:00.000Z'
    },
    {
      queueEntryId: 'q-doc-1',
      targetKind: 'doc',
      path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
      sourceSurface: 'governed-docs',
      reasonCode: 'governed-doc-staleness-window',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md'],
      recommendedAction: 'revise',
      reviewPriority: 'medium',
      generatedAt: '2026-03-24T00:00:00.000Z'
    },
    {
      queueEntryId: 'q-rule-1',
      targetKind: 'rule',
      targetId: 'rule:review-surface-only',
      sourceSurface: 'governance',
      reasonCode: 'rule-review-window',
      evidenceRefs: ['docs/commands/README.md'],
      recommendedAction: 'reaffirm',
      reviewPriority: 'low',
      generatedAt: '2026-03-24T00:00:00.000Z'
    },
    {
      queueEntryId: 'q-pattern-1',
      targetKind: 'pattern',
      targetId: 'pattern:existing-review-family-first',
      sourceSurface: 'governance',
      reasonCode: 'pattern-review-window',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md'],
      recommendedAction: 'supersede',
      reviewPriority: 'medium',
      generatedAt: '2026-03-24T00:00:00.000Z'
    }
  ]
});

const receiptsFixture = () => ({
  schemaVersion: '1.0',
  kind: 'playbook-knowledge-review-receipts',
  generatedAt: '2026-03-24T12:00:00.000Z',
  receipts: [
    {
      receiptId: 'receipt-123',
      queueEntryId: 'q-knowledge-1',
      targetKind: 'knowledge',
      targetId: 'knowledge:stale-runtime-guard',
      sourceSurface: 'memory-knowledge',
      reasonCode: 'stale-active-knowledge',
      decision: 'defer',
      evidenceRefs: ['.playbook/memory/knowledge/patterns.json', 'ticket:KB-321'],
      decidedAt: '2026-03-24T12:00:00.000Z',
      followUpArtifactPath: 'docs/postmortems/KB-321.md'
    }
  ]
});

describe('knowledge review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildReviewQueue.mockReturnValue(reviewQueueFixture());
    writeReviewQueueArtifact.mockReturnValue('/repo/.playbook/review-queue.json');
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(JSON.stringify(reviewQueueFixture()));
    writeKnowledgeReviewReceipt.mockReturnValue(receiptsFixture());
  });

  it('materializes and emits deterministic json output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(buildReviewQueue).toHaveBeenCalledWith('/repo');
    expect(writeReviewQueueArtifact).toHaveBeenCalledWith('/repo', expect.objectContaining({ kind: 'playbook-review-queue' }));

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-review');
    expect(payload.artifactPath).toBe('.playbook/review-queue.json');
    expect(payload.summary).toMatchObject({
      total: 4,
      returned: 4,
      byAction: { reaffirm: 2, revise: 1, supersede: 1 },
      byKind: { knowledge: 1, doc: 1, rule: 1, pattern: 1 }
    });
    expect(payload.entries).toHaveLength(4);
    logSpy.mockRestore();
  });

  it('supports deterministic --action and --kind filtering', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    let exitCode = await runKnowledge('/repo', ['review', '--action', 'reaffirm', '--kind', 'knowledge'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    let payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.entries[0].targetKind).toBe('knowledge');
    expect(payload.entries[0].recommendedAction).toBe('reaffirm');

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--kind', 'doc'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.entries[0].targetKind).toBe('doc');

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--kind', 'pattern'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.entries[0].targetKind).toBe('pattern');

    logSpy.mockRestore();
  });

  it('records a deterministic review receipt from queue entry linkage', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runKnowledge(
      '/repo',
      [
        'review',
        'record',
        '--from',
        'q-knowledge-1',
        '--decision',
        'defer',
        '--evidence-ref',
        'ticket:KB-321',
        '--followup-ref',
        'docs/postmortems/KB-321.md',
        '--receipt-id',
        'receipt-123'
      ],
      { format: 'json', quiet: false }
    );

    expect(exitCode).toBe(ExitCode.Success);
    expect(writeKnowledgeReviewReceipt).toHaveBeenCalledWith(
      '/repo',
      expect.objectContaining({
        receiptId: 'receipt-123',
        queueEntryId: 'q-knowledge-1',
        targetKind: 'knowledge',
        targetId: 'knowledge:stale-runtime-guard',
        decision: 'defer',
        sourceSurface: 'memory-knowledge',
        followUpArtifactPath: 'docs/postmortems/KB-321.md'
      })
    );

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-review-record');
    expect(payload.artifactPath).toBe('.playbook/knowledge-review-receipts.json');
    expect(payload.queueEntryId).toBe('q-knowledge-1');
    expect(payload.target).toEqual({ targetKind: 'knowledge', targetId: 'knowledge:stale-runtime-guard' });
    expect(payload.decision).toBe('defer');
    expect(payload.reasonCode).toBe('stale-active-knowledge');
    expect(payload.receipt.receiptId).toBe('receipt-123');
    logSpy.mockRestore();
  });

  it('renders compact operator-facing text output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Status: 4 review item(s) pending');
    expect(rendered).toContain('Affected targets: knowledge:stale-runtime-guard, docs/PLAYBOOK_DEV_WORKFLOW.md');
    expect(rendered).toContain('Blockers / reason: stale-active-knowledge');
    expect(rendered).toContain('Next action: reaffirm knowledge:stale-runtime-guard');
    logSpy.mockRestore();
  });

  it('renders brief text output for recorded receipt', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review', 'record', '--from', 'q-knowledge-1', '--decision', 'defer'], {
      format: 'text',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Decision: defer');
    expect(rendered).toContain('Affected target: knowledge:stale-runtime-guard');
    expect(rendered).toContain('Next action: wait for defer window before the next review pass');

    logSpy.mockRestore();
  });

  it('fails with deterministic validation for unsupported filters', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review', '--action', 'invalid'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('invalid --action value "invalid"');
    errorSpy.mockRestore();
  });

  it('fails when --from is missing for record', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review', 'record', '--decision', 'reaffirm'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('missing required --from');

    errorSpy.mockRestore();
  });
});
