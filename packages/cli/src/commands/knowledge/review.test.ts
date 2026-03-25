import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../../lib/cliContract.js';

const buildReviewQueue = vi.fn();
const writeReviewQueueArtifact = vi.fn();
const writeKnowledgeReviewReceipt = vi.fn();
const buildReviewHandoffsArtifact = vi.fn();
const writeReviewHandoffsArtifact = vi.fn();
const existsSync = vi.fn();
const readFileSync = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  buildReviewQueue,
  writeReviewQueueArtifact,
  writeKnowledgeReviewReceipt,
  buildReviewHandoffsArtifact,
  writeReviewHandoffsArtifact,
  REVIEW_QUEUE_RELATIVE_PATH: '.playbook/review-queue.json',
  KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH: '.playbook/knowledge-review-receipts.json',
  REVIEW_HANDOFFS_RELATIVE_PATH: '.playbook/review-handoffs.json'
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
      triggerType: 'evidence',
      triggerSource: 'memory-knowledge',
      triggerReasonCode: 'stale-active-knowledge',
      triggerEvidenceRefs: ['.playbook/memory/knowledge/patterns.json'],
      recommendedAction: 'reaffirm',
      reviewPriority: 'high',
      generatedAt: '2026-03-24T00:00:00.000Z',
      nextReviewAt: '2026-03-24T00:00:00.000Z',
      overdue: true
    },
    {
      queueEntryId: 'q-architecture-1',
      targetKind: 'rule',
      targetId: 'rule:architecture-boundary-ownership',
      sourceSurface: 'architecture-decisions',
      reasonCode: 'architecture-decision-recall',
      evidenceRefs: ['docs/architecture/decisions/ADR-042.md'],
      triggerType: 'evidence',
      triggerSource: 'architecture-decisions',
      triggerReasonCode: 'architecture-decision-changed',
      triggerEvidenceRefs: ['docs/architecture/decisions/ADR-042.md'],
      triggerStrength: 88,
      triggerDecisionId: 'ADR-042',
      triggerDecisionPath: 'docs/architecture/decisions/ADR-042.md',
      recommendedAction: 'revise',
      reviewPriority: 'high',
      generatedAt: '2026-03-24T00:00:00.000Z',
      nextReviewAt: '2026-03-24T00:00:00.000Z',
      overdue: true
    },
    {
      queueEntryId: 'q-doc-1',
      targetKind: 'doc',
      path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
      sourceSurface: 'governed-docs',
      reasonCode: 'governed-doc-staleness-window',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md'],
      triggerType: 'cadence',
      triggerSource: 'governed-docs',
      triggerReasonCode: 'cadence-window-due',
      triggerEvidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md'],
      recommendedAction: 'revise',
      reviewPriority: 'medium',
      generatedAt: '2026-03-24T00:00:00.000Z',
      deferredUntil: '2026-04-01T00:00:00.000Z',
      nextReviewAt: '2026-04-01T00:00:00.000Z',
      overdue: false
    },
    {
      queueEntryId: 'q-rule-1',
      targetKind: 'rule',
      targetId: 'rule:review-surface-only',
      sourceSurface: 'governance',
      reasonCode: 'rule-review-window',
      evidenceRefs: ['docs/commands/README.md'],
      triggerType: 'cadence',
      triggerSource: 'governance',
      triggerReasonCode: 'rule-review-window',
      triggerEvidenceRefs: ['docs/commands/README.md'],
      recommendedAction: 'reaffirm',
      reviewPriority: 'low',
      generatedAt: '2026-03-24T00:00:00.000Z',
      nextReviewAt: '2026-03-24T00:00:00.000Z',
      overdue: true
    },
    {
      queueEntryId: 'q-pattern-1',
      targetKind: 'pattern',
      targetId: 'pattern:existing-review-family-first',
      sourceSurface: 'governance',
      reasonCode: 'pattern-review-window',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md'],
      triggerType: 'cadence+evidence',
      triggerSource: 'governance',
      triggerReasonCode: 'pattern-review-window',
      triggerEvidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md'],
      recommendedAction: 'supersede',
      reviewPriority: 'medium',
      generatedAt: '2026-03-24T00:00:00.000Z',
      nextReviewAt: '2026-03-26T00:00:00.000Z',
      overdue: false
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

const handoffsFixture = () => ({
  schemaVersion: '1.0',
  kind: 'playbook-review-handoffs',
  proposalOnly: true as const,
  authority: 'read-only' as const,
  generatedAt: '2026-03-24T12:30:00.000Z',
  handoffs: [
    {
      handoffId: 'handoff-001',
      queueEntryId: 'q-doc-1',
      receiptId: 'receipt-201',
      targetKind: 'doc',
      path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
      decision: 'revise',
      recommendedFollowupType: 'revise-target',
      recommendedFollowupRef: 'path:docs/PLAYBOOK_DEV_WORKFLOW.md',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md', 'review-receipt:receipt-201'],
      nextActionText: 'Record explicit revision follow-up for path:docs/PLAYBOOK_DEV_WORKFLOW.md through existing promotion, story, or docs workflows.'
    },
    {
      handoffId: 'handoff-002',
      queueEntryId: 'q-pattern-1',
      receiptId: 'receipt-301',
      targetKind: 'pattern',
      targetId: 'pattern:existing-review-family-first',
      decision: 'supersede',
      recommendedFollowupType: 'supersede-target',
      recommendedFollowupRef: 'pattern:pattern:existing-review-family-first',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md', 'review-receipt:receipt-301'],
      nextActionText: 'Record explicit supersession follow-up for pattern:pattern:existing-review-family-first through existing promote or supersede flows.'
    }
  ],
  deferred: []
});

describe('knowledge review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildReviewQueue.mockReturnValue(reviewQueueFixture());
    writeReviewQueueArtifact.mockReturnValue('/repo/.playbook/review-queue.json');
    buildReviewHandoffsArtifact.mockReturnValue(handoffsFixture());
    writeReviewHandoffsArtifact.mockReturnValue('/repo/.playbook/review-handoffs.json');
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
      total: 5,
      returned: 5,
      byAction: { reaffirm: 2, revise: 2, supersede: 1 },
      byKind: { knowledge: 1, doc: 1, rule: 2, pattern: 1 },
      cadence: { dueNow: 4, overdue: 3, deferred: 1, evidenceTriggered: 3 },
      triggers: { cadence: 2, evidence: 2, mixed: 1 },
      triggerSources: { architectureDecision: 1, other: 4 }
    });
    expect(payload.summary.affectedTargets).toContain('rule:architecture-boundary-ownership');
    expect(payload.entries).toHaveLength(5);
    expect(payload.entries.find((entry: { queueEntryId: string }) => entry.queueEntryId === 'q-architecture-1')).toMatchObject({
      triggerDecisionId: 'ADR-042',
      triggerDecisionPath: 'docs/architecture/decisions/ADR-042.md'
    });
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

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--due', 'overdue'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(3);
    expect(payload.entries.every((entry: { overdue?: boolean }) => entry.overdue === true)).toBe(true);
    expect(payload.entries.map((entry: { queueEntryId: string }) => entry.queueEntryId).sort()).toEqual([
      'q-architecture-1',
      'q-knowledge-1',
      'q-rule-1'
    ]);

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--due', 'all'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(5);

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--trigger', 'evidence'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(3);
    expect(payload.entries.every((entry: { triggerType?: string }) => entry.triggerType === 'evidence' || entry.triggerType === 'cadence+evidence')).toBe(true);
    expect(payload.entries.map((entry: { queueEntryId: string }) => entry.queueEntryId).sort()).toEqual([
      'q-architecture-1',
      'q-knowledge-1',
      'q-pattern-1'
    ]);

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--trigger-source', 'architecture-decision'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.entries[0].queueEntryId).toBe('q-architecture-1');

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
    expect(rendered).toContain('Status: 5 review item(s) pending');
    expect(rendered).toContain('Evidence-triggered: 3');
    expect(rendered).toContain('Affected targets:');
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

    let exitCode = await runKnowledge('/repo', ['review', '--action', 'invalid'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('invalid --action value "invalid"');

    errorSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--due', 'later'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('invalid --due value "later"');

    errorSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--trigger', 'priority'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('invalid --trigger value "priority"');

    errorSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--trigger-source', 'architecture'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('invalid --trigger-source value "architecture"');
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

  it('materializes and filters review handoffs with deterministic json output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    readFileSync.mockReturnValue(JSON.stringify(handoffsFixture()));

    let exitCode = await runKnowledge('/repo', ['review', 'handoffs', '--json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(buildReviewHandoffsArtifact).toHaveBeenCalledWith('/repo');
    expect(writeReviewHandoffsArtifact).toHaveBeenCalledWith('/repo', expect.objectContaining({ kind: 'playbook-review-handoffs' }));
    expect(writeKnowledgeReviewReceipt).not.toHaveBeenCalled();

    let payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-review-handoffs');
    expect(payload.summary).toMatchObject({
      total: 2,
      returned: 2,
      byDecision: { revise: 1, supersede: 1 },
      byKind: { knowledge: 0, doc: 1, rule: 0, pattern: 1 }
    });

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', 'handoffs', '--decision', 'supersede', '--kind', 'pattern', '--json'], {
      format: 'json',
      quiet: false
    });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.handoffs[0].decision).toBe('supersede');
    expect(payload.handoffs[0].targetKind).toBe('pattern');

    logSpy.mockRestore();
  });

  it('renders compact handoff text output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    readFileSync.mockReturnValue(JSON.stringify(handoffsFixture()));

    const exitCode = await runKnowledge('/repo', ['review', 'handoffs'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Status: 2 review handoff(s) pending');
    expect(rendered).toContain('Affected targets: docs/PLAYBOOK_DEV_WORKFLOW.md, pattern:existing-review-family-first');
    expect(rendered).toContain('Recommended follow-up: revise-target (path:docs/PLAYBOOK_DEV_WORKFLOW.md)');
    expect(rendered).toContain('Next action: Record explicit revision follow-up');
    logSpy.mockRestore();
  });

  it('fails with deterministic validation for unsupported handoff decisions', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review', 'handoffs', '--decision', 'defer'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('invalid --decision value "defer"; expected revise or supersede');
    errorSpy.mockRestore();
  });
});
