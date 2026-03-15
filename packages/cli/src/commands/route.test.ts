import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const routeTask = vi.fn();
const buildExecutionPlan = vi.fn();
const compileCodexPrompt = vi.fn();
const recordRouteDecision = vi.fn();
const safeRecordRepositoryEvent = vi.fn((callback: () => void) => callback());

vi.mock('@zachariahredfield/playbook-engine', () => ({
  routeTask,
  buildExecutionPlan,
  compileCodexPrompt,
  recordRouteDecision,
  safeRecordRepositoryEvent
}));

describe('runRoute', () => {
  it('emits deterministic json route output with execution plan proposal', async () => {
    const { runRoute } = await import('./route.js');
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-route-'));
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    routeTask.mockReturnValue({
      route: 'deterministic_local',
      why: 'Task family classification matched a deterministic task-execution-profile.',
      requiredInputs: ['task input'],
      missingPrerequisites: [],
      repoMutationAllowed: false,
      taskFamily: 'docs_only',
      affectedSurfaces: ['docs', 'governance'],
      estimatedChangeSurface: 'small',
      warnings: []
    });

    buildExecutionPlan.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'execution-plan',
      generatedAt: '1970-01-01T00:00:00.000Z',
      proposalOnly: true,
      task_family: 'docs_only',
      route_id: 'deterministic_local:docs_only',
      rule_packs: ['docs-governance'],
      required_validations: ['pnpm playbook docs audit --json'],
      optional_validations: ['pnpm -r build'],
      parallel_lanes: ['parallel-safe-validation'],
      mutation_allowed: false,
      missing_prerequisites: [],
      sourceArtifacts: {
        taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
        learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
      },
      learning_state_available: false,
      route_confidence: 0.6,
      open_questions: [],
      warnings: [],
      expected_surfaces: ['docs', 'governance'],
      likely_conflict_surfaces: ['docs/CHANGELOG.md', 'docs/commands/README.md'],
      dependency_level: 'low',
      recommended_pr_size: 'small',
      worker_ready: true
    });

    compileCodexPrompt.mockReturnValue('compiled prompt');

    const exitCode = await runRoute(repo, ['update', 'command', 'docs'], { format: 'json', quiet: false, codexPrompt: true });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('route');
    expect(payload.selectedRoute).toBe('deterministic_local');
    expect(payload.task).toBe('update command docs');
    expect(payload.executionPlan.kind).toBe('execution-plan');
    expect(payload.codexPrompt).toBe('compiled prompt');

    expect(buildExecutionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'update command docs',
        learningStateSnapshot: undefined
      })
    );

    const persisted = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'execution-plan.json'), 'utf8'));
    expect(persisted.kind).toBe('execution-plan');

    expect(compileCodexPrompt).toHaveBeenCalled();

    logSpy.mockRestore();
    fs.rmSync(repo, { recursive: true, force: true });
  });
});
