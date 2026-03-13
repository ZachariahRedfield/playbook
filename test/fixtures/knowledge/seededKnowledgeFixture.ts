import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type FixtureOptions = {
  prefix?: string;
};

const writeJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const createFixtureRepo = (prefix: string): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  writeJson(path.join(root, 'package.json'), { name: 'playbook-contract-fixture' });
  return root;
};

export const createSeededKnowledgeFixtureRepo = (options: FixtureOptions = {}): string => {
  const root = createFixtureRepo(options.prefix ?? 'playbook-knowledge-fixture-');

  writeJson(path.join(root, '.playbook/memory/events/event-1.json'), {
    schemaVersion: '1.0',
    kind: 'verify_run',
    eventInstanceId: 'event-1',
    eventFingerprint: 'fp-1',
    createdAt: '2026-02-01T00:00:00.000Z',
    repoRevision: 'r1',
    sources: [{ type: 'verify', reference: 'verify-1' }],
    subjectModules: ['module-a'],
    ruleIds: ['RULE-1'],
    riskSummary: { level: 'low', signals: [] },
    outcome: { status: 'success', summary: 'ok' },
    salienceInputs: {}
  });
  writeJson(path.join(root, '.playbook/memory/events/event-2.json'), {
    schemaVersion: '1.0',
    kind: 'plan_run',
    eventInstanceId: 'event-2',
    eventFingerprint: 'fp-2',
    createdAt: '2026-02-02T00:00:00.000Z',
    repoRevision: 'r2',
    sources: [{ type: 'plan', reference: 'plan-1' }],
    subjectModules: ['module-b'],
    ruleIds: ['RULE-2'],
    riskSummary: { level: 'medium', signals: [] },
    outcome: { status: 'success', summary: 'ok' },
    salienceInputs: {}
  });
  writeJson(path.join(root, '.playbook/memory/candidates.json'), {
    schemaVersion: '1.0',
    command: 'memory-replay',
    generatedAt: '2026-02-03T00:00:00.000Z',
    candidates: [
      {
        candidateId: 'cand-live',
        kind: 'pattern',
        title: 'Live candidate',
        summary: 'Needs review',
        clusterKey: 'cluster-live',
        salienceScore: 8,
        salienceFactors: { severity: 1 },
        fingerprint: 'fp-1',
        module: 'module-a',
        ruleId: 'RULE-1',
        failureShape: 'shape-a',
        eventCount: 1,
        provenance: [
          { eventId: 'event-1', sourcePath: '.playbook/memory/events/event-1.json', fingerprint: 'fp-1', runId: 'run-1' }
        ],
        lastSeenAt: '2026-02-03T00:00:00.000Z',
        supersession: { evolutionOrdinal: 1, priorCandidateIds: [], supersedesCandidateIds: [] }
      },
      {
        candidateId: 'cand-stale',
        kind: 'decision',
        title: 'Stale candidate',
        summary: 'Old evidence',
        clusterKey: 'cluster-stale',
        salienceScore: 3,
        salienceFactors: { severity: 1 },
        fingerprint: 'fp-2',
        module: 'module-b',
        ruleId: 'RULE-2',
        failureShape: 'shape-b',
        eventCount: 1,
        provenance: [
          { eventId: 'event-2', sourcePath: '.playbook/memory/events/event-2.json', fingerprint: 'fp-2', runId: 'run-2' }
        ],
        lastSeenAt: '2025-01-01T00:00:00.000Z',
        supersession: { evolutionOrdinal: 1, priorCandidateIds: [], supersedesCandidateIds: [] }
      }
    ]
  });
  writeJson(path.join(root, '.playbook/memory/knowledge/patterns.json'), {
    schemaVersion: '1.0',
    artifact: 'memory-knowledge',
    kind: 'pattern',
    generatedAt: '2026-02-04T00:00:00.000Z',
    entries: [
      {
        knowledgeId: 'pattern-live',
        candidateId: 'cand-live',
        sourceCandidateIds: ['cand-live'],
        sourceEventFingerprints: ['fp-1'],
        kind: 'pattern',
        title: 'Promoted pattern',
        summary: 'Reusable guidance',
        fingerprint: 'fp-1',
        module: 'module-a',
        ruleId: 'RULE-1',
        failureShape: 'shape-a',
        promotedAt: '2026-02-04T00:00:00.000Z',
        provenance: [
          { eventId: 'event-1', sourcePath: '.playbook/memory/events/event-1.json', fingerprint: 'fp-1', runId: 'run-1' }
        ],
        status: 'active',
        supersedes: [],
        supersededBy: []
      },
      {
        knowledgeId: 'pattern-old',
        candidateId: 'cand-stale',
        sourceCandidateIds: ['cand-stale'],
        sourceEventFingerprints: ['fp-2'],
        kind: 'pattern',
        title: 'Superseded pattern',
        summary: 'Old guidance',
        fingerprint: 'fp-2',
        module: 'module-b',
        ruleId: 'RULE-2',
        failureShape: 'shape-b',
        promotedAt: '2025-01-01T00:00:00.000Z',
        provenance: [
          { eventId: 'event-2', sourcePath: '.playbook/memory/events/event-2.json', fingerprint: 'fp-2', runId: 'run-2' }
        ],
        status: 'superseded',
        supersedes: [],
        supersededBy: ['pattern-live']
      }
    ]
  });

  return root;
};

export const createEmptyKnowledgeFixtureRepo = (options: FixtureOptions = {}): string =>
  createFixtureRepo(options.prefix ?? 'playbook-knowledge-empty-');
