import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../../lib/cliContract.js';

const buildReviewQueue = vi.fn();
const writeReviewQueueArtifact = vi.fn();
const writeKnowledgeReviewReceipt = vi.fn();
const buildReviewHandoffsArtifact = vi.fn();
const writeReviewHandoffsArtifact = vi.fn();
const buildReviewHandoffRoutesArtifact = vi.fn();
const writeReviewHandoffRoutesArtifact = vi.fn();
const buildReviewDownstreamFollowupsArtifact = vi.fn();
const writeReviewDownstreamFollowupsArtifact = vi.fn();
const existsSync = vi.fn();
const readFileSync = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  buildReviewQueue,
  writeReviewQueueArtifact,
  writeKnowledgeReviewReceipt,
  buildReviewHandoffsArtifact,
  writeReviewHandoffsArtifact,
  buildReviewHandoffRoutesArtifact,
  writeReviewHandoffRoutesArtifact,
  buildReviewDownstreamFollowupsArtifact,
  writeReviewDownstreamFollowupsArtifact,
  REVIEW_QUEUE_RELATIVE_PATH: '.playbook/review-queue.json',
  KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH: '.playbook/knowledge-review-receipts.json',
  REVIEW_HANDOFFS_RELATIVE_PATH: '.playbook/review-handoffs.json',
  REVIEW_HANDOFF_ROUTES_RELATIVE_PATH: '.playbook/review-handoff-routes.json',
  REVIEW_DOWNSTREAM_FOLLOWUPS_RELATIVE_PATH: '.playbook/review-downstream-followups.json'
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
    },
    {
      queueEntryId: 'q-architecture-1',
      targetKind: 'doc',
      path: 'docs/architecture/decisions/decision-a.md',
      sourceSurface: 'architecture-decisions',
      reasonCode: 'architecture-decision-review-trigger',
      evidenceRefs: ['.playbook/memory/lifecycle-candidates.json', 'docs/architecture/decisions/decision-a.md'],
      triggerType: 'evidence',
      triggerSource: 'architecture-decision',
      triggerReasonCode: 'assumption-evidence-updated',
      triggerEvidenceRefs: ['.playbook/memory/lifecycle-candidates.json', 'docs/architecture/decisions/decision-a.md'],
      recommendedAction: 'reaffirm',
      reviewPriority: 'medium',
      generatedAt: '2026-03-24T00:00:00.000Z',
      nextReviewAt: '2026-03-24T00:00:00.000Z',
      overdue: false
    },
    {
      queueEntryId: 'q-interop-1',
      targetKind: 'knowledge',
      targetId: 'knowledge:interop-health-gate',
      sourceSurface: 'interop',
      reasonCode: 'interop-followup-review-cue',
      evidenceRefs: ['.playbook/interop-followups.json'],
      triggerType: 'evidence',
      triggerSource: 'interop-followup',
      triggerReasonCode: 'interop-followup-evidence',
      triggerEvidenceRefs: ['.playbook/interop-followups.json'],
      recommendedAction: 'revise',
      reviewPriority: 'high',
      generatedAt: '2026-03-24T00:00:00.000Z',
      nextReviewAt: '2026-03-24T00:00:00.000Z',
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

const handoffRoutesFixture = () => ({
  schemaVersion: '1.0',
  kind: 'playbook-review-handoff-routes',
  proposalOnly: true as const,
  authority: 'read-only' as const,
  generatedAt: '2026-03-24T12:31:00.000Z',
  routes: [
    {
      routeId: 'route-001',
      handoffId: 'handoff-001',
      targetKind: 'doc',
      path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
      recommendedSurface: 'docs',
      recommendedArtifact: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
      reasonCode: 'docs-revision-follow-up',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md', 'review-handoff:handoff-001'],
      nextActionText: 'Record a docs revision follow-up for path:docs/PLAYBOOK_DEV_WORKFLOW.md in the governed docs workflow.'
    },
    {
      routeId: 'route-002',
      handoffId: 'handoff-002',
      targetKind: 'pattern',
      targetId: 'pattern:existing-review-family-first',
      recommendedSurface: 'promote',
      recommendedArtifact: '.playbook/memory/knowledge/superseded.json',
      reasonCode: 'supersession-follow-up',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md', 'review-handoff:handoff-002'],
      nextActionText: 'Record an explicit supersession follow-up for pattern:pattern:existing-review-family-first through governed promotion/supersede flows.'
    }
  ]
});

const downstreamFollowupsFixture = () => ({
  schemaVersion: '1.0',
  kind: 'playbook-review-downstream-followups',
  proposalOnly: true as const,
  authority: 'read-only' as const,
  generatedAt: '2026-03-24T12:32:00.000Z',
  followups: [
    {
      followupId: 'followup-001',
      type: 'docs-revision',
      routeId: 'route-001',
      handoffId: 'handoff-001',
      targetKind: 'doc',
      path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
      recommendedSurface: 'docs',
      recommendedArtifact: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
      reasonCode: 'docs-revision-follow-up',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md', 'review-handoff:handoff-001'],
      nextActionText: 'Record a docs revision follow-up for path:docs/PLAYBOOK_DEV_WORKFLOW.md in the governed docs workflow.'
    },
    {
      followupId: 'followup-002',
      type: 'supersession',
      routeId: 'route-002',
      handoffId: 'handoff-002',
      targetKind: 'pattern',
      targetId: 'pattern:existing-review-family-first',
      recommendedSurface: 'promote',
      recommendedArtifact: '.playbook/memory/knowledge/superseded.json',
      reasonCode: 'supersession-follow-up',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md', 'review-handoff:handoff-002'],
      nextActionText: 'Record an explicit supersession follow-up for pattern:pattern:existing-review-family-first through governed promotion/supersede flows.'
    }
  ]
});

describe('knowledge review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildReviewQueue.mockReturnValue(reviewQueueFixture());
    writeReviewQueueArtifact.mockReturnValue('/repo/.playbook/review-queue.json');
    buildReviewHandoffsArtifact.mockReturnValue(handoffsFixture());
    writeReviewHandoffsArtifact.mockReturnValue('/repo/.playbook/review-handoffs.json');
    buildReviewHandoffRoutesArtifact.mockReturnValue(handoffRoutesFixture());
    writeReviewHandoffRoutesArtifact.mockReturnValue('/repo/.playbook/review-handoff-routes.json');
    buildReviewDownstreamFollowupsArtifact.mockReturnValue(downstreamFollowupsFixture());
    writeReviewDownstreamFollowupsArtifact.mockReturnValue('/repo/.playbook/review-downstream-followups.json');
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
      total: 6,
      returned: 6,
      byAction: { reaffirm: 3, revise: 2, supersede: 1 },
      byKind: { knowledge: 2, doc: 2, rule: 1, pattern: 1 },
      cadence: { dueNow: 5, overdue: 2, deferred: 1, evidenceTriggered: 4, interopTriggered: 1 },
      triggers: { cadence: 2, evidence: 3, mixed: 1 }
    });
    expect(payload.entries).toHaveLength(6);
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
    expect(payload.summary.returned).toBe(2);
    expect(payload.entries.every((entry: { targetKind?: string }) => entry.targetKind === 'doc')).toBe(true);

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
    expect(payload.summary.returned).toBe(2);
    expect(payload.entries.every((entry: { overdue?: boolean }) => entry.overdue === true)).toBe(true);

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--due', 'all'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(5);

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--trigger', 'evidence'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(4);
    expect(payload.entries.every((entry: { triggerType?: string }) => entry.triggerType === 'evidence' || entry.triggerType === 'cadence+evidence')).toBe(true);

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--trigger', 'evidence', '--trigger-source', 'architecture-decision'], {
      format: 'json',
      quiet: false
    });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.filters.triggerSource).toBe('architecture-decision');
    expect(payload.entries[0].queueEntryId).toBe('q-architecture-1');

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', '--trigger-source', 'interop-followup'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.filters.triggerSource).toBe('interop-followup');
    expect(payload.entries[0].queueEntryId).toBe('q-interop-1');

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
    expect(rendered).toContain('Status: 6 review item(s) pending');
    expect(rendered).toContain('Due now: 5');
    expect(rendered).toContain('Evidence-triggered: 4');
    expect(rendered).toContain('Interop-triggered: 1');
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

  it('materializes and filters review routes with deterministic json output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    readFileSync.mockImplementation((inputPath: string) => {
      if (inputPath.includes('review-handoff-routes.json')) {
        return JSON.stringify(handoffRoutesFixture());
      }
      if (inputPath.includes('review-handoffs.json')) {
        return JSON.stringify(handoffsFixture());
      }
      return JSON.stringify(reviewQueueFixture());
    });

    let exitCode = await runKnowledge('/repo', ['review', 'routes', '--json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(buildReviewHandoffRoutesArtifact).toHaveBeenCalledWith('/repo');
    expect(writeReviewHandoffRoutesArtifact).toHaveBeenCalledWith('/repo', expect.objectContaining({ kind: 'playbook-review-handoff-routes' }));

    let payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-review-routes');
    expect(payload.summary).toMatchObject({
      total: 2,
      returned: 2,
      bySurface: { story: 0, promote: 1, docs: 1, memory: 0 },
      byDecision: { revise: 1, supersede: 1 },
      byKind: { knowledge: 0, doc: 1, rule: 0, pattern: 1 }
    });

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', 'routes', '--surface', 'docs', '--decision', 'revise', '--kind', 'doc', '--json'], {
      format: 'json',
      quiet: false
    });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.routes[0].recommendedSurface).toBe('docs');
    expect(payload.routes[0].targetKind).toBe('doc');

    logSpy.mockRestore();
  });

  it('renders compact routed handoff text output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    readFileSync.mockImplementation((inputPath: string) => {
      if (inputPath.includes('review-handoff-routes.json')) {
        return JSON.stringify(handoffRoutesFixture());
      }
      if (inputPath.includes('review-handoffs.json')) {
        return JSON.stringify(handoffsFixture());
      }
      return JSON.stringify(reviewQueueFixture());
    });

    const exitCode = await runKnowledge('/repo', ['review', 'routes'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Status: 2 routed handoff(s) pending');
    expect(rendered).toContain('Affected targets: docs/PLAYBOOK_DEV_WORKFLOW.md, pattern:existing-review-family-first');
    expect(rendered).toContain('Recommended surface: docs');
    expect(rendered).toContain('Next action: Record a docs revision follow-up');
    logSpy.mockRestore();
  });

  it('fails with deterministic validation for unsupported review route surface filters', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review', 'routes', '--surface', 'queue'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('invalid --surface value "queue"; expected story, promote, docs, or memory');
    errorSpy.mockRestore();
  });

  it('materializes and filters downstream review followups with deterministic json output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    readFileSync.mockReturnValue(JSON.stringify(downstreamFollowupsFixture()));

    let exitCode = await runKnowledge('/repo', ['review', 'followups', '--json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(buildReviewDownstreamFollowupsArtifact).toHaveBeenCalledWith('/repo');
    expect(writeReviewDownstreamFollowupsArtifact).toHaveBeenCalledWith('/repo', expect.objectContaining({ kind: 'playbook-review-downstream-followups' }));

    let payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-review-followups');
    expect(payload.summary).toMatchObject({
      total: 2,
      returned: 2,
      byType: { 'docs-revision': 1, 'promote-memory': 0, 'story-seed': 0, supersession: 1 },
      bySurface: { story: 0, promote: 1, docs: 1, memory: 0 },
      byKind: { knowledge: 0, doc: 1, rule: 0, pattern: 1 }
    });

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['review', 'followups', '--kind', 'doc', '--surface', 'docs', '--json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary.returned).toBe(1);
    expect(payload.followups[0].targetKind).toBe('doc');
    expect(payload.followups[0].recommendedSurface).toBe('docs');

    logSpy.mockRestore();
  });

  it('renders compact downstream followup text output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    readFileSync.mockReturnValue(JSON.stringify(downstreamFollowupsFixture()));

    const exitCode = await runKnowledge('/repo', ['review', 'followups'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Status: 2 downstream follow-up suggestion(s)');
    expect(rendered).toContain('Affected targets: docs/PLAYBOOK_DEV_WORKFLOW.md, pattern:existing-review-family-first');
    expect(rendered).toContain('Recommended surface: docs');
    expect(rendered).toContain('Next action: Record a docs revision follow-up');
    logSpy.mockRestore();
  });

  it('fails with deterministic validation for unsupported followup surface filters', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review', 'followups', '--surface', 'queue'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('playbook knowledge review followups: invalid --surface value "queue"; expected story, promote, docs, or memory');
    errorSpy.mockRestore();
  });
});
