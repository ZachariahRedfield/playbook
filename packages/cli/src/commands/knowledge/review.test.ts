import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../../lib/cliContract.js';

const buildReviewQueue = vi.fn();
const writeReviewQueueArtifact = vi.fn();
const existsSync = vi.fn();
const readFileSync = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  buildReviewQueue,
  writeReviewQueueArtifact,
  REVIEW_QUEUE_RELATIVE_PATH: '.playbook/review-queue.json'
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
      targetKind: 'doc',
      path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
      sourceSurface: 'governed-docs',
      reasonCode: 'governed-doc-staleness-window',
      evidenceRefs: ['docs/PLAYBOOK_DEV_WORKFLOW.md'],
      recommendedAction: 'revise',
      reviewPriority: 'medium',
      generatedAt: '2026-03-24T00:00:00.000Z'
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
      total: 2,
      returned: 2,
      byAction: { reaffirm: 1, revise: 1, supersede: 0 },
      byKind: { knowledge: 1, doc: 1, rule: 0, pattern: 0 }
    });
    expect(payload.entries).toHaveLength(2);
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

    logSpy.mockRestore();
  });

  it('renders compact operator-facing text output', async () => {
    const { runKnowledge } = await import('../knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runKnowledge('/repo', ['review'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Status: 2 review item(s) pending');
    expect(rendered).toContain('Affected targets: knowledge:stale-runtime-guard, docs/PLAYBOOK_DEV_WORKFLOW.md');
    expect(rendered).toContain('Blockers / reason: stale-active-knowledge');
    expect(rendered).toContain('Next action: reaffirm knowledge:stale-runtime-guard');
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
});
