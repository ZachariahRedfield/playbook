import { describe, expect, it } from 'vitest';
import { buildWorksetPlan } from '../src/orchestration/worksetPlan.js';

describe('buildWorksetPlan', () => {
  it('groups docs + cli tasks into parallel safe lanes', () => {
    const artifact = buildWorksetPlan(
      process.cwd(),
      [
        { task_id: 'task-docs', task: 'update documentation and changelog' },
        { task_id: 'task-cli', task: 'add a new cli command flag' }
      ],
      './fixtures/tasks.json'
    );

    expect(artifact.lanes.length).toBe(2);
    expect(artifact.blocked_tasks).toHaveLength(0);
    expect(artifact.lanes.every((lane) => lane.readiness_status === 'ready')).toBe(true);
    expect(artifact.lanes.every((lane) => lane.codex_prompt.includes('Rule / Pattern / Failure Mode'))).toBe(true);
    expect(artifact.lanes.every((lane) => lane.codex_prompt.includes('Allowed direct-edit files / surfaces'))).toBe(true);
  });

  it('isolates engine scoring from pattern learning conflicts', () => {
    const artifact = buildWorksetPlan(
      process.cwd(),
      [
        { task_id: 'task-engine', task: 'adjust scoring fitness thresholds' },
        { task_id: 'task-pattern', task: 'improve pattern learning knowledge extraction' }
      ],
      './fixtures/tasks.json'
    );

    expect(artifact.lanes.length).toBe(2);
    expect(artifact.lanes[0]?.task_ids).toHaveLength(1);
    expect(artifact.lanes[1]?.task_ids).toHaveLength(1);
  });

  it('blocks ambiguous task with warning', () => {
    const artifact = buildWorksetPlan(
      process.cwd(),
      [{ task_id: 'task-ambiguous', task: 'update docs for cli command' }],
      './fixtures/tasks.json'
    );

    expect(artifact.blocked_tasks).toHaveLength(1);
    expect(artifact.blocked_tasks[0]?.reason).toContain('ambiguous');
    expect(artifact.warnings.some((warning) => warning.includes('blocked ambiguous task'))).toBe(true);
  });

  it('blocks unsupported task and keeps prerequisites explicit', () => {
    const artifact = buildWorksetPlan(
      process.cwd(),
      [{ task_id: 'task-unsupported', task: 'deploy kubernetes cluster' }],
      './fixtures/tasks.json'
    );

    expect(artifact.blocked_tasks).toHaveLength(1);
    expect(artifact.blocked_tasks[0]?.reason).toContain('unsupported');
    expect(artifact.blocked_tasks[0]?.missing_prerequisites.length).toBeGreaterThan(0);
  });

  it('produces multiple worker-ready prompts for mixed worksets', () => {
    const artifact = buildWorksetPlan(
      process.cwd(),
      [
        { task_id: 'task-docs', task: 'update documentation changelog' },
        { task_id: 'task-contracts', task: 'update contracts schema registry' },
        { task_id: 'task-engine', task: 'adjust scoring fitness thresholds' }
      ],
      './fixtures/tasks.json'
    );

    expect(artifact.lanes.length).toBeGreaterThan(1);
    expect(artifact.lanes.every((lane) => lane.codex_prompt.length > 0)).toBe(true);
  });

  it('detects overlapping file domains and reports shared artifact risk', () => {
    const artifact = buildWorksetPlan(
      process.cwd(),
      [
        { task_id: 'task-docs-a', task: 'update documentation for architecture workflow' },
        { task_id: 'task-docs-b', task: 'update docs command reference and docs examples' }
      ],
      './fixtures/tasks.json'
    );

    expect(Array.isArray(artifact.validation.overlapping_file_domains)).toBe(true);
    expect(Array.isArray(artifact.validation.conflicting_artifact_ownership)).toBe(true);
    expect(
      artifact.lanes.every((lane) => ['low', 'medium', 'high'].includes(lane.shared_artifact_risk) && lane.assignment_confidence >= 0 && lane.assignment_confidence <= 1)
    ).toBe(true);
  });

  it('flags blocked lane dependencies in validation', () => {
    const artifact = buildWorksetPlan(
      process.cwd(),
      [
        { task_id: 'task-unsupported', task: 'deploy kubernetes cluster' },
        { task_id: 'task-cli', task: 'add a new cli command flag' }
      ],
      './fixtures/tasks.json'
    );

    expect(artifact.validation.blocked_lane_dependencies).toBeDefined();
  });
});
