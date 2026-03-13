import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandRuntimeTaskMemoryProvenance, readRuntimeMemoryEnvelope } from '../src/intelligence/runtimeMemory.js';

const writeJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const setupRuntimeMemoryBridgeRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-runtime-memory-bridge-'));

  writeJson(path.join(root, '.playbook/runs/run-1.json'), {
    id: 'run-1',
    version: 1,
    intent: { id: 'intent-1', goal: 'goal', scope: [], constraints: [], requested_by: 'user' },
    steps: [
      {
        id: 'step-1',
        kind: 'apply',
        status: 'passed',
        inputs: {
          taskId: 'task-1',
          dryRun: true,
          planTaskId: 'plan-task-1',
          policyDecision: { policyState: 'allow' },
          task: { advisory: { outcomeLearning: { influencedByKnowledgeIds: ['cand-1'] } } }
        },
        outputs: {
          dryRun: true,
          runtimeTaskId: 'runtime-task-1',
          knowledgeIds: ['knowledge-1']
        },
        evidence: [{ id: 'ev-1', kind: 'artifact', ref: '.playbook/plan.json' }]
      }
    ],
    checkpoints: [],
    created_at: '2026-02-01T00:00:00.000Z',
    frozen: false
  });

  writeJson(path.join(root, '.playbook/memory/events/event-1.json'), {
    schemaVersion: '1.0',
    kind: 'apply_run',
    eventInstanceId: 'event-1',
    eventFingerprint: 'fp-1',
    createdAt: '2026-02-01T00:01:00.000Z',
    repoRevision: 'abc123',
    sources: [],
    subjectModules: ['engine'],
    ruleIds: ['PB001'],
    riskSummary: { level: 'low', signals: [] },
    outcome: { status: 'success', summary: 'apply succeeded' },
    salienceInputs: {},
    evidence: [
      {
        kind: 'session-evidence-reference',
        schemaVersion: '1.0.0',
        sessionId: 'repo-local',
        stepId: 'apply-summary',
        artifactPath: '.playbook/plan.json',
        capturedAt: 1
      }
    ]
  });

  writeJson(path.join(root, '.playbook/memory/candidates.json'), {
    schemaVersion: '1.0',
    command: 'memory-replay',
    sourceIndex: '.playbook/memory/index.json',
    generatedAt: '2026-02-02T00:00:00.000Z',
    totalEvents: 1,
    clustersEvaluated: 1,
    candidates: [
      {
        candidateId: 'cand-1',
        kind: 'pattern',
        title: 'candidate',
        summary: 'candidate summary',
        clusterKey: 'k1',
        salienceScore: 0.5,
        salienceFactors: {
          severity: 1,
          recurrenceCount: 1,
          blastRadius: 1,
          crossModuleSpread: 1,
          ownershipDocsGap: 0,
          novelSuccessfulRemediationSignal: 0
        },
        fingerprint: 'fp-1',
        module: 'engine',
        ruleId: 'PB001',
        failureShape: 'shape',
        eventCount: 1,
        provenance: [
          { eventId: 'event-1', sourcePath: 'events/event-1.json', fingerprint: 'fp-1', runId: 'run-1' }
        ],
        lastSeenAt: '2026-02-02T00:00:00.000Z',
        supersession: { evolutionOrdinal: 1, priorCandidateIds: [], supersedesCandidateIds: [] }
      }
    ]
  });

  writeJson(path.join(root, '.playbook/memory/knowledge/patterns.json'), {
    schemaVersion: '1.0',
    artifact: 'memory-knowledge',
    kind: 'pattern',
    generatedAt: '2026-02-02T00:00:00.000Z',
    entries: [
      {
        knowledgeId: 'knowledge-1',
        candidateId: 'cand-1',
        sourceCandidateIds: ['cand-1'],
        sourceEventFingerprints: ['fp-1'],
        kind: 'pattern',
        title: 'promoted',
        summary: 'promoted summary',
        fingerprint: 'fp-1',
        module: 'engine',
        ruleId: 'PB001',
        failureShape: 'shape',
        promotedAt: '2026-02-03T00:00:00.000Z',
        provenance: [{ eventId: 'event-1', sourcePath: 'events/event-1.json', fingerprint: 'fp-1', runId: 'run-1' }],
        status: 'active',
        supersedes: [],
        supersededBy: []
      }
    ]
  });

  return root;
};

describe('runtime memory bridge', () => {
  it('links runtime run/task records to memory provenance and knowledge references', () => {
    const root = setupRuntimeMemoryBridgeRepo();

    const envelope = readRuntimeMemoryEnvelope(root, { limit: 5 });

    expect(envelope.memorySources.some((source) => source.kind === 'runtime-runs' && source.records === 1)).toBe(true);
    expect(envelope.runtimeTaskProvenance).toEqual([
      expect.objectContaining({
        runId: 'run-1',
        taskId: 'task-1',
        memoryEventId: 'event-1',
        memoryFingerprint: 'fp-1',
        knowledgeIds: ['cand-1', 'knowledge-1'],
        eventKind: 'apply_run'
      })
    ]);
    expect(envelope.dryRunEvidence).toEqual([
      expect.objectContaining({
        runId: 'run-1',
        stepId: 'step-1',
        taskId: 'task-1',
        sourcePlanTaskId: 'plan-task-1',
        runtimeTaskId: 'runtime-task-1',
        policyDecision: 'allow',
        knowledgeIds: ['cand-1', 'knowledge-1'],
        evidenceRefs: ['.playbook/plan.json']
      })
    ]);
  });

  it('expands task provenance through memory helpers', () => {
    const root = setupRuntimeMemoryBridgeRepo();

    const expanded = expandRuntimeTaskMemoryProvenance(root, [
      {
        runId: 'run-1',
        taskId: 'task-1',
        stepId: 'step-1',
        status: 'passed',
        memoryEventId: 'event-1',
        memoryFingerprint: 'fp-1',
        memorySourcePath: '.playbook/memory/events/event-1.json',
        knowledgeIds: []
      }
    ]);

    expect(expanded[0]).toMatchObject({
      eventKind: 'apply_run',
      eventSummary: 'apply succeeded',
      eventCreatedAt: '2026-02-01T00:01:00.000Z'
    });
  });

  it('does not emit duplicate bridge records on repeated reads', () => {
    const root = setupRuntimeMemoryBridgeRepo();

    const first = readRuntimeMemoryEnvelope(root, { limit: 5 });
    const second = readRuntimeMemoryEnvelope(root, { limit: 5 });

    expect(first.runtimeTaskProvenance).toEqual(second.runtimeTaskProvenance);
    expect(second.runtimeTaskProvenance).toHaveLength(1);
    expect(first.dryRunEvidence).toEqual(second.dryRunEvidence);
    expect(second.dryRunEvidence).toHaveLength(1);
  });

  it('keeps bridge reads additive without auto-promotion side effects', () => {
    const root = setupRuntimeMemoryBridgeRepo();
    const before = fs.readFileSync(path.join(root, '.playbook/memory/knowledge/patterns.json'), 'utf8');

    readRuntimeMemoryEnvelope(root, { limit: 5 });

    const after = fs.readFileSync(path.join(root, '.playbook/memory/knowledge/patterns.json'), 'utf8');
    expect(after).toBe(before);
    expect(fs.existsSync(path.join(root, '.playbook/memory/knowledge/decisions.json'))).toBe(false);
    expect(fs.readdirSync(path.join(root, '.playbook/memory/events')).sort()).toEqual(['event-1.json']);
  });
});
