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
const buildMemoryPressureStatusArtifact = vi.fn();
const loadConfig = vi.fn();
const runBootstrapProof = vi.fn();
const readProofParallelWorkSummary = vi.fn();
const defaultBootstrapCliResolutionCommands = vi.fn();
const classifyProofFailureDomains = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ buildRepoAdoptionReadiness, buildFleetAdoptionReadinessSummary, buildFleetAdoptionWorkQueue, buildFleetCodexExecutionPlan, buildFleetExecutionReceipt, buildFleetUpdatedAdoptionState, deriveNextAdoptionQueueFromUpdatedState, buildMemoryPressureStatusArtifact, loadConfig, runBootstrapProof, readProofParallelWorkSummary, defaultBootstrapCliResolutionCommands, classifyProofFailureDomains }));

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
    buildMemoryPressureStatusArtifact.mockReset();
    loadConfig.mockReset();
    runBootstrapProof.mockReset();
    readProofParallelWorkSummary.mockReset();
    defaultBootstrapCliResolutionCommands.mockReset();
    classifyProofFailureDomains.mockReset();
    defaultBootstrapCliResolutionCommands.mockReturnValue([]);
    classifyProofFailureDomains.mockReturnValue({
      failureDomains: [],
      primaryFailureDomain: null,
      domainBlockers: [],
      domainNextActions: []
    });
    loadConfig.mockReturnValue({
      config: {
        memory: {
          pressurePolicy: {
            budgetBytes: 1000,
            budgetFiles: 100,
            budgetEvents: 100,
            hysteresis: 0.05,
            watermarks: { warm: 0.6, pressure: 0.8, critical: 0.95 }
          }
        }
      }
    });
    buildMemoryPressureStatusArtifact.mockReturnValue({
      usage: { usedBytes: 256, fileCount: 3, eventCount: 2 },
      score: { bytes: 0.256, files: 0.03, events: 0.02, normalized: 0.256 },
      band: 'normal',
      policy: {
        budgetBytes: 1000,
        budgetFiles: 100,
        budgetEvents: 100,
        hysteresis: 0.05,
        watermarks: { warm: 0.6, pressure: 0.8, critical: 0.95 }
      },
      recommendedActions: []
    });
    readProofParallelWorkSummary.mockReturnValue({
      decision: 'parallel_clear',
      status: 'parallel integration clear',
      affected_surfaces: [],
      blockers: [],
      next_action: 'No parallel-work integration action is required.',
      counts: { pending: 0, blocked: 0, plan_ready: 0, guard_conflicted: 0, merge_ready: 0 },
      scope: { present: 0, missing: 0, violated: 0, clean: 0, violated_files: [], budget_status: 'unknown' },
      artifacts: {
        lane_state: { available: false, path: '.playbook/lane-state.json' },
        worker_results: { available: false, path: '.playbook/worker-results.json' },
        docs_consolidation_plan: { available: false, path: '.playbook/docs-consolidation-plan.json' },
        guarded_apply: { available: false, path: '.playbook/policy-apply-result.json' },
        execution_outcome_input: { available: false, path: '.playbook/execution-outcome-input.json' }
      },
      details: {
        lane_state: { available: false, blocked_lanes: [], merge_ready_lanes: [], pending_lanes: [], plan_ready_lanes: [] },
        worker_results: { available: false, in_progress_lanes: [], blocked_lanes: [], completed_lanes: [] },
        docs_consolidation_plan: { available: false, executable_targets: 0, excluded_targets: 0, target_docs: [], excluded_targets_by_doc: [] },
        guarded_apply: { available: false, executed: 0, skipped_requires_review: 0, skipped_blocked: [], failed_execution: [] },
        scope: { over_budget_prompts: 0, prompts_with_scope: 0, prompts_missing_scope: 0 }
      }
    });
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
    runBootstrapProof.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-bootstrap-proof',
      repo_root: process.cwd(),
      command: 'status',
      mode: 'proof',
      ok: true,
      current_state: 'governed_consumer_ready',
      highest_priority_next_action: 'No action required.',
      summary: {
        current_state: 'Repo passed the governed Playbook bootstrap proof.',
        why: 'all checks passed',
        what_next: 'No action required.'
      },
      diagnostics: {
        failing_stage: null,
        failing_category: null,
        checks: []
      }
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
    expect(output).toContain('Status');
    expect(output).toContain('Decision: healthy');
    expect(output).toContain('Status: ready');
    expect(output).toContain('Why: Warn when no framework or database stack signals are detected.');
    expect(output).toContain('Blockers: analyze-no-signals: Warn when no framework or database stack signals are detected.');
    expect(output).toContain('pnpm playbook explain analyze-no-signals');
    expect(output).toContain('analyze-no-signals');

    logSpy.mockRestore();
  });

  it('keeps json output additive and includes memory pressure inspection', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    collectDoctorReport.mockResolvedValue({ governanceStatus: [{ id: 'playbook-config', ok: true }], verifySummary: { failures: 0 } });
    collectAnalyzeReport.mockResolvedValue(makeAnalyzeReport());
    collectVerifyReport.mockResolvedValue(makeVerifyReport());

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('status');
    expect(payload.interpretation.progressive_disclosure.default_view.next_step).toBeDefined();
    expect(payload).not.toHaveProperty('topIssue');
    expect(payload).toHaveProperty('adoption.lifecycle_stage', 'ready');
    expect(payload).toHaveProperty('memory_pressure.band', 'normal');
    expect(payload).toHaveProperty('memory_pressure.score', 0.256);
    expect(payload).toHaveProperty('memory_pressure.hysteresis_thresholds.pressure', 0.8);
    expect(payload).toHaveProperty('memory_pressure.usage.usedBytes', 256);
    expect(payload).toHaveProperty('memory_pressure.recommended_actions');
    expect(payload).toHaveProperty('memory_pressure.action_plan.current_band', 'normal');
    expect(payload).toHaveProperty('memory_pressure.action_plan.highest_priority_recommended_actions');
    expect(payload).toHaveProperty('memory_pressure.action_plan.counts_by_action_type.summarize', 0);

    logSpy.mockRestore();
  });


  it('reads memory pressure plan summary without introducing mutation paths', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'status-memory-plan-'));
    fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, '.playbook', 'memory-pressure-plan.json'),
      `${JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-memory-pressure-plan',
        command: 'memory-pressure-plan',
        recommendedByBand: {
          warm: [{ action: 'dedupe' }, { action: 'compact' }],
          pressure: [{ action: 'summarize' }, { action: 'compact' }, { action: 'dedupe' }],
          critical: [{ action: 'summarize' }, { action: 'compact' }, { action: 'evict' }]
        }
      }, null, 2)}\n`,
      'utf8'
    );

    collectDoctorReport.mockResolvedValue({ governanceStatus: [{ id: 'playbook-config', ok: true }], verifySummary: { failures: 0 } });
    collectAnalyzeReport.mockResolvedValue(makeAnalyzeReport({ repoPath: repoRoot }));
    collectVerifyReport.mockResolvedValue(makeVerifyReport());
    buildMemoryPressureStatusArtifact.mockReturnValue({
      usage: { usedBytes: 1024, fileCount: 5, eventCount: 8 },
      score: { bytes: 1.024, files: 0.05, events: 0.08, normalized: 1.024 },
      band: 'pressure',
      policy: {
        budgetBytes: 1000,
        budgetFiles: 100,
        budgetEvents: 100,
        hysteresis: 0.05,
        watermarks: { warm: 0.6, pressure: 0.8, critical: 0.95 }
      },
      recommendedActions: ['summarize-runtime-events-into-rollups']
    });

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.memory_pressure.action_plan).toEqual({
      artifact_path: '.playbook/memory-pressure-plan.json',
      current_band: 'pressure',
      highest_priority_recommended_actions: ['summarize', 'compact'],
      counts_by_action_type: { dedupe: 1, compact: 1, summarize: 1, evict: 0 }
    });

    logSpy.mockRestore();
  });

  it('treats lifecycle-ready repos as healthy even when doctor reports non-blocking environment errors', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    collectDoctorReport.mockResolvedValue({
      schemaVersion: '1.0',
      command: 'doctor',
      status: 'error',
      summary: { errors: 1, warnings: 0, info: 0 },
      findings: [],
      artifactHygiene: { findings: [] },
      memoryDiagnostics: { findings: [] }
    });
    collectAnalyzeReport.mockResolvedValue(makeAnalyzeReport());
    collectVerifyReport.mockResolvedValue(makeVerifyReport({ ok: true }));
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

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.ok).toBe(true);
    expect(payload.environment.ok).toBe(true);
    expect(payload.adoption.lifecycle_stage).toBe('ready');
    expect(payload.adoption.blockers).toEqual([]);
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


  it('supports proof scope with additive-safe json output', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runBootstrapProof.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-bootstrap-proof',
      repo_root: '/tmp/proof-repo',
      command: 'status',
      mode: 'proof',
      ok: false,
      current_state: 'docs_blocked',
      highest_priority_next_action: 'Run `pnpm playbook init`.',
      summary: {
        current_state: 'Repo is missing required bootstrap docs/governance surfaces.',
        why: 'Bootstrap docs are missing. missing required bootstrap doc: docs/ARCHITECTURE.md',
        what_next: 'Run `pnpm playbook init`.'
      },
      diagnostics: {
        failing_stage: 'docs',
        failing_category: 'required_docs_missing',
        checks: [
          {
            id: 'docs.bootstrap-required',
            stage: 'docs',
            status: 'fail',
            category: 'required_docs_missing',
            summary: 'Bootstrap docs are missing.',
            diagnostics: ['missing required bootstrap doc: docs/ARCHITECTURE.md'],
            next_action: 'Run `pnpm playbook init`.',
            command: null
          }
        ]
      }
    });
    readProofParallelWorkSummary.mockReturnValue({
      decision: 'parallel_plan_ready',
      status: 'docs consolidation ready to apply',
      affected_surfaces: ['1 docs plan-ready lane(s)', '1 merge-ready lane(s)'],
      blockers: ['docs exclusion: docs/CHANGELOG.md'],
      next_action: 'Run `pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json`.',
      counts: { pending: 0, blocked: 0, plan_ready: 1, guard_conflicted: 0, merge_ready: 1 },
      scope: { present: 2, missing: 0, violated: 1, clean: 1, violated_files: ['docs/README.md'], budget_status: 'over_budget' },
      artifacts: {
        lane_state: { available: true, path: '.playbook/lane-state.json' },
        worker_results: { available: true, path: '.playbook/worker-results.json' },
        docs_consolidation_plan: { available: true, path: '.playbook/docs-consolidation-plan.json' },
        guarded_apply: { available: true, path: '.playbook/policy-apply-result.json' },
        execution_outcome_input: { available: true, path: '.playbook/execution-outcome-input.json' }
      },
      details: {
        lane_state: { available: true, blocked_lanes: [], merge_ready_lanes: ['lane-2'], pending_lanes: [], plan_ready_lanes: ['lane-1'] },
        worker_results: { available: true, in_progress_lanes: [], blocked_lanes: [], completed_lanes: ['lane-1'] },
        docs_consolidation_plan: { available: true, executable_targets: 1, excluded_targets: 1, target_docs: ['docs/CHANGELOG.md'], excluded_targets_by_doc: ['docs/CHANGELOG.md'] },
        guarded_apply: { available: true, executed: 1, skipped_requires_review: 0, skipped_blocked: [], failed_execution: [] },
        scope: { over_budget_prompts: 1, prompts_with_scope: 2, prompts_missing_scope: 0 }
      }
    });

    const exitCode = await runStatus(process.cwd(), {
      ci: false,
      format: 'json',
      quiet: false,
      scope: 'proof',
      proofPolicy: 'report'
    });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(logSpy.mock.calls.map((call) => String(call[0])).join('\n'));
    expect(payload).toMatchObject({
      schemaVersion: '1.0',
      command: 'status',
      mode: 'proof',
      proof: {
        ok: false,
        current_state: 'docs_blocked',
        diagnostics: { failing_stage: 'docs', failing_category: 'required_docs_missing' }
      },
      parallel_work: {
        decision: 'parallel_plan_ready',
        status: 'docs consolidation ready to apply',
        counts: { pending: 0, blocked: 0, plan_ready: 1, guard_conflicted: 0, merge_ready: 1 },
        scope: { present: 2, missing: 0, violated: 1, clean: 1, violated_files: ['docs/README.md'], budget_status: 'over_budget' }
      },
      failureDomains: [],
      primaryFailureDomain: null,
      domainBlockers: [],
      domainNextActions: [],
      continuity: expect.any(Object),
      interpretation: {
        pattern: 'interpretation-layer',
        progressive_disclosure: {
          default_view: {
            state: 'docs_blocked',
            why: 'Bootstrap docs are missing. missing required bootstrap doc: docs/ARCHITECTURE.md',
            next_step: {
              command: 'Run `pnpm playbook init`.',
              priority: 'primary'
            }
          },
          secondary_view: {
            blockers: ['Failing stage: docs', 'Failing category: required_docs_missing']
          }
        }
      }
    });
    expect(payload.interpretation.progressive_disclosure.deep_view.raw_truth_refs).toEqual(
      expect.arrayContaining(['proof.summary', 'proof.diagnostics'])
    );
    expect(payload.proof.summary.what_next).toBe('Run `pnpm playbook init`.');
    expect(payload.parallel_work.next_action).toBe('Run `pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json`.');
    expect(payload.continuity).toMatchObject({
      pinned_evidence_refs: expect.any(Array),
      latest_receipt_refs: expect.any(Array),
      stale_or_missing_state: expect.any(Array)
    });

    logSpy.mockRestore();
  });

  it('fails closed for proof scope when explicit proof gate enforcement is enabled', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runBootstrapProof.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-bootstrap-proof',
      repo_root: '/tmp/proof-repo',
      command: 'status',
      mode: 'proof',
      ok: false,
      current_state: 'execution_state_blocked',
      highest_priority_next_action: 'Generate missing execution-state artifacts.',
      summary: {
        current_state: 'Execution state artifacts are missing.',
        why: 'policy apply result is missing',
        what_next: 'Run `pnpm playbook apply --json`.'
      },
      diagnostics: {
        failing_stage: 'execution-state',
        failing_category: 'required_execution_state_missing',
        checks: []
      }
    });
    readProofParallelWorkSummary.mockReturnValue({
      decision: 'parallel_clear',
      status: 'parallel integration clear',
      affected_surfaces: [],
      blockers: [],
      next_action: 'none',
      counts: { pending: 0, blocked: 0, plan_ready: 0, guard_conflicted: 0, merge_ready: 0 },
      scope: { present: 0, missing: 0, violated: 0, clean: 0, violated_files: [], budget_status: 'unknown' },
      artifacts: {
        lane_state: { available: false, path: '.playbook/lane-state.json' },
        worker_results: { available: false, path: '.playbook/worker-results.json' },
        docs_consolidation_plan: { available: false, path: '.playbook/docs-consolidation-plan.json' },
        guarded_apply: { available: false, path: '.playbook/policy-apply-result.json' },
        execution_outcome_input: { available: false, path: '.playbook/execution-outcome-input.json' }
      },
      details: {
        lane_state: { available: false, blocked_lanes: [], merge_ready_lanes: [], pending_lanes: [], plan_ready_lanes: [] },
        worker_results: { available: false, in_progress_lanes: [], blocked_lanes: [], completed_lanes: [] },
        docs_consolidation_plan: { available: false, executable_targets: 0, excluded_targets: 0, target_docs: [], excluded_targets_by_doc: [] },
        guarded_apply: { available: false, executed: 0, skipped_requires_review: 0, skipped_blocked: [], failed_execution: [] },
        scope: { over_budget_prompts: 0, prompts_with_scope: 0, prompts_missing_scope: 0 }
      }
    });

    const exitCode = await runStatus(process.cwd(), {
      ci: false,
      format: 'json',
      quiet: false,
      scope: 'proof',
      proofPolicy: 'enforce'
    });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('proof');
    expect(payload.proof.ok).toBe(false);
    expect(payload.parallel_work.decision).toBe('parallel_clear');

    logSpy.mockRestore();
  });

  it('serializes proof text brief before applying explicit proof gate enforcement', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runBootstrapProof.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-bootstrap-proof',
      repo_root: '/tmp/proof-repo',
      command: 'status',
      mode: 'proof',
      ok: false,
      current_state: 'parallel_work_blocked',
      highest_priority_next_action: 'Resolve blocked lane state.',
      summary: {
        current_state: 'Parallel work is blocked.',
        why: 'A lane is blocked waiting on dependency resolution.',
        what_next: 'Resolve the blocked lane and rerun apply.'
      },
      diagnostics: {
        failing_stage: 'execution-state',
        failing_category: 'required_execution_state_missing',
        checks: []
      }
    });
    readProofParallelWorkSummary.mockReturnValue({
      decision: 'parallel_guard_conflicted',
      status: 'guarded apply conflicted',
      affected_surfaces: ['1 blocked lane(s)'],
      blockers: ['guard conflict: proposal-9'],
      next_action: 'Resolve conflicts and rerun apply.',
      counts: { pending: 0, blocked: 1, plan_ready: 0, guard_conflicted: 1, merge_ready: 0 },
      scope: { present: 1, missing: 0, violated: 0, clean: 1, violated_files: [], budget_status: 'within_budget' },
      artifacts: {
        lane_state: { available: true, path: '.playbook/lane-state.json' },
        worker_results: { available: true, path: '.playbook/worker-results.json' },
        docs_consolidation_plan: { available: false, path: '.playbook/docs-consolidation-plan.json' },
        guarded_apply: { available: true, path: '.playbook/policy-apply-result.json' },
        execution_outcome_input: { available: true, path: '.playbook/execution-outcome-input.json' }
      },
      details: {
        lane_state: { available: true, blocked_lanes: ['lane-a'], merge_ready_lanes: [], pending_lanes: [], plan_ready_lanes: [] },
        worker_results: { available: true, in_progress_lanes: [], blocked_lanes: ['lane-a'], completed_lanes: [] },
        docs_consolidation_plan: { available: false, executable_targets: 0, excluded_targets: 0, target_docs: [], excluded_targets_by_doc: [] },
        guarded_apply: { available: true, executed: 0, skipped_requires_review: 0, skipped_blocked: ['proposal-9'], failed_execution: [] },
        scope: { over_budget_prompts: 0, prompts_with_scope: 1, prompts_missing_scope: 0 }
      }
    });

    const exitCode = await runStatus(process.cwd(), {
      ci: false,
      format: 'text',
      quiet: false,
      scope: 'proof',
      proofPolicy: 'enforce'
    });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Decision: parallel_guard_conflicted');

    logSpy.mockRestore();
  });

  it('reports readable unhealthy proof text with success in report mode', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runBootstrapProof.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-bootstrap-proof',
      repo_root: '/tmp/proof-repo',
      command: 'status',
      mode: 'proof',
      ok: false,
      current_state: 'execution_state_blocked',
      highest_priority_next_action: 'Generate execution-state artifacts.',
      summary: {
        current_state: 'Execution state artifacts are missing.',
        why: 'policy apply result is missing',
        what_next: 'Run `pnpm playbook apply --json`.'
      },
      diagnostics: {
        failing_stage: 'execution-state',
        failing_category: 'required_execution_state_missing',
        checks: []
      }
    });
    readProofParallelWorkSummary.mockReturnValue({
      decision: 'parallel_guard_conflicted',
      status: 'guarded apply conflicted',
      affected_surfaces: ['1 blocked lane(s)'],
      blockers: ['guard conflict: proposal-9'],
      next_action: 'Resolve conflicts and rerun apply.',
      counts: { pending: 0, blocked: 1, plan_ready: 0, guard_conflicted: 1, merge_ready: 0 },
      scope: { present: 1, missing: 0, violated: 0, clean: 1, violated_files: [], budget_status: 'within_budget' },
      artifacts: {
        lane_state: { available: true, path: '.playbook/lane-state.json' },
        worker_results: { available: true, path: '.playbook/worker-results.json' },
        docs_consolidation_plan: { available: false, path: '.playbook/docs-consolidation-plan.json' },
        guarded_apply: { available: true, path: '.playbook/policy-apply-result.json' },
        execution_outcome_input: { available: true, path: '.playbook/execution-outcome-input.json' }
      },
      details: {
        lane_state: { available: true, blocked_lanes: ['lane-a'], merge_ready_lanes: [], pending_lanes: [], plan_ready_lanes: [] },
        worker_results: { available: true, in_progress_lanes: [], blocked_lanes: ['lane-a'], completed_lanes: [] },
        docs_consolidation_plan: { available: false, executable_targets: 0, excluded_targets: 0, target_docs: [], excluded_targets_by_doc: [] },
        guarded_apply: { available: true, executed: 0, skipped_requires_review: 0, skipped_blocked: ['proposal-9'], failed_execution: [] },
        scope: { over_budget_prompts: 0, prompts_with_scope: 1, prompts_missing_scope: 0 }
      }
    });

    const exitCode = await runStatus(process.cwd(), {
      ci: false,
      format: 'text',
      quiet: false,
      scope: 'proof',
      proofPolicy: 'report'
    });

    expect(exitCode).toBe(ExitCode.Success);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Decision: parallel_guard_conflicted');

    logSpy.mockRestore();
  });

  it('renders proof text as a compact operator brief for parallel work state', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runBootstrapProof.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-bootstrap-proof',
      repo_root: '/tmp/proof-repo',
      command: 'status',
      mode: 'proof',
      ok: true,
      current_state: 'governed_consumer_ready',
      highest_priority_next_action: 'No action required.',
      summary: {
        current_state: 'Repo passed the governed Playbook bootstrap proof.',
        why: 'Runtime, CLI resolution, initialization, docs, artifacts, execution state, and governance checks all passed.',
        what_next: 'No action required.'
      },
      diagnostics: {
        failing_stage: null,
        failing_category: null,
        checks: []
      }
    });
    const rawLaneState = JSON.stringify({
      lanes: [
        { lane_id: 'lane-a', status: 'ready', blocked_reasons: [], protected_doc_consolidation: { stage: 'plan_ready' } },
        { lane_id: 'lane-b', status: 'blocked', blocked_reasons: ['waiting on dependency lane lane-a'], protected_doc_consolidation: { stage: 'not_applicable' } },
        { lane_id: 'lane-c', status: 'merge_ready', blocked_reasons: [], protected_doc_consolidation: { stage: 'applied' } }
      ],
      blocked_lanes: ['lane-b'],
      merge_ready_lanes: ['lane-c']
    });
    readProofParallelWorkSummary.mockReturnValue({
      decision: 'parallel_guard_conflicted',
      status: 'guarded apply conflicted',
      affected_surfaces: ['1 pending lane(s)', '1 blocked lane(s)', '1 docs plan-ready lane(s)', '1 guarded-apply conflict(s)', '1 merge-ready lane(s)'],
      blockers: ['blocked lane: lane-b', 'guard conflict: proposal-9'],
      next_action: 'Inspect .playbook/policy-apply-result.json blocked/failed entries, resolve guard conflicts, then rerun `pnpm playbook apply --json`.',
      counts: { pending: 1, blocked: 1, plan_ready: 1, guard_conflicted: 1, merge_ready: 1 },
      scope: { present: 2, missing: 0, violated: 0, clean: 2, violated_files: [], budget_status: 'within_budget' },
      artifacts: {
        lane_state: { available: true, path: '.playbook/lane-state.json' },
        worker_results: { available: true, path: '.playbook/worker-results.json' },
        docs_consolidation_plan: { available: true, path: '.playbook/docs-consolidation-plan.json' },
        guarded_apply: { available: true, path: '.playbook/policy-apply-result.json' },
        execution_outcome_input: { available: true, path: '.playbook/execution-outcome-input.json' }
      },
      details: {
        lane_state: { available: true, blocked_lanes: ['lane-b'], merge_ready_lanes: ['lane-c'], pending_lanes: ['lane-a'], plan_ready_lanes: ['lane-a'] },
        worker_results: { available: true, in_progress_lanes: ['lane-a'], blocked_lanes: [], completed_lanes: ['lane-c'] },
        docs_consolidation_plan: { available: true, executable_targets: 1, excluded_targets: 0, target_docs: ['docs/CHANGELOG.md'], excluded_targets_by_doc: [] },
        guarded_apply: { available: true, executed: 1, skipped_requires_review: 0, skipped_blocked: ['proposal-9'], failed_execution: [] },
        scope: { over_budget_prompts: 0, prompts_with_scope: 2, prompts_missing_scope: 0 }
      }
    });
    classifyProofFailureDomains.mockReturnValue({
      failureDomains: ['sync_drift'],
      primaryFailureDomain: 'sync_drift',
      domainBlockers: [{ domain: 'sync_drift', signal: 'parallel_work.blockers', summary: 'guard conflict: proposal-9' }],
      domainNextActions: [{ domain: 'sync_drift', action: 'Inspect .playbook/policy-apply-result.json blocked/failed entries, resolve guard conflicts, then rerun `pnpm playbook apply --json`.' }]
    });

    const exitCode = await runStatus(process.cwd(), {
      ci: false,
      format: 'text',
      quiet: false,
      scope: 'proof',
      proofPolicy: 'report'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const output = String(logSpy.mock.calls[0]?.[0]);
    expect(output).toContain('Decision: parallel_guard_conflicted');
    expect(output).toContain('Status: guarded apply conflicted');
    expect(output).not.toContain('Why:');
    expect(output).toContain('Affected surfaces: 1 pending lane(s); 1 blocked lane(s); 1 docs plan-ready lane(s); 1 guarded-apply conflict(s); 1 merge-ready lane(s)');
    expect(output).toContain('Blockers: sync_drift: guard conflict: proposal-9');
    expect(output).toContain('Next action: Inspect .playbook/policy-apply-result.json blocked/failed entries, resolve guard conflicts, then rerun `pnpm playbook apply --json`.');
    expect(output).toContain('Failure ownership');
    expect(output).toContain('Continuity');
    expect(output).toContain('Scope');
    expect(output).toContain('- present=2');
    expect(output).toContain('- violated=0');
    expect(output).toContain('- budget=within_budget');
    expect(output).toContain('- primary=sync_drift');
    expect(output).toContain('- pending=1');
    expect(output).toContain('- blocked=1');
    expect(output).not.toContain('Artifacts:');
    expect(output).not.toContain(rawLaneState);
    expect(output).not.toContain('"lane_id":"lane-a"');
    expect(output).not.toContain('merge_ready_lanes');
    expect(output).not.toContain('blocked_reasons');

    logSpy.mockRestore();
  });

});
