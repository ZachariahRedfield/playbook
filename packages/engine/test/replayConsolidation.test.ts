import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayMemoryToCandidates } from '../src/memory/replay.js';
import { consolidateReplayCandidates } from '../src/consolidation/candidates.js';

const writeJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const setupRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-replay-consolidation-'));

  writeJson(path.join(root, '.playbook/memory/index.json'), {
    schemaVersion: '1.0',
    kind: 'playbook-temporal-memory-index',
    generatedAt: '2026-03-22T00:00:00.000Z',
    events: [
      {
        eventId: 'evt-1',
        relativePath: '.playbook/memory/events/evt-1.json',
        scope: { modules: ['engine'], ruleIds: ['PB-1'] },
        fingerprint: 'fp-1',
        createdAt: '2026-03-21T00:00:00.000Z',
        memoryKind: 'verify_run'
      },
      {
        eventId: 'evt-2',
        relativePath: '.playbook/memory/events/evt-2.json',
        scope: { modules: ['engine'], ruleIds: ['PB-1'] },
        fingerprint: 'fp-1',
        createdAt: '2026-03-22T00:00:00.000Z',
        memoryKind: 'apply_run'
      }
    ],
    byModule: { engine: ['.playbook/memory/events/evt-1.json', '.playbook/memory/events/evt-2.json'] },
    byRule: { 'PB-1': ['.playbook/memory/events/evt-1.json', '.playbook/memory/events/evt-2.json'] },
    byFingerprint: { 'fp-1': ['.playbook/memory/events/evt-1.json', '.playbook/memory/events/evt-2.json'] }
  });

  writeJson(path.join(root, '.playbook/memory/events/evt-1.json'), {
    schemaVersion: '1.0',
    kind: 'verify_run',
    eventId: 'evt-1',
    eventInstanceId: 'evt-1',
    eventFingerprint: 'fp-1',
    createdAt: '2026-03-21T00:00:00.000Z',
    repoRevision: 'abc123',
    scope: { modules: ['engine'], ruleIds: ['PB-1'] },
    sources: [{ type: 'artifact', reference: '.playbook/verify.json' }],
    riskSummary: { level: 'high', signals: ['drift'] },
    outcome: { status: 'failure', summary: 'verify found drift' },
    salienceInputs: { recurrenceCount: 2, blastRadius: 4, crossModuleSpread: 1 }
  });

  writeJson(path.join(root, '.playbook/memory/events/evt-2.json'), {
    schemaVersion: '1.0',
    kind: 'apply_run',
    eventId: 'evt-2',
    eventInstanceId: 'evt-2',
    eventFingerprint: 'fp-1',
    createdAt: '2026-03-22T00:00:00.000Z',
    repoRevision: 'abc123',
    scope: { modules: ['engine'], ruleIds: ['PB-1'] },
    sources: [{ type: 'artifact', reference: '.playbook/apply.json' }],
    riskSummary: { level: 'medium', signals: ['remediation'] },
    outcome: { status: 'success', summary: 'apply corrected drift' },
    salienceInputs: { recurrenceCount: 2, blastRadius: 4, crossModuleSpread: 1, novelSuccessfulRemediation: true }
  });

  writeJson(path.join(root, '.playbook/memory/knowledge/patterns.json'), {
    schemaVersion: '1.0',
    artifact: 'memory-knowledge',
    kind: 'pattern',
    generatedAt: '2026-03-22T00:00:00.000Z',
    entries: [
      {
        knowledgeId: 'knowledge-pattern-1',
        candidateId: 'older-candidate',
        sourceCandidateIds: ['older-candidate'],
        sourceEventFingerprints: ['fp-1'],
        kind: 'pattern',
        title: 'Existing pattern',
        summary: 'Already promoted',
        fingerprint: 'fp-1',
        module: 'engine',
        ruleId: 'PB-1',
        failureShape: 'fp-1',
        promotedAt: '2026-03-20T00:00:00.000Z',
        provenance: [{ eventId: 'evt-0', sourcePath: '.playbook/memory/events/evt-0.json', fingerprint: 'fp-1', runId: 'run-0' }],
        status: 'active',
        supersedes: [],
        supersededBy: []
      }
    ]
  });

  return root;
};

describe('replay and consolidation substrate', () => {
  it('produces the same replay candidates for the same memory evidence', () => {
    const root = setupRepo();

    const first = replayMemoryToCandidates(root);
    const second = replayMemoryToCandidates(root);

    expect(second).toEqual(first);
    expect(fs.readFileSync(path.join(root, '.playbook/memory/replay-candidates.json'), 'utf8')).toBe(
      fs.readFileSync(path.join(root, '.playbook/memory/candidates.json'), 'utf8')
    );
  });

  it('preserves provenance from replay into consolidation end-to-end', () => {
    const root = setupRepo();
    replayMemoryToCandidates(root);

    const consolidation = consolidateReplayCandidates(root);
    expect(consolidation.candidates).toHaveLength(1);
    expect(consolidation.candidates[0]).toMatchObject({
      sourceReplayCandidateIds: [expect.any(String)],
      provenance: {
        replayCandidates: [{ candidateId: expect.any(String), fingerprint: 'fp-1', clusterKey: 'fp-1' }],
        events: [
          { eventId: 'evt-1', sourcePath: '.playbook/memory/events/evt-1.json', fingerprint: 'fp-1', runId: null },
          { eventId: 'evt-2', sourcePath: '.playbook/memory/events/evt-2.json', fingerprint: 'fp-1', runId: null }
        ]
      },
      salience: {
        score: expect.any(Number),
        factors: expect.objectContaining({ novelSuccessfulRemediationSignal: 1 }),
        eventCount: 2
      }
    });
  });

  it('keeps promotion explicit and never auto-promotes during consolidation', () => {
    const root = setupRepo();
    const beforeKnowledge = fs.readFileSync(path.join(root, '.playbook/memory/knowledge/patterns.json'), 'utf8');
    replayMemoryToCandidates(root);

    const consolidation = consolidateReplayCandidates(root);

    expect(consolidation.candidates[0]?.reviewStatus).toBe('already_promoted_match');
    expect(consolidation.candidates[0]?.promotion.reviewRequired).toBe(true);
    expect(consolidation.candidates[0]?.promotion.matchedKnowledgeIds).toEqual(['knowledge-pattern-1']);
    expect(fs.readFileSync(path.join(root, '.playbook/memory/knowledge/patterns.json'), 'utf8')).toBe(beforeKnowledge);
    expect(fs.existsSync(path.join(root, '.playbook/memory/knowledge/decisions.json'))).toBe(false);
  });
});
