import { describe, expect, it } from 'vitest';
import { routeTask } from '../src/routing/routeTask.js';

describe('routeTask deterministic router engine', () => {
  it('classifies docs-only tasks', () => {
    const decision = routeTask(process.cwd(), 'update command docs');
    expect(decision.route).toBe('deterministic_local');
    expect(decision.taskFamily).toBe('docs_only');
  });

  it('classifies contracts/schema tasks', () => {
    const decision = routeTask(process.cwd(), 'update contracts schema registry');
    expect(decision.taskFamily).toBe('contracts_schema');
  });

  it('classifies cli command tasks', () => {
    const decision = routeTask(process.cwd(), 'add a new cli command flag');
    expect(decision.taskFamily).toBe('cli_command');
  });

  it('classifies engine scoring tasks', () => {
    const decision = routeTask(process.cwd(), 'adjust scoring fitness thresholds');
    expect(decision.taskFamily).toBe('engine_scoring');
  });

  it('classifies pattern-learning tasks', () => {
    const decision = routeTask(process.cwd(), 'improve pattern learning knowledge extraction');
    expect(decision.taskFamily).toBe('pattern_learning');
  });

  it('returns unsupported route when no deterministic family matches', () => {
    const decision = routeTask(process.cwd(), 'deploy kubernetes cluster');
    expect(decision.route).toBe('unsupported');
    expect(decision.missingPrerequisites[0]).toContain('supported family');
  });

  it('chooses a conservative route with warning when family classification is ambiguous', () => {
    const decision = routeTask(process.cwd(), 'update docs for cli command');
    expect(decision.route).toBe('deterministic_local');
    expect(decision.taskFamily).toBe('docs_only');
    expect(decision.warnings[0]).toContain('ambiguous task family signals');
  });
});
