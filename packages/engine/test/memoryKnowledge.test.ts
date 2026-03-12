import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promoteMemoryCandidate, pruneMemoryKnowledge } from '../src/memory/knowledge.js';

const writeJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const setupRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-knowledge-'));

  writeJson(path.join(root, '.playbook/memory/candidates.json'), {
    schemaVersion: '1.0',
    command: 'memory-replay',
    sourceIndex: '.playbook/memory/index.json',
    generatedAt: '2025-01-01T00:00:00.000Z',
    totalEvents: 2,
    clustersEvaluated: 2,
    candidates: [
      {
        candidateId: 'cand-1',
        kind: 'decision',
        title: 'decision: rule-a',
        summary: 'candidate one',
        clusterKey: 'finger-1|module-a|rule-a|shape-a',
        salienceScore: 1,
        salienceFactors: { severity: 1, recurrenceCount: 1, crossModuleBreadth: 1, riskScore: 1, persistenceAcrossRuns: 1, ownershipDocsGap: 0, novelSuccessfulRemediationShape: 0 },
        fingerprint: 'finger-1',
        module: 'module-a',
        ruleId: 'rule-a',
        failureShape: 'shape-a',
        eventCount: 1,
        provenance: [{ eventId: 'evt-1', sourcePath: '.playbook/memory/events/evt-1.json', fingerprint: 'finger-1', runId: 'run-1' }],
        lastSeenAt: '2099-01-01T00:00:00.000Z'
      },
      {
        candidateId: 'cand-stale',
        kind: 'pattern',
        title: 'pattern: stale',
        summary: 'stale candidate',
        clusterKey: 'finger-stale|module-a|rule-a|shape-a',
        salienceScore: 1,
        salienceFactors: { severity: 1, recurrenceCount: 1, crossModuleBreadth: 1, riskScore: 1, persistenceAcrossRuns: 1, ownershipDocsGap: 0, novelSuccessfulRemediationShape: 0 },
        fingerprint: 'finger-stale',
        module: 'module-a',
        ruleId: 'rule-a',
        failureShape: 'shape-a',
        eventCount: 1,
        provenance: [{ eventId: 'evt-2', sourcePath: '.playbook/memory/events/evt-2.json', fingerprint: 'finger-stale', runId: 'run-1' }],
        lastSeenAt: '2020-01-01T00:00:00.000Z'
      },
      {
        candidateId: 'cand-dup',
        kind: 'pattern',
        title: 'pattern: duplicate',
        summary: 'duplicate fingerprint candidate',
        clusterKey: 'finger-1|module-b|rule-b|shape-b',
        salienceScore: 1,
        salienceFactors: { severity: 1, recurrenceCount: 1, crossModuleBreadth: 1, riskScore: 1, persistenceAcrossRuns: 1, ownershipDocsGap: 0, novelSuccessfulRemediationShape: 0 },
        fingerprint: 'finger-1',
        module: 'module-b',
        ruleId: 'rule-b',
        failureShape: 'shape-b',
        eventCount: 1,
        provenance: [{ eventId: 'evt-3', sourcePath: '.playbook/memory/events/evt-3.json', fingerprint: 'finger-1', runId: 'run-2' }],
        lastSeenAt: '2099-01-02T00:00:00.000Z'
      }
    ]
  });

  writeJson(path.join(root, '.playbook/memory/knowledge/decisions.json'), {
    schemaVersion: '1.0',
    artifact: 'memory-knowledge',
    kind: 'decision',
    generatedAt: '2025-01-01T00:00:00.000Z',
    entries: [
      {
        knowledgeId: 'decision-old',
        candidateId: 'old-candidate',
        kind: 'decision',
        title: 'old decision',
        summary: 'old summary',
        fingerprint: 'finger-1',
        module: 'module-a',
        ruleId: 'rule-a',
        failureShape: 'shape-a',
        promotedAt: '2024-01-01T00:00:00.000Z',
        provenance: [],
        status: 'active',
        supersedes: [],
        supersededBy: []
      }
    ]
  });

  return root;
};

describe('memory knowledge promotion and pruning', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('promotes candidate and links supersession provenance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-02T00:00:00.000Z'));
    const root = setupRepo();

    const result = promoteMemoryCandidate(root, 'cand-1');

    expect(result.command).toBe('memory-promote');
    expect(result.supersededIds).toEqual(['decision-old']);

    const artifact = JSON.parse(
      fs.readFileSync(path.join(root, '.playbook/memory/knowledge/decisions.json'), 'utf8')
    ) as { entries: Array<{ knowledgeId: string; status: string; supersededBy: string[]; supersedes: string[]; candidateId: string }> };

    const promoted = artifact.entries.find((entry) => entry.candidateId === 'cand-1');
    expect(promoted?.supersedes).toEqual(['decision-old']);

    const old = artifact.entries.find((entry) => entry.knowledgeId === 'decision-old');
    expect(old?.status).toBe('superseded');
    expect(old?.supersededBy).toEqual([promoted?.knowledgeId]);
  });

  it('prunes stale candidates, collapses duplicates, and removes superseded knowledge', () => {
    const root = setupRepo();

    writeJson(path.join(root, '.playbook/memory/knowledge/patterns.json'), {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'pattern',
      generatedAt: '2025-01-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'pattern-active-new',
          candidateId: 'cand-x',
          kind: 'pattern',
          title: 'new pattern',
          summary: 'new',
          fingerprint: 'same-fingerprint',
          module: 'module-a',
          ruleId: 'rule-a',
          failureShape: 'shape-a',
          promotedAt: '2025-01-02T00:00:00.000Z',
          provenance: [],
          status: 'active',
          supersedes: [],
          supersededBy: []
        },
        {
          knowledgeId: 'pattern-active-old',
          candidateId: 'cand-y',
          kind: 'pattern',
          title: 'old pattern',
          summary: 'old',
          fingerprint: 'same-fingerprint',
          module: 'module-a',
          ruleId: 'rule-a',
          failureShape: 'shape-a',
          promotedAt: '2025-01-01T00:00:00.000Z',
          provenance: [],
          status: 'active',
          supersedes: [],
          supersededBy: []
        },
        {
          knowledgeId: 'pattern-superseded',
          candidateId: 'cand-z',
          kind: 'pattern',
          title: 'superseded pattern',
          summary: 'superseded',
          fingerprint: 'old-fingerprint',
          module: 'module-a',
          ruleId: 'rule-a',
          failureShape: 'shape-a',
          promotedAt: '2024-01-01T00:00:00.000Z',
          provenance: [],
          status: 'superseded',
          supersedes: [],
          supersededBy: ['pattern-active-new']
        }
      ]
    });

    const result = pruneMemoryKnowledge(root);

    expect(result.staleCandidatesPruned).toBe(1);
    expect(result.duplicateCandidatesCollapsed).toBe(1);
    expect(result.supersededKnowledgePruned).toBe(1);
    expect(result.duplicateKnowledgeCollapsed).toBe(1);

    const candidates = JSON.parse(
      fs.readFileSync(path.join(root, '.playbook/memory/candidates.json'), 'utf8')
    ) as { candidates: Array<{ candidateId: string }> };
    expect(candidates.candidates.map((entry) => entry.candidateId)).toEqual(['cand-1']);

    const patterns = JSON.parse(
      fs.readFileSync(path.join(root, '.playbook/memory/knowledge/patterns.json'), 'utf8')
    ) as { entries: Array<{ knowledgeId: string }> };
    expect(patterns.entries.map((entry) => entry.knowledgeId)).toEqual(['pattern-active-new']);
  });
});
