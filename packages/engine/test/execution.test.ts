import { describe, expect, it } from 'vitest';
import type { Rule } from '../src/execution/types.js';
import { FixExecutor } from '../src/execution/fixExecutor.js';
import { PlanGenerator } from '../src/execution/planGenerator.js';
import { RuleRunner } from '../src/execution/ruleRunner.js';

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
      { ruleId: 'A', file: null, action: 'first', autoFix: false },
      { ruleId: 'B', file: null, action: 'second', autoFix: false }
    ]);
  });

  it('FixExecutor only applies auto-fix tasks and reports statuses deterministically', async () => {
    const executor = new FixExecutor({
      known: async () => ({ filesChanged: ['docs/PLAYBOOK_NOTES.md'], summary: 'updated notes' }),
      broken: async () => {
        throw new Error('boom');
      }
    });

    const result = await executor.apply(
      [
        { ruleId: 'known', file: 'docs/PLAYBOOK_NOTES.md', action: 'apply known fix', autoFix: true },
        { ruleId: 'manual', file: null, action: 'manual action', autoFix: false },
        { ruleId: 'unknown', file: null, action: 'unknown action', autoFix: true },
        { ruleId: 'broken', file: null, action: 'broken action', autoFix: true }
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
});
