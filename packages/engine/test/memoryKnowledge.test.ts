import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listCandidateKnowledge,
  loadCandidateKnowledgeById,
  promoteMemoryCandidate,
  pruneMemoryKnowledge,
  retirePromotedKnowledge,
  supersedePromotedKnowledge
} from '../src/memory/knowledge.js';

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
        salienceFactors: { severity: 1, recurrenceCount: 1, blastRadius: 1, crossModuleSpread: 1, ownershipDocsGap: 0, novelSuccessfulRemediationSignal: 0 },
        fingerprint: 'finger-1',
        module: 'module-a',
        ruleId: 'rule-a',
        failureShape: 'shape-a',
        eventCount: 1,
        provenance: [{ eventId: 'evt-1', sourcePath: '.playbook/memory/events/evt-1.json', fingerprint: 'finger-1', runId: 'run-1' }],
        lastSeenAt: '2099-01-01T00:00:00.000Z',
        supersession: { evolutionOrdinal: 1, priorCandidateIds: [], supersedesCandidateIds: [] }
      },
      {
        candidateId: 'cand-stale',
        kind: 'pattern',
        title: 'pattern: stale',
        summary: 'stale candidate',
        clusterKey: 'finger-stale|module-a|rule-a|shape-a',
        salienceScore: 1,
        salienceFactors: { severity: 1, recurrenceCount: 1, blastRadius: 1, crossModuleSpread: 1, ownershipDocsGap: 0, novelSuccessfulRemediationSignal: 0 },
        fingerprint: 'finger-stale',
        module: 'module-a',
        ruleId: 'rule-a',
        failureShape: 'shape-a',
        eventCount: 1,
        provenance: [{ eventId: 'evt-2', sourcePath: '.playbook/memory/events/evt-2.json', fingerprint: 'finger-stale', runId: 'run-1' }],
        lastSeenAt: '2020-01-01T00:00:00.000Z',
        supersession: { evolutionOrdinal: 1, priorCandidateIds: [], supersedesCandidateIds: [] }
      },
      {
        candidateId: 'cand-dup',
        kind: 'pattern',
        title: 'pattern: duplicate',
        summary: 'duplicate fingerprint candidate',
        clusterKey: 'finger-1|module-b|rule-b|shape-b',
        salienceScore: 1,
        salienceFactors: { severity: 1, recurrenceCount: 1, blastRadius: 1, crossModuleSpread: 1, ownershipDocsGap: 0, novelSuccessfulRemediationSignal: 0 },
        fingerprint: 'finger-1',
        module: 'module-b',
        ruleId: 'rule-b',
        failureShape: 'shape-b',
        eventCount: 1,
        provenance: [{ eventId: 'evt-3', sourcePath: '.playbook/memory/events/evt-3.json', fingerprint: 'finger-1', runId: 'run-2' }],
        lastSeenAt: '2099-01-02T00:00:00.000Z',
        supersession: { evolutionOrdinal: 1, priorCandidateIds: [], supersedesCandidateIds: [] }
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
        provenance: [{ eventId: 'evt-old', sourcePath: '.playbook/memory/events/evt-old.json', fingerprint: 'finger-1', runId: 'old-run' }],
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

  it('lists and loads replay candidates by id', () => {
    const root = setupRepo();
    const candidates = listCandidateKnowledge(root);

    expect(candidates.map((candidate) => candidate.candidateId)).toEqual(['cand-1', 'cand-dup', 'cand-stale']);
    expect(loadCandidateKnowledgeById(root, 'cand-1').candidateId).toBe('cand-1');
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
    ) as { entries: Array<{ knowledgeId: string; status: string; supersededBy: string[]; supersedes: string[]; candidateId: string; sourceCandidateIds: string[]; sourceEventFingerprints: string[] }> };

    const promoted = artifact.entries.find((entry) => entry.candidateId === 'cand-1');
    expect(promoted?.supersedes).toEqual(['decision-old']);
    expect(promoted?.sourceCandidateIds).toEqual(['cand-1']);
    expect(promoted?.sourceEventFingerprints).toEqual(['finger-1']);

    const old = artifact.entries.find((entry) => entry.knowledgeId === 'decision-old');
    expect(old?.status).toBe('superseded');
    expect(old?.supersededBy).toEqual([promoted?.knowledgeId]);
  });

  it('rejects promoting malformed candidates', () => {
    const root = setupRepo();
    writeJson(path.join(root, '.playbook/memory/candidates.json'), {
      schemaVersion: '1.0',
      command: 'memory-replay',
      sourceIndex: '.playbook/memory/index.json',
      generatedAt: '2025-01-01T00:00:00.000Z',
      totalEvents: 1,
      clustersEvaluated: 1,
      candidates: [{
        candidateId: 'bad-cand',
        kind: 'decision',
        title: '',
        summary: 'invalid',
        clusterKey: 'k',
        salienceScore: 1,
        salienceFactors: { severity: 1, recurrenceCount: 1, blastRadius: 1, crossModuleSpread: 1, ownershipDocsGap: 0, novelSuccessfulRemediationSignal: 0 },
        fingerprint: 'f',
        module: 'm',
        ruleId: 'r',
        failureShape: 's',
        eventCount: 1,
        provenance: [],
        supersession: { evolutionOrdinal: 1, priorCandidateIds: [], supersedesCandidateIds: [] }
      }]
    });

    expect(() => promoteMemoryCandidate(root, 'bad-cand')).toThrow('invalid candidate');
  });

  it('retires promoted knowledge and blocks duplicate retirement without explicit handling', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'));
    const root = setupRepo();
    const promoted = promoteMemoryCandidate(root, 'cand-1');

    const retired = retirePromotedKnowledge(root, promoted.promoted.knowledgeId, { reason: 'no longer relevant' });
    expect(retired.command).toBe('memory-retire');
    expect(retired.retired.status).toBe('retired');
    expect(retired.retired.retirementReason).toBe('no longer relevant');

    expect(() =>
      retirePromotedKnowledge(root, promoted.promoted.knowledgeId, { reason: 'again' })
    ).toThrow('already retired');

    expect(
      retirePromotedKnowledge(root, promoted.promoted.knowledgeId, { reason: 'override', allowAlreadyRetired: true }).retired.retirementReason
    ).toBe('override');
  });

  it('supersedes knowledge while retaining provenance and rejects incompatible kinds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2028-01-01T00:00:00.000Z'));
    const root = setupRepo();
    const promoted = promoteMemoryCandidate(root, 'cand-1').promoted;

    writeJson(path.join(root, '.playbook/memory/knowledge/decisions.json'), {
      ...JSON.parse(fs.readFileSync(path.join(root, '.playbook/memory/knowledge/decisions.json'), 'utf8')),
      entries: [
        ...JSON.parse(fs.readFileSync(path.join(root, '.playbook/memory/knowledge/decisions.json'), 'utf8')).entries,
        {
          knowledgeId: 'decision-new',
          candidateId: 'cand-2',
          sourceCandidateIds: ['cand-2'],
          sourceEventFingerprints: ['finger-2'],
          kind: 'decision',
          title: 'new decision',
          summary: 'new summary',
          fingerprint: 'finger-2',
          module: 'module-a',
          ruleId: 'rule-a',
          failureShape: 'shape-a',
          promotedAt: '2028-01-01T00:00:00.000Z',
          provenance: [{ eventId: 'evt-2', sourcePath: '.playbook/memory/events/evt-2.json', fingerprint: 'finger-2', runId: 'run-2' }],
          status: 'active',
          supersedes: [],
          supersededBy: []
        }
      ]
    });

    const supersede = supersedePromotedKnowledge(root, promoted.knowledgeId, 'decision-new');
    expect(supersede.superseded.status).toBe('superseded');
    expect(supersede.successor.supersedes).toContain(promoted.knowledgeId);
    expect(supersede.successor.sourceEventFingerprints).toEqual(['finger-1', 'finger-2']);

    writeJson(path.join(root, '.playbook/memory/knowledge/patterns.json'), {
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'pattern',
      generatedAt: '2028-01-01T00:00:00.000Z',
      entries: [{
        knowledgeId: 'pattern-1',
        candidateId: 'cand-p',
        sourceCandidateIds: ['cand-p'],
        sourceEventFingerprints: ['fp'],
        kind: 'pattern',
        title: 'p',
        summary: 'p',
        fingerprint: 'fp',
        module: 'm',
        ruleId: 'r',
        failureShape: 's',
        promotedAt: '2028-01-01T00:00:00.000Z',
        provenance: [{ eventId: 'evt-p', sourcePath: '.playbook/memory/events/evt-p.json', fingerprint: 'fp', runId: 'run-p' }],
        status: 'active',
        supersedes: [],
        supersededBy: []
      }]
    });

    expect(() => supersedePromotedKnowledge(root, 'pattern-1', 'decision-new')).toThrow('incompatible knowledge kinds');
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
          sourceCandidateIds: ['cand-x'],
          sourceEventFingerprints: ['same-fingerprint'],
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
          sourceCandidateIds: ['cand-y'],
          sourceEventFingerprints: ['same-fingerprint'],
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
          sourceCandidateIds: ['cand-z'],
          sourceEventFingerprints: ['old-fingerprint'],
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
