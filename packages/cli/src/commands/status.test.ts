import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import type { AnalyzeReport } from './analyze.js';
import type { VerifyReport } from './verify.js';

const collectAnalyzeReport = vi.fn<(cwd: string) => Promise<AnalyzeReport>>();
const ensureRepoIndex = vi.fn<(repoRoot: string) => Promise<string>>();
const collectDoctorReport = vi.fn();
const collectVerifyReport = vi.fn<(cwd: string) => Promise<VerifyReport>>();

vi.mock('./analyze.js', () => ({ collectAnalyzeReport, ensureRepoIndex }));
vi.mock('./doctor.js', () => ({ collectDoctorReport }));
vi.mock('./verify.js', () => ({ collectVerifyReport }));

const buildRepoAdoptionReadiness = vi.fn();
const buildFleetAdoptionReadinessSummary = vi.fn();
const buildFleetAdoptionWorkQueue = vi.fn();
const buildFleetCodexExecutionPlan = vi.fn();
const buildFleetExecutionReceipt = vi.fn();
const buildFleetUpdatedAdoptionState = vi.fn();
const deriveNextAdoptionQueueFromUpdatedState = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ buildRepoAdoptionReadiness, buildFleetAdoptionReadinessSummary, buildFleetAdoptionWorkQueue, buildFleetCodexExecutionPlan, buildFleetExecutionReceipt, buildFleetUpdatedAdoptionState, deriveNextAdoptionQueueFromUpdatedState }));

const makeAnalyzeReport = (overrides?: Partial<AnalyzeReport>): AnalyzeReport => ({
  repoPath: '/tmp/repo',
  ok: true,
  detectorsRun: [],
  detected: [],
  summary: '',
  signals: '',
  recommendations: [],
  ...overrides
});

const makeVerifyReport = (overrides?: Partial<VerifyReport>): VerifyReport => ({
  ok: true,
  summary: { failures: 0, warnings: 0 },
  failures: [],
  warnings: [],
  ...overrides
});

describe('runStatus', () => {
  beforeEach(() => {
    collectDoctorReport.mockReset();
    collectAnalyzeReport.mockReset();
    collectVerifyReport.mockReset();
    ensureRepoIndex.mockReset();
    ensureRepoIndex.mockImplementation(async (repoRoot: string) => `${repoRoot}/.playbook/repo-index.json`);
    buildRepoAdoptionReadiness.mockReset();
    buildFleetAdoptionReadinessSummary.mockReset();
    buildFleetAdoptionWorkQueue.mockReset();
    buildFleetCodexExecutionPlan.mockReset();
    buildFleetExecutionReceipt.mockReset();
    buildFleetUpdatedAdoptionState.mockReset();
    deriveNextAdoptionQueueFromUpdatedState.mockReset();
    buildRepoAdoptionReadiness.mockReturnValue({
      schemaVersion: '1.0',
      connection_status: 'connected',
      playbook_detected: true,
      governed_artifacts_present: {
        repo_index: { present: true, valid: true, stale: false, failure_type: null },
        repo_graph: { present: true, valid: true, stale: false, failure_type: null },
        plan: { present: true, valid: true, stale: false, failure_type: null },
        policy_apply_result: { present: true, valid: true, stale: false, failure_type: null }
      },
      lifecycle_stage: 'ready',
      fallback_proof_ready: true,
      cross_repo_eligible: true,
      blockers: [],
      recommended_next_steps: []
    });
    buildFleetAdoptionReadinessSummary.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-readiness-summary',
      total_repos: 0,
      by_lifecycle_stage: {
        not_connected: 0,
        playbook_not_detected: 0,
        playbook_detected_index_pending: 0,
        indexed_plan_pending: 0,
        planned_apply_pending: 0,
        ready: 0
      },
      playbook_detected_count: 0,
      fallback_proof_ready_count: 0,
      cross_repo_eligible_count: 0,
      blocker_frequencies: [],
      recommended_actions: [],
      repos_by_priority: []
    });
    buildFleetAdoptionWorkQueue.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-work-queue',
      generated_at: '2026-01-01T00:00:00.000Z',
      total_repos: 0,
      work_items: [],
      waves: [],
      grouped_actions: [],
      blocked_items: []
    });
    buildFleetCodexExecutionPlan.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-codex-execution-plan',
      generated_at: '2026-01-01T00:00:00.000Z',
      source_queue_digest: 'abc123',
      waves: [],
      worker_lanes: [],
      codex_prompts: [],
      execution_notes: [],
      blocked_followups: []
    });
    buildFleetExecutionReceipt.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-execution-receipt',
      generated_at: '2026-01-01T00:00:00.000Z',
      execution_plan_digest: 'abc123',
      session_id: 'session-1',
      wave_results: [],
      prompt_results: [],
      repo_results: [],
      artifact_deltas: [],
      blockers: [],
      verification_summary: {
        prompts_total: 0,
        verification_passed_count: 0,
        succeeded_count: 0,
        failed_count: 0,
        partial_count: 0,
        mismatch_count: 0,
        not_run_count: 0,
        repos_needing_retry: [],
        planned_vs_actual_drift: []
      }
    });
    buildFleetUpdatedAdoptionState.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-updated-state',
      generated_at: '2026-01-01T00:00:00.000Z',
      execution_plan_digest: 'abc123',
      session_id: 'session-1',
      summary: {
        repos_total: 0,
        by_reconciliation_status: {
          completed_as_planned: 0,
          completed_with_drift: 0,
          partial: 0,
          failed: 0,
          blocked: 0,
          not_run: 0,
          stale_plan_or_superseded: 0
        },
        action_counts: {
          needs_retry: 0,
          needs_replan: 0,
          needs_review: 0
        },
        repos_needing_retry: [],
        repos_needing_replan: [],
        repos_needing_review: [],
        stale_or_superseded_repo_ids: [],
        blocked_repo_ids: [],
        completed_repo_ids: []
      },
      repos: []
    });
    deriveNextAdoptionQueueFromUpdatedState.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-work-queue',
      generated_at: '2026-01-01T00:00:00.000Z',
      total_repos: 0,
      queue_source: 'updated_state',
      work_items: [],
      waves: [],
      grouped_actions: [],
      blocked_items: []
    });
  });

  it('prints top issue guidance when findings exist', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    collectDoctorReport.mockResolvedValue({ governanceStatus: [{ id: 'playbook-config', ok: true }], verifySummary: { failures: 0 } });
    collectAnalyzeReport.mockResolvedValue(
      makeAnalyzeReport({
        ok: false,
        recommendations: [
          {
            id: 'analyze-no-signals',
            title: 'No stack signals detected',
            severity: 'WARN',
            message: 'No known stack detectors matched this repository.',
            why: 'why',
            fix: 'fix'
          }
        ]
      })
    );
    collectVerifyReport.mockResolvedValue(makeVerifyReport());

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Top issue');
    expect(output).toContain('analyze-no-signals – Warn when no framework or database stack signals are detected.');
    expect(output).toContain('pnpm playbook explain analyze-no-signals');

    logSpy.mockRestore();
  });

  it('keeps json output unchanged', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    collectDoctorReport.mockResolvedValue({ governanceStatus: [{ id: 'playbook-config', ok: true }], verifySummary: { failures: 0 } });
    collectAnalyzeReport.mockResolvedValue(makeAnalyzeReport());
    collectVerifyReport.mockResolvedValue(makeVerifyReport());

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('status');
    expect(payload).not.toHaveProperty('topIssue');
    expect(payload).toHaveProperty('adoption.lifecycle_stage', 'ready');

    logSpy.mockRestore();
  });

  it('generates repo index when missing before printing status output', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    collectDoctorReport.mockResolvedValue({ governanceStatus: [{ id: 'playbook-config', ok: true }], verifySummary: { failures: 0 } });
    collectAnalyzeReport.mockResolvedValue(makeAnalyzeReport({ repoPath: '/tmp/repo-root' }));
    collectVerifyReport.mockResolvedValue(makeVerifyReport());

    const exitCode = await runStatus('/tmp/subdir', { ci: false, format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(ensureRepoIndex).toHaveBeenCalledWith('/tmp/repo-root');

    logSpy.mockRestore();
  });

  it('prints fleet JSON output when fleet scope is requested', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    buildFleetAdoptionReadinessSummary.mockReturnValueOnce({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-readiness-summary',
      total_repos: 1,
      by_lifecycle_stage: {
        not_connected: 0,
        playbook_not_detected: 0,
        playbook_detected_index_pending: 0,
        indexed_plan_pending: 0,
        planned_apply_pending: 0,
        ready: 1
      },
      playbook_detected_count: 1,
      fallback_proof_ready_count: 1,
      cross_repo_eligible_count: 1,
      blocker_frequencies: [],
      recommended_actions: [],
      repos_by_priority: []
    });

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false, scope: 'fleet' });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('fleet');
    expect(payload.fleet.total_repos).toBe(1);
    expect(collectDoctorReport).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });


  it('prints execution JSON output when execute scope is requested', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false, scope: 'execute' });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('execute');
    expect(payload.execution_plan.kind).toBe('fleet-adoption-codex-execution-plan');
    expect(collectDoctorReport).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('prints queue JSON output when queue scope is requested', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    buildFleetAdoptionReadinessSummary.mockReturnValueOnce({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-readiness-summary',
      total_repos: 1,
      by_lifecycle_stage: {
        not_connected: 0,
        playbook_not_detected: 1,
        playbook_detected_index_pending: 0,
        indexed_plan_pending: 0,
        planned_apply_pending: 0,
        ready: 0
      },
      playbook_detected_count: 0,
      fallback_proof_ready_count: 0,
      cross_repo_eligible_count: 0,
      blocker_frequencies: [],
      recommended_actions: [],
      repos_by_priority: []
    });
    buildFleetAdoptionWorkQueue.mockReturnValueOnce({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-work-queue',
      generated_at: '2026-01-01T00:00:00.000Z',
      total_repos: 1,
      work_items: [
        {
          item_id: 'repo-a:init',
          repo_id: 'repo-a',
          lifecycle_stage: 'playbook_not_detected',
          blocker_codes: ['playbook_not_detected'],
          recommended_command: 'pnpm playbook init',
          priority_stage: 'playbook_not_detected',
          severity: 'high',
          parallel_group: 'init lane',
          dependencies: [],
          rationale: 'Playbook bootstrap is missing and must be initialized first.',
          wave: 'wave_1'
        }
      ],
      waves: [{ wave: 'wave_1', item_ids: ['repo-a:init'], repo_ids: ['repo-a'], action_count: 1 }],
      grouped_actions: [{ parallel_group: 'init lane', command: 'pnpm playbook init', repo_ids: ['repo-a'], item_ids: ['repo-a:init'] }],
      blocked_items: []
    });

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false, scope: 'queue' });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('queue');
    expect(payload.queue.kind).toBe('fleet-adoption-work-queue');
    expect(collectDoctorReport).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });


  it('prints receipt JSON output when receipt scope is requested', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false, scope: 'receipt' });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('receipt');
    expect(payload.receipt.kind).toBe('fleet-adoption-execution-receipt');
    expect(buildFleetExecutionReceipt).toHaveBeenCalled();
    logSpy.mockRestore();
  });


  it('prints updated-state JSON output when updated scope is requested and writes the artifact', async () => {
    const { runStatus } = await import('./status.js');
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-status-updated-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    buildFleetUpdatedAdoptionState.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-updated-state',
      generated_at: '2026-01-01T00:00:00.000Z',
      execution_plan_digest: 'abc123',
      session_id: 'session-1',
      summary: {
        repos_total: 1,
        by_reconciliation_status: {
          completed_as_planned: 1,
          completed_with_drift: 0,
          partial: 0,
          failed: 0,
          blocked: 0,
          not_run: 0,
          stale_plan_or_superseded: 0
        },
        action_counts: {
          needs_retry: 0,
          needs_replan: 0,
          needs_review: 0
        },
        repos_needing_retry: [],
        repos_needing_replan: [],
        repos_needing_review: [],
        stale_or_superseded_repo_ids: [],
        blocked_repo_ids: [],
        completed_repo_ids: ['repo-a']
      },
      repos: [{
        repo_id: 'repo-a',
        prior_lifecycle_stage: 'planned_apply_pending',
        planned_lifecycle_stage: 'ready',
        updated_lifecycle_stage: 'ready',
        reconciliation_status: 'completed_as_planned',
        action_state: { needs_retry: false, needs_replan: false, needs_review: false },
        prompt_ids: ['wave_1:apply_lane:repo-a'],
        blocker_codes: [],
        drift_prompt_ids: [],
        receipt_status: 'success'
      }]
    });

    const exitCode = await runStatus(cwd, { ci: false, format: 'json', quiet: false, scope: 'updated' });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy).toHaveBeenCalled();
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('updated');
    expect(payload.updated_state.kind).toBe('fleet-adoption-updated-state');
    expect(payload.next_queue.queue_source).toBe('updated_state');
    expect(payload.promotion).toMatchObject({
      kind: 'workflow-promotion',
      workflow_kind: 'status-updated',
      staged_generation: true,
      candidate_artifact_path: '.playbook/staged/workflow-status-updated/execution-updated-state.json',
      staged_artifact_path: '.playbook/staged/workflow-status-updated/execution-updated-state.json',
      committed_target_path: '.playbook/execution-updated-state.json',
      validation_status: 'passed',
      validation_passed: true,
      promotion_status: 'promoted',
      promoted: true,
      committed_state_preserved: true,
      blocked_reason: null
    });
    const artifactPath = path.join(cwd, '.playbook', 'execution-updated-state.json');
    expect(fs.existsSync(artifactPath)).toBe(true);
    const stagedPath = path.join(cwd, '.playbook', 'staged', 'workflow-status-updated', 'execution-updated-state.json');
    expect(fs.existsSync(stagedPath)).toBe(true);
    logSpy.mockRestore();
  });


  it('blocks promotion and preserves committed updated-state when staged validation fails', async () => {
    const { runStatus } = await import('./status.js');
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-status-updated-blocked-'));
    fs.mkdirSync(path.join(cwd, '.playbook'), { recursive: true });
    const committedPath = path.join(cwd, '.playbook', 'execution-updated-state.json');
    fs.writeFileSync(committedPath, JSON.stringify({ kind: 'prior-updated-state', preserved: true }, null, 2), 'utf8');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    buildFleetUpdatedAdoptionState.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-updated-state',
      generated_at: '2026-01-01T00:00:00.000Z',
      execution_plan_digest: 'abc123',
      session_id: 'session-1',
      summary: {
        repos_total: 99,
        by_reconciliation_status: {
          completed_as_planned: 1,
          completed_with_drift: 0,
          partial: 0,
          failed: 0,
          blocked: 0,
          not_run: 0,
          stale_plan_or_superseded: 0
        },
        action_counts: {
          needs_retry: 0,
          needs_replan: 0,
          needs_review: 0
        },
        repos_needing_retry: [],
        repos_needing_replan: [],
        repos_needing_review: [],
        stale_or_superseded_repo_ids: [],
        blocked_repo_ids: [],
        completed_repo_ids: ['repo-a']
      },
      repos: [{
        repo_id: 'repo-a',
        prior_lifecycle_stage: 'planned_apply_pending',
        planned_lifecycle_stage: 'ready',
        updated_lifecycle_stage: 'ready',
        reconciliation_status: 'completed_as_planned',
        action_state: { needs_retry: false, needs_replan: false, needs_review: false },
        prompt_ids: ['wave_1:apply_lane:repo-a'],
        blocker_codes: [],
        drift_prompt_ids: [],
        receipt_status: 'success'
      }]
    });

    const exitCode = await runStatus(cwd, { ci: false, format: 'json', quiet: false, scope: 'updated' });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.promotion.promoted).toBe(false);
    expect(payload.promotion.promotion_status).toBe('blocked');
    expect(payload.promotion.validation_passed).toBe(false);
    expect(payload.promotion.validation_status).toBe('blocked');
    expect(payload.promotion.blocked_reason).toContain('summary.repos_total must match repos length');
    expect(JSON.parse(fs.readFileSync(committedPath, 'utf8'))).toEqual({ kind: 'prior-updated-state', preserved: true });
    const stagedPath = path.join(cwd, '.playbook', 'staged', 'workflow-status-updated', 'execution-updated-state.json');
    expect(fs.existsSync(stagedPath)).toBe(true);
    logSpy.mockRestore();
  });

});
