import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runWorkers } from './workers/index.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeWorksetPlan = (repo: string): void => {
  const workset = {
    schemaVersion: '1.0',
    kind: 'workset-plan',
    generatedAt: '1970-01-01T00:00:00.000Z',
    proposalOnly: true,
    input_tasks: [],
    routed_tasks: [],
    lanes: [
      {
        lane_id: 'lane-1',
        task_ids: ['task-1'],
        task_families: ['docs_only'],
        expected_surfaces: ['docs/commands/workers.md'],
        likely_conflict_surfaces: [],
        readiness_status: 'ready',
        blocking_reasons: [],
        conflict_surface_paths: [],
        shared_artifact_risk: 'low',
        assignment_confidence: 0.94,
        dependency_level: 'low',
        recommended_pr_size: 'small',
        worker_ready: true,
        codex_prompt: 'Prompt for lane 1',
        protected_doc_consolidation: {
          has_protected_doc_work: true,
          stage: 'pending',
          summary: 'pending protected-doc consolidation',
          next_command: 'pnpm playbook docs consolidate --json'
        }
      },
      {
        lane_id: 'lane-2',
        task_ids: ['task-2'],
        task_families: ['cli_command'],
        expected_surfaces: ['packages/cli/src/commands/index.ts'],
        likely_conflict_surfaces: [],
        readiness_status: 'ready',
        blocking_reasons: [],
        conflict_surface_paths: [],
        shared_artifact_risk: 'low',
        assignment_confidence: 0.84,
        dependency_level: 'medium',
        recommended_pr_size: 'small',
        worker_ready: true,
        codex_prompt: 'Prompt for lane 2',
        protected_doc_consolidation: {
          has_protected_doc_work: false,
          stage: 'not_applicable',
          summary: 'no protected-doc work',
          next_command: null
        }
      }
    ],
    blocked_tasks: [],
    dependency_edges: [{ from_lane_id: 'lane-1', to_lane_id: 'lane-2', reason: 'lane-1 first' }],
    validation: {
      overlapping_file_domains: [],
      conflicting_artifact_ownership: [],
      blocked_lane_dependencies: []
    },
    merge_risk_notes: [],
    sourceArtifacts: {
      tasksFile: { available: true, artifactPath: './fixtures/tasks.json' },
      taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
      learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
    },
    warnings: []
  };

  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.playbook', 'workset-plan.json'), `${JSON.stringify(workset, null, 2)}\n`, 'utf8');
};

describe('runWorkers', () => {
  it('assigns ready lanes and writes worker assignment + prompt artifacts', async () => {
    const repo = createRepo('playbook-cli-workers-ready');
    writeWorksetPlan(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runWorkers(repo, { format: 'json', quiet: false, action: 'assign' });

    expect(exitCode).toBe(ExitCode.Success);
    expect(fs.existsSync(path.join(repo, '.playbook', 'worker-assignments.json'))).toBe(true);
    expect(fs.existsSync(path.join(repo, '.playbook', 'prompts', 'lane-1.md'))).toBe(true);
    expect(fs.existsSync(path.join(repo, '.playbook', 'prompts', 'lane-2.md'))).toBe(false);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      command: string;
      worker_assignments: { kind: string; lanes: Array<{ lane_id: string; status: string }> };
    };
    expect(payload.command).toBe('workers');
    expect(payload.worker_assignments.kind).toBe('worker-assignments');
    expect(payload.worker_assignments.lanes.find((lane) => lane.lane_id === 'lane-1')?.status).toBe('assigned');
    expect(payload.worker_assignments.lanes.find((lane) => lane.lane_id === 'lane-2')?.status).toBe('blocked');

    logSpy.mockRestore();
  });

  it('submits worker results, writes deterministic receipt artifacts, and advances lane state', async () => {
    const repo = createRepo('playbook-cli-workers-submit');
    writeWorksetPlan(repo);
    fs.mkdirSync(path.join(repo, '.playbook', 'orchestrator', 'workers', 'lane-1'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'orchestrator', 'workers', 'lane-1', 'worker-fragment.json'), JSON.stringify({ ok: true }), 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'proof.json'), JSON.stringify({ ok: true }), 'utf8');

    const inputPath = path.join(repo, 'worker-result.json');
    fs.writeFileSync(inputPath, JSON.stringify({
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'bounded lane work completed',
      blockers: [],
      unresolved_items: ['await reviewed consolidation'],
      fragment_refs: [{ target_path: 'docs/commands/workers.md', fragment_path: '.playbook/orchestrator/workers/lane-1/worker-fragment.json' }],
      proof_refs: [{ path: '.playbook/proof.json', kind: 'proof' }],
      artifact_refs: [{ path: '.playbook/worker-assignments.json', kind: 'artifact' }]
    }, null, 2));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runWorkers(repo, { format: 'json', quiet: false, action: 'submit', from: inputPath });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      action: string;
      worker_results_path: string;
      result: { lane_id: string; completion_status: string };
      lane_state: { lanes: Array<{ lane_id: string; status: string; merge_ready: boolean }> };
      next_action: string | null;
    };
    expect(payload.action).toBe('submit');
    expect(payload.worker_results_path).toBe('.playbook/worker-results.json');
    expect(payload.result.lane_id).toBe('lane-1');
    expect(payload.result.completion_status).toBe('completed');
    expect(payload.lane_state.lanes.find((lane) => lane.lane_id === 'lane-1')?.status).toBe('completed');
    expect(payload.lane_state.lanes.find((lane) => lane.lane_id === 'lane-1')?.merge_ready).toBe(false);
    expect(payload.next_action).toBe('pnpm playbook docs consolidate --json');

    const artifact = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'worker-results.json'), 'utf8')) as { results: Array<{ lane_id: string }> };
    expect(artifact.results.map((entry) => entry.lane_id)).toEqual(['lane-1']);
    logSpy.mockRestore();
  });


  it('builds deterministic launch authorization plan artifact via workers launch-plan', async () => {
    const repo = createRepo('playbook-cli-workers-launch-plan');
    writeWorksetPlan(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runWorkers(repo, { format: 'json', quiet: false, action: 'launch-plan' });

    expect(exitCode).toBe(ExitCode.Success);
    expect(fs.existsSync(path.join(repo, '.playbook', 'worker-launch-plan.json'))).toBe(true);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      action: string;
      worker_launch_plan_path: string;
      worker_launch_plan: {
        kind: string;
        lanes: Array<{ lane_id: string; launchEligible: boolean; blockers: string[] }>;
      };
    };

    expect(payload.action).toBe('launch-plan');
    expect(payload.worker_launch_plan_path).toBe('.playbook/worker-launch-plan.json');
    expect(payload.worker_launch_plan.kind).toBe('worker-launch-plan');
    expect(payload.worker_launch_plan.lanes.find((lane) => lane.lane_id === 'lane-1')?.launchEligible).toBe(false);
    expect(payload.worker_launch_plan.lanes.find((lane) => lane.lane_id === 'lane-1')?.blockers.some((entry) => entry.startsWith('protected-doc:'))).toBe(true);

    logSpy.mockRestore();
  });

  it('fails clearly for invalid protected-doc fragment refs in submit mode', async () => {
    const repo = createRepo('playbook-cli-workers-submit-invalid');
    writeWorksetPlan(repo);
    const inputPath = path.join(repo, 'worker-result-invalid.json');
    fs.writeFileSync(inputPath, JSON.stringify({
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'bounded lane work completed',
      blockers: [],
      unresolved_items: [],
      fragment_refs: [{ target_path: 'docs/README.md', fragment_path: 'docs/README.md' }],
      proof_refs: [],
      artifact_refs: []
    }, null, 2));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runWorkers(repo, { format: 'json', quiet: false, action: 'submit', from: inputPath });
    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { error: string };
    expect(payload.error).toContain('fragment ref target docs/README.md is not a protected singleton doc');
    logSpy.mockRestore();
  });

  it('rejects out-of-scope worker submit payloads when change-scope is declared', async () => {
    const repo = createRepo('playbook-cli-workers-submit-out-of-scope');
    writeWorksetPlan(repo);
    fs.writeFileSync(path.join(repo, '.playbook', 'change-scope.json'), JSON.stringify({
      schemaVersion: '1.0',
      kind: 'change-scope',
      generatedAt: '1970-01-01T00:00:00.000Z',
      bundles: [{
        scopeId: 'scope-lane-1',
        source: { command: 'workers launch-plan', artifactPath: '.playbook/worker-launch-plan.json' },
        mutationScope: {
          allowedFiles: ['.playbook/orchestrator/workers/lane-1/'],
          patchSizeBudget: { maxFiles: 1, maxHunks: 2, maxAddedLines: 120, maxRemovedLines: 90 },
          boundaryChecks: ['writes-must-stay-inside-allowedFiles']
        },
        expectedTests: [],
        docsSurfaces: [],
        rulesTouched: [],
        riskLevel: 'low',
        rationale: 'test',
        provenanceRefs: []
      }]
    }, null, 2));
    const inputPath = path.join(repo, 'worker-result-out-of-scope.json');
    fs.writeFileSync(inputPath, JSON.stringify({
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'bounded lane work completed',
      blockers: [],
      unresolved_items: [],
      fragment_refs: [{ target_path: 'docs/commands/workers.md', fragment_path: '.playbook/orchestrator/workers/lane-1/worker-fragment.json' }],
      proof_refs: [{ path: '.playbook/proof.json', kind: 'proof' }],
      artifact_refs: []
    }, null, 2));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runWorkers(repo, { format: 'json', quiet: false, action: 'submit', from: inputPath });
    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { error: string };
    expect(payload.error).toContain('outside allowed change scope for lane lane-1');
    logSpy.mockRestore();
  });

  it('returns deterministic missing-workset error in json mode', async () => {
    const repo = createRepo('playbook-cli-workers-missing');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runWorkers(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { command: string; error: string };
    expect(payload.command).toBe('workers');
    expect(payload.error).toContain('missing workset plan');

    logSpy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the workers command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'workers');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Assign deterministic proposal-only workers, derive launch authorization, and submit worker results from lane-state/workset artifacts');
  });
});
