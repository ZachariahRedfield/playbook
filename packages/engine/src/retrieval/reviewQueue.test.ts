import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReviewQueue } from './reviewQueue.js';

const touchedDirs: string[] = [];

const createTempRepo = (): string => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-review-queue-'));
  touchedDirs.push(repoRoot);
  return repoRoot;
};

const writeJson = (repoRoot: string, relativePath: string, payload: unknown): void => {
  const filePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const writeText = (repoRoot: string, relativePath: string, content: string, modifiedAt: Date): void => {
  const filePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.utimesSync(filePath, modifiedAt, modifiedAt);
};

afterEach(() => {
  while (touchedDirs.length > 0) {
    const directory = touchedDirs.pop();
    if (directory && fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('buildReviewQueue', () => {
  it('is deterministic for same inputs and generatedAt', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/memory/knowledge/decisions.json', {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'decision',
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'k-1',
          candidateId: 'c-1',
          sourceCandidateIds: ['c-1'],
          sourceEventFingerprints: ['e-1'],
          kind: 'decision',
          title: 'Knowledge 1',
          summary: 'Summary',
          fingerprint: 'f-1',
          module: 'docs',
          ruleId: 'docs.rule',
          failureShape: 'shape',
          promotedAt: '2025-01-01T00:00:00.000Z',
          provenance: [],
          status: 'active',
          supersedes: [],
          supersededBy: []
        }
      ]
    });

    const generatedAt = '2026-03-24T00:00:00.000Z';
    const left = buildReviewQueue(repoRoot, { generatedAt });
    const right = buildReviewQueue(repoRoot, { generatedAt });

    expect(left).toEqual(right);
    expect(left.entries.length).toBe(1);
    expect(left.entries[0]?.targetId).toBe('k-1');
    expect(left.entries[0]?.queueEntryId).toBeTypeOf('string');
  });

  it('adds review entries for stale active knowledge', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/memory/knowledge/patterns.json', {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'pattern',
      generatedAt: '2026-02-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'k-stale',
          candidateId: 'c-stale',
          sourceCandidateIds: ['c-stale'],
          sourceEventFingerprints: ['e-stale'],
          kind: 'pattern',
          title: 'Old pattern',
          summary: 'Old summary',
          fingerprint: 'fp-stale',
          module: 'engine',
          ruleId: 'engine.rule',
          failureShape: 'stale',
          promotedAt: '2025-01-01T00:00:00.000Z',
          provenance: [],
          status: 'active',
          supersedes: [],
          supersededBy: []
        }
      ]
    });

    const queue = buildReviewQueue(repoRoot, {
      generatedAt: '2026-03-24T00:00:00.000Z',
      staleKnowledgeDays: 30
    });

    expect(queue.entries).toContainEqual(
      expect.objectContaining({
        targetKind: 'knowledge',
        targetId: 'k-stale',
        reasonCode: 'stale-active-knowledge',
        recommendedAction: 'reaffirm',
        reviewPriority: 'high'
      })
    );
  });

  it('adds superseded knowledge lineage checks with supersede action', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/memory/knowledge/failure-modes.json', {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'failure_mode',
      generatedAt: '2026-02-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'k-old',
          candidateId: 'c-old',
          sourceCandidateIds: ['c-old'],
          sourceEventFingerprints: ['e-old'],
          kind: 'failure_mode',
          title: 'Old failure mode',
          summary: 'Old summary',
          fingerprint: 'fp-old',
          module: 'engine',
          ruleId: 'engine.rule',
          failureShape: 'shape-old',
          promotedAt: '2025-01-01T00:00:00.000Z',
          provenance: [],
          status: 'superseded',
          supersedes: [],
          supersededBy: ['k-new']
        }
      ]
    });

    const queue = buildReviewQueue(repoRoot, {
      generatedAt: '2026-03-24T00:00:00.000Z',
      staleKnowledgeDays: 30
    });

    expect(queue.entries).toContainEqual(
      expect.objectContaining({
        targetKind: 'knowledge',
        targetId: 'k-old',
        reasonCode: 'superseded-knowledge-lineage-check',
        recommendedAction: 'supersede',
        reviewPriority: 'medium'
      })
    );
  });

  it('keeps non-governed docs out of the queue while including governed docs and postmortem context', () => {
    const repoRoot = createTempRepo();
    const oldDate = new Date('2025-01-01T00:00:00.000Z');

    writeText(repoRoot, 'docs/PLAYBOOK_PRODUCT_ROADMAP.md', '# roadmap\n', oldDate);
    writeText(repoRoot, 'docs/postmortems/incident.md', '# postmortem\n', oldDate);
    writeText(repoRoot, 'docs/random-notes.md', '# random\n', oldDate);

    writeJson(repoRoot, '.playbook/memory/candidates.json', {
      schemaVersion: '1.0',
      kind: 'playbook-memory-replay',
      generatedAt: '2026-03-24T00:00:00.000Z',
      candidates: [
        {
          candidateId: 'cand-1',
          kind: 'pattern',
          module: 'docs',
          ruleId: 'docs.rule',
          failureShape: 'none',
          title: 'Candidate',
          summary: 'Candidate summary',
          fingerprint: 'candidate-fp',
          provenance: [
            {
              eventId: 'event-1',
              sourcePath: 'docs/postmortems/incident.md',
              fingerprint: 'prov-1'
            }
          ]
        }
      ]
    });

    const queue = buildReviewQueue(repoRoot, {
      generatedAt: '2026-03-24T00:00:00.000Z',
      docReviewWindowDays: 30
    });

    expect(queue.entries.some((entry) => entry.path === 'docs/PLAYBOOK_PRODUCT_ROADMAP.md')).toBe(true);
    expect(queue.entries.some((entry) => entry.path === 'docs/postmortems/incident.md')).toBe(true);
    expect(queue.entries.some((entry) => entry.path === 'docs/random-notes.md')).toBe(false);
  });

  it('remains proposal-only with read-only authority', () => {
    const repoRoot = createTempRepo();
    const queue = buildReviewQueue(repoRoot, {
      generatedAt: '2026-03-24T00:00:00.000Z'
    });

    expect(queue.proposalOnly).toBe(true);
    expect(queue.authority).toBe('read-only');
  });

  it('suppresses reaffirmed entries until the next review window', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/memory/knowledge/decisions.json', {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'decision',
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'k-reaffirm',
          candidateId: 'c-reaffirm',
          sourceCandidateIds: ['c-reaffirm'],
          sourceEventFingerprints: ['e-reaffirm'],
          kind: 'decision',
          title: 'Knowledge reaffirm',
          summary: 'Summary',
          fingerprint: 'f-reaffirm',
          module: 'docs',
          ruleId: 'docs.rule',
          failureShape: 'shape',
          promotedAt: '2025-01-01T00:00:00.000Z',
          provenance: [],
          status: 'active',
          supersedes: [],
          supersededBy: []
        }
      ]
    });

    const firstQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-03-24T00:00:00.000Z', staleKnowledgeDays: 30 });
    const firstEntry = firstQueue.entries[0];
    expect(firstEntry).toBeDefined();

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'r-reaffirm-1',
          queueEntryId: firstEntry?.queueEntryId,
          targetKind: 'knowledge',
          targetId: 'k-reaffirm',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          decision: 'reaffirm',
          evidenceRefs: ['candidate:c-reaffirm'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const suppressedQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-03-25T00:00:00.000Z', staleKnowledgeDays: 30 });
    expect(suppressedQueue.entries.some((entry) => entry.targetId === 'k-reaffirm')).toBe(false);

    const resurfacedQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-05-01T00:00:00.000Z', staleKnowledgeDays: 30 });
    expect(resurfacedQueue.entries.some((entry) => entry.targetId === 'k-reaffirm')).toBe(true);
  });

  it('suppresses deferred entries until defer window expires', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/memory/knowledge/patterns.json', {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'pattern',
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'k-defer',
          candidateId: 'c-defer',
          sourceCandidateIds: ['c-defer'],
          sourceEventFingerprints: ['e-defer'],
          kind: 'pattern',
          title: 'Deferred pattern',
          summary: 'Summary',
          fingerprint: 'fp-defer',
          module: 'engine',
          ruleId: 'engine.rule',
          failureShape: 'shape',
          promotedAt: '2025-01-01T00:00:00.000Z',
          provenance: [],
          status: 'active',
          supersedes: [],
          supersededBy: []
        }
      ]
    });

    const firstQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-03-24T00:00:00.000Z', staleKnowledgeDays: 30 });
    const firstEntry = firstQueue.entries[0];

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'r-defer-1',
          queueEntryId: firstEntry?.queueEntryId,
          targetKind: 'knowledge',
          targetId: 'k-defer',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          decision: 'defer',
          evidenceRefs: ['candidate:c-defer'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        }
      ]
    });

    const beforeWindowQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-03-24T12:00:00.000Z', staleKnowledgeDays: 30, deferWindowDays: 10 });
    expect(beforeWindowQueue.entries.some((entry) => entry.targetId === 'k-defer')).toBe(false);

    const afterWindowQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-04-04T00:00:00.000Z', staleKnowledgeDays: 30, deferWindowDays: 10 });
    const deferredEntry = afterWindowQueue.entries.find((entry) => entry.targetId === 'k-defer');
    expect(deferredEntry?.deferredUntil).toBe('2026-04-03T01:00:00.000Z');
    expect(deferredEntry?.nextReviewAt).toBe('2026-04-03T01:00:00.000Z');
    expect(deferredEntry?.overdue).toBe(true);
  });

  it('supports explicit deferUntil and per-kind cadence policy defaults', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-policy.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-policy',
      generatedAt: '2026-03-24T00:00:00.000Z',
      targetDefaults: {
        knowledge: { reaffirmCadenceDays: 45, deferWindowDays: 14 },
        pattern: { reaffirmCadenceDays: 10, deferWindowDays: 3 },
        rule: { reaffirmCadenceDays: 45, deferWindowDays: 14 },
        doc: { reaffirmCadenceDays: 90, deferWindowDays: 14 }
      }
    });
    writeJson(repoRoot, '.playbook/memory/knowledge/patterns.json', {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'pattern',
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'k-policy-pattern',
          candidateId: 'c-policy-pattern',
          sourceCandidateIds: ['c-policy-pattern'],
          sourceEventFingerprints: ['e-policy-pattern'],
          kind: 'pattern',
          title: 'Pattern from policy',
          summary: 'Summary',
          fingerprint: 'fp-policy-pattern',
          module: 'engine',
          ruleId: 'engine.rule',
          failureShape: 'shape',
          promotedAt: '2026-03-01T00:00:00.000Z',
          provenance: [],
          status: 'active',
          supersedes: [],
          supersededBy: []
        }
      ]
    });

    const policyDrivenQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-03-20T00:00:00.000Z' });
    const policyEntry = policyDrivenQueue.entries.find((entry) => entry.targetId === 'k-policy-pattern');
    expect(policyEntry?.cadenceKind).toBe('pattern');

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'r-policy-defer-1',
          queueEntryId: policyEntry?.queueEntryId,
          targetKind: 'knowledge',
          targetId: 'k-policy-pattern',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'stale-active-knowledge',
          decision: 'defer',
          evidenceRefs: ['candidate:c-policy-pattern'],
          decidedAt: '2026-03-24T01:00:00.000Z',
          deferUntil: '2026-04-15T00:00:00.000Z'
        }
      ]
    });

    const beforeExplicitDeferQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-04-14T00:00:00.000Z' });
    expect(beforeExplicitDeferQueue.entries.some((entry) => entry.targetId === 'k-policy-pattern')).toBe(false);

    const afterExplicitDeferQueue = buildReviewQueue(repoRoot, { generatedAt: '2026-04-16T00:00:00.000Z' });
    const explicitDeferredEntry = afterExplicitDeferQueue.entries.find((entry) => entry.targetId === 'k-policy-pattern');
    expect(explicitDeferredEntry?.deferredUntil).toBe('2026-04-15T00:00:00.000Z');
  });

  it('suppresses superseded receipts and keeps revise visible until follow-up exists', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/memory/knowledge/failure-modes.json', {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'failure_mode',
      generatedAt: '2026-02-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'k-super',
          candidateId: 'c-super',
          sourceCandidateIds: ['c-super'],
          sourceEventFingerprints: ['e-super'],
          kind: 'failure_mode',
          title: 'Supersede me',
          summary: 'Old summary',
          fingerprint: 'fp-super',
          module: 'engine',
          ruleId: 'engine.rule',
          failureShape: 'shape-old',
          promotedAt: '2025-01-01T00:00:00.000Z',
          provenance: [],
          status: 'superseded',
          supersedes: [],
          supersededBy: ['k-new']
        }
      ]
    });
    writeText(repoRoot, 'docs/postmortems/revise-me.md', '# revise\n', new Date('2025-01-01T00:00:00.000Z'));
    writeJson(repoRoot, '.playbook/memory/candidates.json', {
      schemaVersion: '1.0',
      kind: 'playbook-memory-replay',
      generatedAt: '2026-03-24T00:00:00.000Z',
      candidates: [
        {
          candidateId: 'cand-revise',
          kind: 'pattern',
          module: 'docs',
          ruleId: 'docs.rule',
          failureShape: 'none',
          title: 'Candidate',
          summary: 'Candidate summary',
          fingerprint: 'candidate-fp',
          provenance: [
            {
              eventId: 'event-1',
              sourcePath: 'docs/postmortems/revise-me.md',
              fingerprint: 'prov-1'
            }
          ]
        }
      ]
    });

    const queue = buildReviewQueue(repoRoot, { generatedAt: '2026-03-24T00:00:00.000Z', staleKnowledgeDays: 30, docReviewWindowDays: 30 });
    const supersedeEntry = queue.entries.find((entry) => entry.targetId === 'k-super');
    const reviseEntry = queue.entries.find((entry) => entry.reasonCode === 'postmortem-candidate-context');
    expect(supersedeEntry).toBeDefined();
    expect(reviseEntry).toBeDefined();

    writeJson(repoRoot, '.playbook/knowledge-review-receipts.json', {
      schemaVersion: '1.0',
      kind: 'playbook-knowledge-review-receipts',
      generatedAt: '2026-03-24T01:00:00.000Z',
      receipts: [
        {
          receiptId: 'r-super-1',
          queueEntryId: supersedeEntry?.queueEntryId,
          targetKind: 'knowledge',
          targetId: 'k-super',
          sourceSurface: 'memory-knowledge',
          reasonCode: 'superseded-knowledge-lineage-check',
          decision: 'supersede',
          evidenceRefs: ['knowledge:k-new'],
          decidedAt: '2026-03-24T01:00:00.000Z'
        },
        {
          receiptId: 'r-revise-1',
          queueEntryId: reviseEntry?.queueEntryId,
          targetKind: 'doc',
          path: 'docs/postmortems/revise-me.md',
          sourceSurface: 'memory-candidates',
          reasonCode: 'postmortem-candidate-context',
          decision: 'revise',
          evidenceRefs: ['candidate:cand-revise'],
          decidedAt: '2026-03-24T01:00:00.000Z',
          followUpArtifactPath: '.playbook/follow-up/revise-me.json'
        }
      ]
    });

    const beforeFollowUp = buildReviewQueue(repoRoot, {
      generatedAt: '2026-03-25T00:00:00.000Z',
      staleKnowledgeDays: 30,
      docReviewWindowDays: 30
    });
    expect(beforeFollowUp.entries.some((entry) => entry.targetId === 'k-super')).toBe(false);
    expect(beforeFollowUp.entries.some((entry) => entry.path === 'docs/postmortems/revise-me.md')).toBe(true);

    writeJson(repoRoot, '.playbook/follow-up/revise-me.json', { ok: true });
    const afterFollowUp = buildReviewQueue(repoRoot, {
      generatedAt: '2026-03-25T00:00:00.000Z',
      staleKnowledgeDays: 30,
      docReviewWindowDays: 30
    });
    expect(afterFollowUp.entries.some((entry) => entry.path === 'docs/postmortems/revise-me.md')).toBe(false);
  });

  it('dedupes equivalent entries while merging evidence refs deterministically', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/memory/candidates.json', {
      schemaVersion: '1.0',
      kind: 'playbook-memory-replay',
      generatedAt: '2026-03-24T00:00:00.000Z',
      candidates: [
        {
          candidateId: 'cand-a',
          kind: 'pattern',
          module: 'docs',
          ruleId: 'docs.rule',
          failureShape: 'none',
          title: 'Candidate A',
          summary: 'Candidate summary A',
          fingerprint: 'candidate-fp-a',
          provenance: [
            { eventId: 'event-a', sourcePath: 'docs/postmortems/incident.md', fingerprint: 'prov-a' },
            { eventId: 'event-b', sourcePath: 'docs/postmortems/incident.md', fingerprint: 'prov-b' }
          ]
        }
      ]
    });

    const queue = buildReviewQueue(repoRoot, {
      generatedAt: '2026-03-24T00:00:00.000Z',
      docReviewWindowDays: 30
    });

    const postmortemEntries = queue.entries.filter((entry) => entry.path === 'docs/postmortems/incident.md' && entry.reasonCode === 'postmortem-candidate-context');
    expect(postmortemEntries).toHaveLength(1);
    expect(postmortemEntries[0]?.evidenceRefs).toEqual(['.playbook/memory/candidates.json', 'candidate:cand-a']);
  });
});
