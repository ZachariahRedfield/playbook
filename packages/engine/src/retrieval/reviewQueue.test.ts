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
});
