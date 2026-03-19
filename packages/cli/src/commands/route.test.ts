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
const appendCommandExecutionQualityRecord = vi.fn();
const recordCommandExecution = vi.fn();
const recordCommandQuality = vi.fn();
const readStoriesArtifact = vi.fn();
const findStoryById = vi.fn();
const buildStoryRouteTask = vi.fn();
const toStoryPlanningReference = vi.fn();
const deriveStoryTransitionPreview = vi.fn();
const transitionStoryFromEvent = vi.fn();
const validateStoriesArtifact = vi.fn(() => []);

vi.mock('@zachariahredfield/playbook-engine', () => ({
  routeTask,
  buildExecutionPlan,
  compileCodexPrompt,
  recordRouteDecision,
  safeRecordRepositoryEvent,
  appendCommandExecutionQualityRecord,
  recordCommandExecution,
  recordCommandQuality,
  readStoriesArtifact,
  findStoryById,
  buildStoryRouteTask,
  toStoryPlanningReference,
  deriveStoryTransitionPreview,
  transitionStoryFromEvent,
  validateStoriesArtifact,
  STORIES_RELATIVE_PATH: '.playbook/stories.json'
}));

describe('runRoute', () => {
  it('returns deterministic failure for missing task argument', async () => {
    const { runRoute } = await import('./route.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runRoute('/repo', [], { format: 'json', quiet: false, codexPrompt: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('route');
    expect(payload.findings[0].id).toBe('route.task.required');

    logSpy.mockRestore();
  });

  it('prints help without writing artifacts', async () => {
    const { runRoute } = await import('./route.js');
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-route-help-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runRoute(repo, ['--help'], { format: 'text', quiet: false, codexPrompt: false, help: true });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Usage: playbook route <task> [options]');
    expect(fs.existsSync(path.join(repo, '.playbook', 'execution-plan.json'))).toBe(false);

    logSpy.mockRestore();
  });

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
    expect(payload.interpretation.progressive_disclosure.default_view.next_step.command).toBe('pnpm playbook docs audit --json');
    expect(payload.promotion).toMatchObject({
      kind: 'workflow-promotion',
      workflow_kind: 'route-execution-plan',
      candidate_artifact_path: '.playbook/staged/workflow-route/execution-plan.json',
      committed_target_path: '.playbook/execution-plan.json',
      validation_status: 'passed',
      promotion_status: 'promoted',
      promoted: true
    });
    expect(payload.codexPrompt).toBe('compiled prompt');
    expect(payload.story_transition).toBeNull();

    expect(buildExecutionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'update command docs',
        learningStateSnapshot: undefined,
        story: undefined
      })
    );

    const persisted = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'execution-plan.json'), 'utf8'));
    expect(persisted.kind).toBe('execution-plan');
    expect(fs.existsSync(path.join(repo, '.playbook', 'staged', 'workflow-route', 'execution-plan.json'))).toBe(true);

    expect(compileCodexPrompt).toHaveBeenCalled();

    logSpy.mockRestore();
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('routes from a story id and preserves story linkage in plan metadata', async () => {
    const { runRoute } = await import('./route.js');
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-route-story-'));
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const story = {
      id: 'story-1',
      title: 'Update command docs',
      status: 'ready',
      suggested_route: 'docs_only',
      execution_lane: null
    };
    readStoriesArtifact.mockReturnValue({ repo: 'repo', stories: [story] });
    findStoryById.mockImplementation((_artifact, id) => id === 'story-1' ? story : null);
    buildStoryRouteTask.mockReturnValue('update command docs: Update command docs');
    toStoryPlanningReference.mockReturnValue({
      story_reference: 'story:story-1',
      id: 'story-1',
      title: 'Update command docs',
      status: 'ready',
      artifact_path: '.playbook/stories.json',
      suggested_route: 'docs_only',
      execution_lane: null
    });
    deriveStoryTransitionPreview.mockReturnValue({
      story_id: 'story-1',
      previous_status: 'ready',
      next_status: 'in_progress'
    });
    transitionStoryFromEvent.mockReturnValue({
      schemaVersion: '1.0',
      repo: 'repo',
      stories: [{ ...story, status: 'in_progress' }]
    });
    routeTask.mockReturnValue({
      route: 'deterministic_local',
      why: 'Task family classification matched a deterministic task-execution-profile.',
      requiredInputs: ['task input'],
      missingPrerequisites: [],
      repoMutationAllowed: false,
      taskFamily: 'docs_only',
      affectedSurfaces: ['docs'],
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
      optional_validations: [],
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
      expected_surfaces: ['docs'],
      likely_conflict_surfaces: ['docs/CHANGELOG.md'],
      dependency_level: 'low',
      recommended_pr_size: 'small',
      worker_ready: true,
      story_reference: {
        story_reference: 'story:story-1',
        id: 'story-1',
        title: 'Update command docs',
        status: 'ready',
        artifact_path: '.playbook/stories.json',
        suggested_route: 'docs_only',
        execution_lane: null
      }
    });

    const exitCode = await runRoute(repo, ['--story', 'story-1'], { format: 'json', quiet: false, codexPrompt: false });
    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.story.id).toBe('story-1');
    expect(payload.executionPlan.story_reference.story_reference).toBe('story:story-1');
    expect(payload.executionPlan.story_reference.id).toBe('story-1');
    expect(payload.story_transition.next_status).toBe('in_progress');
    expect(buildExecutionPlan).toHaveBeenCalledWith(expect.objectContaining({
      story: expect.objectContaining({ id: 'story-1' })
    }));

    logSpy.mockRestore();
  });
});
