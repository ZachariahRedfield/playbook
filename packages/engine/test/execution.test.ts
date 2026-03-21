import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Rule } from '../src/execution/types.js';
import { FixExecutor, HandlerResolver } from '../src/execution/fixExecutor.js';
import { PlanGenerator } from '../src/execution/planGenerator.js';
import { RuleRunner } from '../src/execution/ruleRunner.js';
import { parsePlanArtifact, selectPlanTasks } from '../src/execution/index.js';

describe('execution pipeline units', () => {
  it('RuleRunner aggregates findings from all rules', () => {
    const rules: Rule[] = [
      {
        id: 'one',
        description: 'first',
        check: () => ({ failures: [{ id: 'one.failure', message: 'first failure' }] })
      },
      {
        id: 'two',
        description: 'second',
        check: () => ({ failures: [{ id: 'two.failure', message: 'second failure' }] })
      }
    ];

    const result = new RuleRunner(rules).run({ repoRoot: '.', changedFiles: [] });
    expect(result.failures.map((failure) => failure.id)).toEqual(['one.failure', 'two.failure']);
  });

  it('PlanGenerator converts findings to structured tasks', () => {
    const planner = new PlanGenerator();
    const plan = planner.generate([{ id: 'PB001', message: 'missing docs', evidence: 'docs/ARCHITECTURE.md', fix: 'update architecture docs' }]);

    expect(plan.tasks).toEqual([
      {
        id: expect.any(String),
        ruleId: 'PB001',
        file: 'docs/ARCHITECTURE.md',
        action: 'update architecture docs',
        autoFix: true
      }
    ]);
  });

  it('PlanGenerator sorts tasks deterministically and marks non-fixable findings', () => {
    const planner = new PlanGenerator();
    const plan = planner.generate([
      { id: 'B', message: 'second' },
      { id: 'A', message: 'first' }
    ]);

    expect(plan.tasks).toEqual([
      { id: expect.any(String), ruleId: 'A', file: null, action: 'first', autoFix: false },
      { id: expect.any(String), ruleId: 'B', file: null, action: 'second', autoFix: false }
    ]);
  });

  it('PlanGenerator baseline ordering is unchanged when no promoted outcome knowledge matches', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plan-baseline-'));
    const planner = new PlanGenerator({ projectRoot: repoRoot });

    const plan = planner.generate([
      { id: 'B', message: 'second' },
      { id: 'A', message: 'first' }
    ]);

    expect(plan.tasks.map((task) => task.ruleId)).toEqual(['A', 'B']);
    expect(plan.tasks.every((task) => task.advisory?.outcomeLearning === undefined)).toBe(true);
  });

  it('PlanGenerator deterministically prioritizes findings using matching promoted outcome knowledge', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plan-ranking-'));
    const knowledgePath = path.join(repoRoot, '.playbook/memory/knowledge/decisions.json');
    fs.mkdirSync(path.dirname(knowledgePath), { recursive: true });
    fs.writeFileSync(knowledgePath, JSON.stringify({
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'decision',
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'decision-k1',
          candidateId: 'cand-1',
          sourceCandidateIds: ['cand-1'],
          sourceEventFingerprints: ['fp-1'],
          kind: 'decision',
          title: 'Prefer remediating A first',
          summary: 'Rule A has stronger outcome signal.',
          fingerprint: 'f-1',
          module: 'docs',
          ruleId: 'A',
          failureShape: 'A:fixable',
          promotedAt: '2026-01-01T00:00:00.000Z',
          provenance: [{ eventId: 'evt-1', sourcePath: 'events/1.json', fingerprint: 'fp-1', runId: 'run-1' }],
          status: 'active',
          supersedes: [],
          supersededBy: []
        }
      ]
    }, null, 2));

    const planner = new PlanGenerator({ projectRoot: repoRoot });
    const findings = [
      { id: 'B', message: 'second', evidence: 'src/file.ts', fix: 'fix b' },
      { id: 'A', message: 'first', evidence: 'docs/file.md', fix: 'fix a' }
    ];

    const first = planner.generate(findings);
    const second = planner.generate(findings);

    expect(first.tasks.map((task) => task.ruleId)).toEqual(['A', 'B']);
    expect(first.tasks.map((task) => task.ruleId)).toEqual(second.tasks.map((task) => task.ruleId));
    expect(first.tasks[0]?.advisory?.outcomeLearning?.influencedByKnowledgeIds).toEqual(['decision-k1']);
  });

  it('PlanGenerator emits advisory provenance without expanding mutation authority', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plan-provenance-'));
    const knowledgePath = path.join(repoRoot, '.playbook/memory/knowledge/decisions.json');
    fs.mkdirSync(path.dirname(knowledgePath), { recursive: true });
    fs.writeFileSync(knowledgePath, JSON.stringify({
      schemaVersion: '1.0',
      artifact: 'memory-knowledge',
      kind: 'decision',
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        {
          knowledgeId: 'decision-k2',
          candidateId: 'cand-2',
          sourceCandidateIds: ['cand-2', 'cand-3'],
          sourceEventFingerprints: ['fp-2', 'fp-3'],
          kind: 'decision',
          title: 'Use prior outcome',
          summary: 'Carry forward successful ordering rationale.',
          fingerprint: 'f-2',
          module: 'docs',
          ruleId: 'PB001',
          failureShape: 'PB001:fixable',
          promotedAt: '2026-01-02T00:00:00.000Z',
          provenance: [{ eventId: 'evt-2', sourcePath: 'events/2.json', fingerprint: 'fp-2', runId: 'run-2' }],
          status: 'active',
          supersedes: [],
          supersededBy: []
        }
      ]
    }, null, 2));

    const planner = new PlanGenerator({ projectRoot: repoRoot });
    const plan = planner.generate([{ id: 'PB001', message: 'missing docs', evidence: 'docs/ARCHITECTURE.md', fix: 'update docs' }]);

    expect(plan.tasks[0]?.autoFix).toBe(true);
    expect(plan.tasks[0]?.advisory?.outcomeLearning).toMatchObject({
      influencedByKnowledgeIds: ['decision-k2'],
      support: {
        sourceCandidateCount: 2,
        provenanceCount: 1,
        eventFingerprintCount: 2
      }
    });
    expect(plan.tasks[0]?.advisory?.outcomeLearning?.confidence).toBeGreaterThan(0);
    expect(plan.tasks[0]?.advisory?.outcomeLearning?.confidence).toBeLessThanOrEqual(1);
  });



  it('PlanGenerator task ids are deterministic for equivalent findings', () => {
    const planner = new PlanGenerator();
    const findings = [{ id: 'PB001', message: 'missing docs', evidence: 'docs/ARCHITECTURE.md', fix: 'update architecture docs' }];

    const first = planner.generate(findings);
    const second = planner.generate(findings);

    expect(first.tasks[0]?.id).toBe(second.tasks[0]?.id);
  });

  it('parsePlanArtifact validates envelope and returns tasks in source order', () => {
    const parsed = parsePlanArtifact({
      schemaVersion: '1.0',
      command: 'plan',
      tasks: [
        { id: 'task-2', ruleId: 'B', file: null, action: 'second', autoFix: false },
        {
          id: 'task-1',
          ruleId: 'A',
          file: 'docs/PLAYBOOK_NOTES.md',
          action: 'first',
          autoFix: true,
          advisory: {
            outcomeLearning: {
              influencedByKnowledgeIds: ['decision-k9'],
              rationale: 'Ranked using promoted outcome knowledge.',
              scope: { ruleIdMatched: true, moduleMatched: true, failureShapeMatched: false },
              support: { sourceCandidateCount: 1, provenanceCount: 1, eventFingerprintCount: 1 },
              confidence: 0.3
            }
          }
        }
      ]
    });

    expect(parsed.tasks).toEqual([
      { id: 'task-2', ruleId: 'B', file: null, action: 'second', autoFix: false },
      {
        id: 'task-1',
        ruleId: 'A',
        file: 'docs/PLAYBOOK_NOTES.md',
        action: 'first',
        autoFix: true,
        advisory: {
          outcomeLearning: {
            influencedByKnowledgeIds: ['decision-k9'],
            rationale: 'Ranked using promoted outcome knowledge.',
            scope: { ruleIdMatched: true, moduleMatched: true, failureShapeMatched: false },
            support: { sourceCandidateCount: 1, provenanceCount: 1, eventFingerprintCount: 1 },
            confidence: 0.3
          }
        }
      }
    ]);
  });


  it('selectPlanTasks supports exact task-id filtering with deduplication and preserved order', () => {
    const tasks = [
      { id: 'task-1', ruleId: 'A', file: null, action: 'first', autoFix: true },
      { id: 'task-2', ruleId: 'B', file: null, action: 'second', autoFix: true },
      { id: 'task-3', ruleId: 'C', file: null, action: 'third', autoFix: false }
    ];

    expect(selectPlanTasks(tasks, ['task-3'])).toEqual([tasks[2]]);
    expect(selectPlanTasks(tasks, ['task-3', 'task-1', 'task-3'])).toEqual([tasks[0], tasks[2]]);
  });

  it('selectPlanTasks fails clearly on unknown or empty task selections', () => {
    const tasks = [{ id: 'task-1', ruleId: 'A', file: null, action: 'first', autoFix: true }];

    expect(() => selectPlanTasks(tasks, ['task-missing'])).toThrow('Unknown task id(s): task-missing.');
    expect(() => selectPlanTasks(tasks, [])).toThrow('No task ids were provided. Supply at least one --task <task-id>.');
  });

  it('parsePlanArtifact fails on invalid envelopes', () => {
    expect(() => parsePlanArtifact(null)).toThrow('Invalid plan payload: expected an object envelope.');
    expect(() => parsePlanArtifact({ schemaVersion: '2.0', command: 'plan', tasks: [] })).toThrow('Unsupported plan schemaVersion: 2.0.');
    expect(() => parsePlanArtifact({ schemaVersion: '1.0', command: 'verify', tasks: [] })).toThrow('Invalid plan payload: command must be "plan" or "docs consolidate-plan".');
    expect(() => parsePlanArtifact({ schemaVersion: '1.0', command: 'plan', tasks: 'bad' })).toThrow('Invalid plan payload: tasks must be an array.');
  });

  it('FixExecutor only applies auto-fix tasks and reports statuses deterministically', async () => {
    const executor = new FixExecutor(new HandlerResolver({ builtIn: {
      known: async () => ({ status: 'applied', filesChanged: ['docs/PLAYBOOK_NOTES.md'], summary: 'updated notes' }),
      broken: async () => {
        throw new Error('boom');
      }
    } }));

    const result = await executor.apply(
      [
        { id: 'task-known', ruleId: 'known', file: 'docs/PLAYBOOK_NOTES.md', action: 'apply known fix', autoFix: true },
        { id: 'task-manual', ruleId: 'manual', file: null, action: 'manual action', autoFix: false },
        { id: 'task-unknown', ruleId: 'unknown', file: null, action: 'unknown action', autoFix: true },
        { id: 'task-broken', ruleId: 'broken', file: null, action: 'broken action', autoFix: true }
      ],
      { repoRoot: '.', dryRun: false }
    );

    expect(result.results.map((entry) => [entry.ruleId, entry.status])).toEqual([
      ['known', 'applied'],
      ['manual', 'skipped'],
      ['unknown', 'unsupported'],
      ['broken', 'failed']
    ]);
    expect(result.summary).toEqual({ applied: 1, skipped: 1, unsupported: 1, failed: 1 });
  });

  it('HandlerResolver gives precedence to plugin handlers', () => {
    const resolver = new HandlerResolver({
      builtIn: {
        'notes.missing': async () => ({ status: 'applied', filesChanged: ['docs/PLAYBOOK_NOTES.md'], summary: 'builtin' })
      },
      plugin: {
        'notes.missing': async () => ({ status: 'applied', filesChanged: ['docs/PLAYBOOK_NOTES.md'], summary: 'plugin' })
      }
    });

    const resolved = resolver.resolve({ id: '1', ruleId: 'notes.missing', file: 'docs/PLAYBOOK_NOTES.md', action: 'create notes', autoFix: true });
    expect(resolved?.source).toBe('plugin');
  });

  it('undefined plugin handler does not shadow built-in handler', () => {
    const resolver = new HandlerResolver({
      builtIn: {
        'notes.missing': async () => ({ status: 'applied', filesChanged: ['docs/PLAYBOOK_NOTES.md'], summary: 'builtin' })
      },
      plugin: {
        'notes.missing': undefined
      }
    });

    const resolved = resolver.resolve({ id: '1', ruleId: 'notes.missing', file: 'docs/PLAYBOOK_NOTES.md', action: 'create notes', autoFix: true });
    expect(resolved?.source).toBe('builtin');
  });

  it('surfaces explicit skipped and unsupported handler results', async () => {
    const executor = new FixExecutor(
      new HandlerResolver({
        builtIn: {
          skipped: async () => ({ status: 'skipped', message: 'No edit needed.' }),
          unsupported: async () => ({ status: 'unsupported', message: 'Handler supports only markdown files.' })
        }
      })
    );

    const result = await executor.apply(
      [
        { id: 'task-skipped', ruleId: 'skipped', file: null, action: 'skip action', autoFix: true },
        { id: 'task-unsupported', ruleId: 'unsupported', file: null, action: 'unsupported action', autoFix: true }
      ],
      { repoRoot: '.', dryRun: false }
    );

    expect(result.results.map((entry) => [entry.ruleId, entry.status, entry.message])).toEqual([
      ['skipped', 'skipped', 'No edit needed.'],
      ['unsupported', 'unsupported', 'Handler supports only markdown files.']
    ]);
  });

  it('fails deterministically on handler contract violations', async () => {
    const executor = new FixExecutor(
      new HandlerResolver({
        builtIn: {
          bad: async () => ({ status: 'applied', summary: 'Missing filesChanged.' })
        }
      })
    );

    const result = await executor.apply(
      [{ id: 'task-bad', ruleId: 'bad', file: null, action: 'bad action', autoFix: true }],
      { repoRoot: '.', dryRun: false }
    );

    expect(result.results).toEqual([
      {
        id: 'task-bad',
        ruleId: 'bad',
        file: null,
        action: 'bad action',
        autoFix: true,
        status: 'failed',
        message: 'Fix handler contract violation: filesChanged must be an array.'
      }
    ]);
  });
});
