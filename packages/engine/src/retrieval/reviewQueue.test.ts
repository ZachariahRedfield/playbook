import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReviewQueue, writeKnowledgeReviewReceipt } from './reviewQueue.js';

const touchedDirs: string[] = [];

const createTempRepo = (): string => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-review-queue-'));
  touchedDirs.push(repoRoot);
  return repoRoot;
};

const writeJson = (repoRoot: string, relativePath: string, payload: unknown): void => {
  const filePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}
`, 'utf8');
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

const seedStaleKnowledge = (repoRoot: string): void => {
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
};

describe('buildReviewQueue', () => {
  it('is deterministic for same inputs and generatedAt', () => {
    const repoRoot = createTempRepo();
    seedStaleKnowledge(repoRoot);

    const generatedAt = '2026-03-24T00:00:00.000Z';
    const left = buildReviewQueue(repoRoot, { generatedAt });
    const right = buildReviewQueue(repoRoot, { generatedAt });

    expect(left).toEqual(right);
    expect(left.entries.length).toBe(1);
    expect(left.entries[0]?.targetId).toBe('k-1');
    expect(left.entries[0]?.queueEntryId.startsWith('rq_')).toBe(true);
  });

  it('suppresses reaffirmed entries until the next deterministic review window', () => {
    const repoRoot = createTempRepo();
    seedStaleKnowledge(repoRoot);

    const initial = buildReviewQueue(repoRoot, { generatedAt: '2026-03-24T00:00:00.000Z', staleKnowledgeDays: 60 });
    const queueEntry = initial.entries[0];
    expect(queueEntry).toBeDefined();

    writeKnowledgeReviewReceipt(repoRoot, {
      queueEntryId: queueEntry!.queueEntryId,
      targetKind: queueEntry!.targetKind,
      targetId: queueEntry!.targetId,
      sourceSurface: queueEntry!.sourceSurface,
      reasonCode: queueEntry!.reasonCode,
      decision: 'reaffirm',
      decidedAt: '2026-03-24T00:00:00.000Z',
      evidenceRefs: queueEntry!.evidenceRefs
    });

    const suppressed = buildReviewQueue(repoRoot, { generatedAt: '2026-04-20T00:00:00.000Z', staleKnowledgeDays: 60 });
    expect(suppressed.entries).toHaveLength(0);

    const resurfaced = buildReviewQueue(repoRoot, { generatedAt: '2026-06-01T00:00:00.000Z', staleKnowledgeDays: 60 });
    expect(resurfaced.entries).toHaveLength(1);
  });

  it('keeps deferred entries recallable and future-dated with lower priority', () => {
    const repoRoot = createTempRepo();
    const oldDate = new Date('2025-01-01T00:00:00.000Z');
    writeText(repoRoot, 'docs/PLAYBOOK_PRODUCT_ROADMAP.md', '# roadmap
', oldDate);

    const initial = buildReviewQueue(repoRoot, { generatedAt: '2026-03-24T00:00:00.000Z', docReviewWindowDays: 10 });
    const entry = initial.entries.find((item) => item.path === 'docs/PLAYBOOK_PRODUCT_ROADMAP.md');
    expect(entry).toBeDefined();

    writeKnowledgeReviewReceipt(repoRoot, {
      queueEntryId: entry!.queueEntryId,
      targetKind: 'doc',
      path: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
      sourceSurface: entry!.sourceSurface,
      reasonCode: entry!.reasonCode,
      decision: 'defer',
      decidedAt: '2026-03-24T00:00:00.000Z',
      availableAt: '2026-05-01T00:00:00.000Z',
      evidenceRefs: entry!.evidenceRefs
    });

    const deferred = buildReviewQueue(repoRoot, { generatedAt: '2026-03-25T00:00:00.000Z', docReviewWindowDays: 10 });
    const deferredEntry = deferred.entries.find((item) => item.path === 'docs/PLAYBOOK_PRODUCT_ROADMAP.md');
    expect(deferredEntry?.reviewPriority).toBe('low');
    expect(deferredEntry?.availableAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('stops surfacing targets whose latest receipt decision is supersede', () => {
    const repoRoot = createTempRepo();
    seedStaleKnowledge(repoRoot);

    const initial = buildReviewQueue(repoRoot, { generatedAt: '2026-03-24T00:00:00.000Z' });
    const entry = initial.entries[0];

    writeKnowledgeReviewReceipt(repoRoot, {
      queueEntryId: entry!.queueEntryId,
      targetKind: entry!.targetKind,
      targetId: entry!.targetId,
      sourceSurface: entry!.sourceSurface,
      reasonCode: entry!.reasonCode,
      decision: 'supersede',
      decidedAt: '2026-03-24T01:00:00.000Z',
      evidenceRefs: entry!.evidenceRefs
    });

    const queue = buildReviewQueue(repoRoot, { generatedAt: '2026-03-25T00:00:00.000Z' });
    expect(queue.entries).toHaveLength(0);
  });

  it('keeps revise targets visible until follow-up artifact exists', () => {
    const repoRoot = createTempRepo();
    seedStaleKnowledge(repoRoot);

    const initial = buildReviewQueue(repoRoot, { generatedAt: '2026-03-24T00:00:00.000Z' });
    const entry = initial.entries[0];

    writeKnowledgeReviewReceipt(repoRoot, {
      queueEntryId: entry!.queueEntryId,
      targetKind: entry!.targetKind,
      targetId: entry!.targetId,
      sourceSurface: entry!.sourceSurface,
      reasonCode: entry!.reasonCode,
      decision: 'revise',
      decidedAt: '2026-03-24T01:00:00.000Z',
      followUpArtifactRef: '.playbook/memory/knowledge-followups/k-1.json',
      evidenceRefs: entry!.evidenceRefs
    });

    const stillVisible = buildReviewQueue(repoRoot, { generatedAt: '2026-03-25T00:00:00.000Z' });
    expect(stillVisible.entries).toHaveLength(1);

    writeJson(repoRoot, '.playbook/memory/knowledge-followups/k-1.json', { ok: true });
    const suppressedAfterFollowUp = buildReviewQueue(repoRoot, { generatedAt: '2026-03-25T00:00:00.000Z' });
    expect(suppressedAfterFollowUp.entries).toHaveLength(0);
  });

  it('keeps non-governed docs out of the queue while including governed docs and postmortem context', () => {
    const repoRoot = createTempRepo();
    const oldDate = new Date('2025-01-01T00:00:00.000Z');

    writeText(repoRoot, 'docs/PLAYBOOK_PRODUCT_ROADMAP.md', '# roadmap
', oldDate);
    writeText(repoRoot, 'docs/postmortems/incident.md', '# postmortem
', oldDate);
    writeText(repoRoot, 'docs/random-notes.md', '# random
', oldDate);

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
