import { describe, expect, it } from 'vitest';
import type { Rule } from '../src/execution/types.js';
import { FixExecutor, HandlerResolver } from '../src/execution/fixExecutor.js';
import { PlanGenerator } from '../src/execution/planGenerator.js';
import { RuleRunner } from '../src/execution/ruleRunner.js';
import { parsePlanArtifact } from '../src/execution/index.js';

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
        { id: 'task-1', ruleId: 'A', file: 'docs/PLAYBOOK_NOTES.md', action: 'first', autoFix: true }
      ]
    });

    expect(parsed.tasks).toEqual([
      { id: 'task-2', ruleId: 'B', file: null, action: 'second', autoFix: false },
      { id: 'task-1', ruleId: 'A', file: 'docs/PLAYBOOK_NOTES.md', action: 'first', autoFix: true }
    ]);
  });

  it('parsePlanArtifact fails on invalid envelopes', () => {
    expect(() => parsePlanArtifact(null)).toThrow('Invalid plan payload: expected an object envelope.');
    expect(() => parsePlanArtifact({ schemaVersion: '2.0', command: 'plan', tasks: [] })).toThrow('Unsupported plan schemaVersion: 2.0.');
    expect(() => parsePlanArtifact({ schemaVersion: '1.0', command: 'verify', tasks: [] })).toThrow('Invalid plan payload: command must be "plan".');
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
