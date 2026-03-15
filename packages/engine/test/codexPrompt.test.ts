import { describe, expect, it } from 'vitest';
import { buildExecutionPlan } from '../src/routing/executionPlan.js';
import { compileCodexPrompt } from '../src/routing/codexPrompt.js';
import { routeTask } from '../src/routing/routeTask.js';

const sourceArtifacts = {
  taskExecutionProfile: { available: true, artifactPath: '.playbook/task-execution-profile.json' },
  learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
} as const;

describe('compileCodexPrompt', () => {
  it('compiles a docs_only task into a worker-ready prompt', () => {
    const task = 'update command docs';
    const decision = routeTask(process.cwd(), task);
    const plan = buildExecutionPlan({ task, decision, sourceArtifacts });
    const prompt = compileCodexPrompt(task, decision, plan);

    expect(prompt).toContain('Objective');
    expect(prompt).toContain('Files / surfaces to modify');
    expect(prompt).toContain('- docs');
    expect(prompt).toContain('Rule / Pattern / Failure Mode');
    expect(plan.worker_ready).toBe(true);
  });

  it('compiles a cli_command task prompt with command/governance surfaces', () => {
    const task = 'add cli command flag';
    const decision = routeTask(process.cwd(), task);
    const plan = buildExecutionPlan({ task, decision, sourceArtifacts });
    const prompt = compileCodexPrompt(task, decision, plan);

    expect(plan.task_family).toBe('cli_command');
    expect(prompt).toContain('packages/cli/src/commands');
    expect(prompt).toContain('No worker launching.');
  });

  it('compiles an engine_scoring task prompt with deterministic verification steps', () => {
    const task = 'adjust scoring fitness thresholds';
    const decision = routeTask(process.cwd(), task);
    const plan = buildExecutionPlan({ task, decision, sourceArtifacts });
    const prompt = compileCodexPrompt(task, decision, plan);

    expect(plan.task_family).toBe('engine_scoring');
    expect(prompt).toContain('pnpm --filter @zachariahredfield/playbook-engine test');
    expect(prompt).toContain('pnpm -r build');
  });

  it('includes conservative warnings for ambiguous tasks', () => {
    const task = 'update docs for cli command';
    const decision = routeTask(process.cwd(), task);
    const plan = buildExecutionPlan({ task, decision, sourceArtifacts });
    const prompt = compileCodexPrompt(task, decision, plan);

    expect(decision.warnings[0]).toContain('ambiguous task family signals');
    expect(prompt).toContain('Conservative warnings');
    expect(prompt).toContain('ambiguous task family signals');
  });

  it('includes explicit prerequisites for unsupported tasks', () => {
    const task = 'deploy kubernetes cluster';
    const decision = routeTask(process.cwd(), task);
    const plan = buildExecutionPlan({ task, decision, sourceArtifacts });
    const prompt = compileCodexPrompt(task, decision, plan);

    expect(decision.route).toBe('unsupported');
    expect(plan.worker_ready).toBe(false);
    expect(prompt).toContain('Prerequisites (required before implementation)');
    expect(prompt).toContain('supported family');
  });
});
