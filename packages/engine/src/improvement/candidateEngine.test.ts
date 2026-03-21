import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RemediationStatusArtifact, TestAutofixArtifact, TestAutofixRemediationHistoryArtifact } from '@zachariahredfield/playbook-core';
import { generateImprovementCandidates } from './candidateEngine.js';

type EventSeed = Record<string, unknown>;

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-improvement-engine-'));

const writeLearningState = (repo: string, validationCostPressure = 0.2): void => {
  const learningPath = path.join(repo, '.playbook', 'learning-state.json');
  fs.mkdirSync(path.dirname(learningPath), { recursive: true });
  fs.writeFileSync(
    learningPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'learning-state-snapshot',
        generatedAt: '2026-01-01T00:00:00.000Z',
        proposalOnly: true,
        sourceArtifacts: {
          outcomeTelemetry: { available: true, recordCount: 1, artifactPath: '.playbook/outcome-telemetry.json' },
          processTelemetry: { available: true, recordCount: 1, artifactPath: '.playbook/process-telemetry.json' },
          taskExecutionProfile: { available: true, recordCount: 1, artifactPath: '.playbook/task-execution-profile.json' }
        },
        metrics: {
          sample_size: 12,
          first_pass_yield: 0.9,
          retry_pressure: { docs_only: 0.1 },
          validation_load_ratio: 0.2,
          route_efficiency_score: { docs_only: 0.9 },
          smallest_sufficient_route_score: 0.9,
          parallel_safety_realized: 0.95,
          router_fit_score: 0.9,
          reasoning_scope_efficiency: 0.9,
          validation_cost_pressure: validationCostPressure,
          pattern_family_effectiveness_score: { docs_only: 0.9 },
          portability_confidence: 0.8
        },
        confidenceSummary: {
          sample_size_score: 0.8,
          coverage_score: 0.8,
          evidence_completeness_score: 0.9,
          overall_confidence: 0.9,
          open_questions: []
        }
      },
      null,
      2
    )
  );
};


const writeProcessTelemetry = (repo: string, records: Array<Record<string, unknown>>): void => {
  const telemetryPath = path.join(repo, '.playbook', 'process-telemetry.json');
  fs.mkdirSync(path.dirname(telemetryPath), { recursive: true });
  fs.writeFileSync(
    telemetryPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'process-telemetry',
        generatedAt: '2026-01-01T00:00:00.000Z',
        records,
        summary: {
          total_records: records.length,
          total_task_duration_ms: 1000,
          average_task_duration_ms: 250,
          total_retry_count: 0,
          first_pass_success_count: records.length,
          average_merge_conflict_risk: 0,
          total_files_touched_unique: 1,
          total_validators_run_unique: 1,
          task_family_counts: { docs_only: records.length },
          validators_run_counts: {},
          reasoning_scope_counts: { narrow: records.length, module: 0, repository: 0, 'cross-repo': 0 },
          route_id_counts: {},
          task_profile_id_counts: {},
          rule_packs_selected_counts: {},
          required_validations_selected_counts: {},
          optional_validations_selected_counts: {},
          total_validation_duration_ms: 0,
          total_planning_duration_ms: 0,
          total_apply_duration_ms: 0,
          human_intervention_required_count: 0,
          actual_merge_conflict_count: 0,
          average_parallel_lane_count: 1,
          over_validation_signal_count: 0,
          under_validation_signal_count: 0,
          router_accuracy_records: records.length,
          average_router_fit_score: 0.7,
          average_lane_delta: 1,
          average_validation_delta: 1
        }
      },
      null,
      2
    )
  );
};

const writeEvents = (repo: string, events: EventSeed[]): void => {
  const eventsDir = path.join(repo, '.playbook', 'memory', 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  events.forEach((event, index) => {
    fs.writeFileSync(path.join(eventsDir, `event-${index}.json`), JSON.stringify(event, null, 2));
  });
};

const writeArtifact = (repo: string, relativePath: string, value: unknown): void => {
  const artifactPath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(value, null, 2));
};

const remediationLatest = (overrides: Partial<TestAutofixArtifact> = {}): TestAutofixArtifact => ({
  schemaVersion: '1.0',
  kind: 'test-autofix',
  command: 'test-autofix',
  generatedAt: '2026-03-21T00:00:00.000Z',
  run_id: 'test-autofix-run-0004',
  input: 'failure.log',
  source_triage: { path: 'triage.json', command: 'test-triage' },
  source_fix_plan: { path: 'fix-plan.json', command: 'test-fix-plan' },
  source_apply: { path: 'apply.json', command: 'apply' },
  remediation_history_path: '.playbook/test-autofix-history.json',
  mode: 'apply',
  would_apply: false,
  confidence_threshold: 0.7,
  failure_signatures: ['sig-repeat'],
  history_summary: {
    matched_signatures: ['sig-repeat'],
    matching_run_ids: ['test-autofix-run-0001', 'test-autofix-run-0002', 'test-autofix-run-0003'],
    prior_final_statuses: ['blocked_low_confidence', 'fixed'],
    prior_applied_repair_classes: ['snapshot_refresh'],
    prior_successful_repair_classes: ['snapshot_refresh'],
    repeated_failed_repair_attempts: [],
    provenance_run_ids: ['test-autofix-run-0001']
  },
  preferred_repair_class: 'snapshot_refresh',
  autofix_confidence: 0.74,
  confidence_reasoning: ['confidence evidence'],
  retry_policy_decision: 'allow_with_preferred_repair_class',
  retry_policy_reason: 'history matched',
  apply_result: { attempted: false, ok: false, exitCode: 0, applied: 0, skipped: 0, unsupported: 0, failed: 0, message: null },
  verification_result: { attempted: false, ok: false, total: 0, passed: 0, failed: 0 },
  executed_verification_commands: [],
  applied_task_ids: [],
  excluded_finding_summary: { total: 0, review_required: 0, by_reason: [] },
  final_status: 'blocked_low_confidence',
  stop_reasons: ['blocked'],
  reason: 'needs review',
  ...overrides
});

const remediationHistory = (runs: TestAutofixRemediationHistoryArtifact['runs']): TestAutofixRemediationHistoryArtifact => ({
  schemaVersion: '1.0',
  kind: 'test-autofix-remediation-history',
  generatedAt: '2026-03-21T00:00:00.000Z',
  runs
});

const remediationStatus = (history: TestAutofixRemediationHistoryArtifact, latest: TestAutofixArtifact): RemediationStatusArtifact => ({
  schemaVersion: '1.0',
  kind: 'remediation-status',
  command: 'remediation-status',
  generatedAt: '2026-03-21T00:00:00.000Z',
  source: {
    latest_result_path: '.playbook/test-autofix.json',
    remediation_history_path: '.playbook/test-autofix-history.json'
  },
  latest_run: {
    run_id: latest.run_id,
    generatedAt: latest.generatedAt,
    input: latest.input,
    final_status: latest.final_status,
    retry_policy_decision: latest.retry_policy_decision,
    retry_policy_reason: latest.retry_policy_reason,
    mode: latest.mode,
    would_apply: latest.would_apply,
    confidence_threshold: latest.confidence_threshold,
    autofix_confidence: latest.autofix_confidence,
    confidence_reasoning: latest.confidence_reasoning,
    preferred_repair_class: latest.preferred_repair_class,
    failure_signatures: latest.failure_signatures,
    blocked_signatures: latest.final_status === 'blocked' ? latest.failure_signatures : [],
    review_required_signatures: latest.final_status === 'review_required_only' ? latest.failure_signatures : [],
    safe_to_retry_signatures: [],
    stop_reasons: latest.stop_reasons
  },
  blocked_signatures: ['sig-repeat'],
  review_required_signatures: ['sig-review'],
  safe_to_retry_signatures: [],
  stable_failure_signatures: [],
  repeat_policy_decisions: [],
  preferred_repair_classes: [],
  recent_final_statuses: [],
  telemetry: {
    confidence_buckets: [],
    failure_classes: [],
    blocked_low_confidence_runs: history.runs.filter((entry) => entry.final_status === 'blocked_low_confidence').length,
    top_repeated_blocked_signatures: [],
    dry_run_runs: 0,
    apply_runs: history.runs.length,
    dry_run_to_apply_ratio: '0:1',
    repeat_policy_block_counts: [],
    conservative_confidence_signal: {
      confidence_may_be_conservative: true,
      reasoning: 'candidate-only threshold review',
      supporting_failure_signatures: ['sig-repeat'],
      supporting_failure_classes: ['snapshot_drift']
    },
    failure_class_rollup: [],
    repair_class_rollup: [],
    blocked_signature_rollup: [
      {
        failure_signature: 'sig-repeat',
        blocked_count: 2,
        latest_run_id: latest.run_id,
        latest_generatedAt: latest.generatedAt,
        historical_success_count: 1
      }
    ],
    threshold_counterfactuals: [
      {
        threshold: 0.7,
        eligible_runs: 3,
        successful_eligible_runs: 1,
        blocked_low_confidence_runs: 2,
        blocked_runs_that_would_clear: 2,
        latest_run_would_clear: true,
        advisory_note: 'advisory only'
      }
    ],
    dry_run_vs_apply_delta: {
      dry_run_runs: 0,
      apply_runs: history.runs.length,
      dry_run_success_rate: 0,
      apply_success_rate: 0.66,
      success_rate_delta: 0.66,
      blocked_delta: 2,
      advisory_note: 'advisory only'
    },
    manual_review_pressure: {
      review_required_runs: 2,
      blocked_runs: 2,
      total_manual_pressure_runs: 4,
      top_review_required_signatures: [],
      top_blocked_signatures: [],
      advisory_note: 'advisory only'
    }
  },
  remediation_history: history.runs,
  latest_result: latest
});

describe('improvement candidate evidence gating', () => {
  it('promotes AUTO-SAFE with repeated multi-run evidence', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.25);
    writeEvents(
      repo,
      Array.from({ length: 5 }, (_, index) => ({
        schemaVersion: '1.0',
        event_type: 'worker_assignment',
        event_id: `worker-${index}`,
        timestamp: `2026-01-0${index < 3 ? 1 : 2}T00:00:00.000Z`,
        lane_id: `lane-${index}`,
        worker_id: 'planner_worker',
        assignment_status: 'blocked'
      }))
    );

    const artifact = generateImprovementCandidates(repo);
    const autoSafe = artifact.candidates.find((candidate) => candidate.gating_tier === 'AUTO-SAFE');

    expect(autoSafe).toBeDefined();
    expect(autoSafe?.required_review).toBe(false);
    expect(autoSafe?.evidence_count).toBe(5);
    expect(autoSafe?.supporting_runs).toBe(2);
    expect(artifact.rejected_candidates).toHaveLength(0);

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('creates CONVERSATIONAL proposal for reviewable routing change', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.9);
    writeEvents(
      repo,
      Array.from({ length: 3 }, (_, index) => ({
        schemaVersion: '1.0',
        event_type: 'route_decision',
        event_id: `route-${index}`,
        timestamp: `2026-01-0${index + 1}T00:00:00.000Z`,
        task_text: 'optimize docs path',
        task_family: 'docs_only',
        route_id: 'docs_default',
        confidence: 0.95
      }))
    );

    const artifact = generateImprovementCandidates(repo);
    const conversational = artifact.candidates.find((candidate) => candidate.gating_tier === 'CONVERSATIONAL');

    expect(conversational).toBeDefined();
    expect(conversational?.required_review).toBe(true);
    expect(conversational?.candidate_id).toBe('routing_docs_overvalidation');

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('creates GOVERNANCE proposal for ontology/doctrine review', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.2);
    writeEvents(
      repo,
      Array.from({ length: 3 }, (_, index) => ({
        schemaVersion: '1.0',
        event_type: 'improvement_candidate',
        event_id: `ontology-${index}`,
        timestamp: `2026-01-0${index + 1}T00:00:00.000Z`,
        candidate_id: `ontology-${index}`,
        source: 'ontology-observer',
        summary: 'Ontology drift in route taxonomy',
        confidence: 0.9
      }))
    );

    const artifact = generateImprovementCandidates(repo);
    const governance = artifact.candidates.find((candidate) => candidate.gating_tier === 'GOVERNANCE');

    expect(governance).toBeDefined();
    expect(governance?.required_review).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('rejects candidate with insufficient evidence', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.2);
    writeEvents(repo, [
      {
        schemaVersion: '1.0',
        event_type: 'worker_assignment',
        event_id: 'worker-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        lane_id: 'lane-1',
        worker_id: 'planner_worker',
        assignment_status: 'blocked'
      }
    ]);

    const artifact = generateImprovementCandidates(repo);

    expect(artifact.candidates).toHaveLength(0);
    expect(artifact.rejected_candidates.length).toBeGreaterThan(0);
    expect(artifact.rejected_candidates[0]?.blocking_reasons.some((reason) => reason.includes('insufficient_evidence_count'))).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });
});


describe('router recommendation engine', () => {
  it('emits repeated over-fragmentation recommendation', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.4);
    writeProcessTelemetry(
      repo,
      Array.from({ length: 4 }, (_, index) => ({
        id: `p-${index}`,
        recordedAt: `2026-01-0${index + 1}T00:00:00.000Z`,
        task_family: 'docs_only',
        route_id: 'docs_default',
        task_duration_ms: 100,
        files_touched: ['docs/ARCHITECTURE.md'],
        validators_run: ['pnpm -r build'],
        retry_count: 0,
        merge_conflict_risk: 0,
        first_pass_success: true,
        prompt_size: 100,
        reasoning_scope: 'narrow',
        predicted_parallel_lanes: 4,
        actual_parallel_lanes: 1,
        predicted_validation_cost: 2,
        actual_validation_cost: 2,
        router_fit_score: 0.4
      }))
    );

    const artifact = generateImprovementCandidates(repo);
    expect(artifact.router_recommendations.recommendations.some((entry) => entry.recommendation_id === 'router_over_fragmented_docs_only')).toBe(true);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('emits repeated under-fragmentation recommendation', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.4);
    writeProcessTelemetry(
      repo,
      Array.from({ length: 4 }, (_, index) => ({
        id: `u-${index}`,
        recordedAt: `2026-01-0${index + 1}T00:00:00.000Z`,
        task_family: 'cli_command',
        route_id: 'cli_default',
        task_duration_ms: 100,
        files_touched: ['packages/cli/src/commands/improve.ts'],
        validators_run: ['pnpm -r build'],
        retry_count: 0,
        merge_conflict_risk: 0,
        first_pass_success: true,
        prompt_size: 100,
        reasoning_scope: 'narrow',
        predicted_parallel_lanes: 1,
        actual_parallel_lanes: 3,
        predicted_validation_cost: 2,
        actual_validation_cost: 2,
        router_fit_score: 0.45
      }))
    );

    const artifact = generateImprovementCandidates(repo);
    expect(artifact.router_recommendations.recommendations.some((entry) => entry.recommendation_id === 'router_under_fragmented_cli_command')).toBe(true);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('rejects recommendation with insufficient evidence', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.4);
    writeProcessTelemetry(repo, [
      {
        id: 'r-1',
        recordedAt: '2026-01-01T00:00:00.000Z',
        task_family: 'docs_only',
        route_id: 'docs_default',
        task_duration_ms: 100,
        files_touched: ['docs/ARCHITECTURE.md'],
        validators_run: ['pnpm -r build'],
        retry_count: 0,
        merge_conflict_risk: 0,
        first_pass_success: true,
        prompt_size: 100,
        reasoning_scope: 'narrow',
        predicted_parallel_lanes: 4,
        actual_parallel_lanes: 1,
        predicted_validation_cost: 2,
        actual_validation_cost: 2,
        router_fit_score: 0.5
      }
    ]);

    const artifact = generateImprovementCandidates(repo);
    expect(artifact.router_recommendations.recommendations).toHaveLength(0);
    expect(artifact.router_recommendations.rejected_recommendations.some((entry) => entry.blocking_reasons.some((reason) => reason.includes('insufficient_evidence_count')))).toBe(true);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('gates mismatched validation posture as governance-tier', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.9);
    writeProcessTelemetry(
      repo,
      Array.from({ length: 3 }, (_, index) => ({
        id: `g-${index}`,
        recordedAt: `2026-01-0${index + 1}T00:00:00.000Z`,
        task_family: 'contracts_schema',
        route_id: 'contracts_default',
        task_duration_ms: 100,
        files_touched: ['packages/core/src/telemetry/types.ts'],
        validators_run: ['pnpm -r build'],
        retry_count: 0,
        merge_conflict_risk: 0,
        first_pass_success: true,
        prompt_size: 100,
        reasoning_scope: 'narrow',
        predicted_parallel_lanes: 1,
        actual_parallel_lanes: 1,
        predicted_validation_cost: 5,
        actual_validation_cost: 1,
        router_fit_score: 0.7
      }))
    );

    const artifact = generateImprovementCandidates(repo);
    const recommendation = artifact.router_recommendations.recommendations.find(
      (entry) => entry.recommendation_id === 'router_validation_posture_contracts_schema'
    );
    expect(recommendation).toBeDefined();
    expect(recommendation?.gating_tier).toBe('GOVERNANCE');
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

describe('remediation learning candidates', () => {
  it('turns repeated blocked signatures into candidate-only investigation suggestions with provenance', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.4);
    const historyArtifact = remediationHistory([
      {
        run_id: 'test-autofix-run-0001',
        generatedAt: '2026-03-18T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'allow_with_preferred_repair_class',
        confidence_threshold: 0.7,
        autofix_confidence: 0.72,
        failure_signatures: ['sig-repeat'],
        triage_classifications: [{ failure_signature: 'sig-repeat', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }],
        admitted_findings: ['sig-repeat'],
        excluded_findings: [],
        applied_task_ids: ['task-1'],
        applied_repair_classes: ['snapshot_refresh'],
        files_touched: ['tests/a.snap'],
        verification_commands: ['pnpm test'],
        verification_outcomes: [{ command: 'pnpm test', exitCode: 1, ok: false }],
        final_status: 'blocked_low_confidence',
        stop_reasons: ['blocked'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      },
      {
        run_id: 'test-autofix-run-0002',
        generatedAt: '2026-03-19T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'allow_with_preferred_repair_class',
        confidence_threshold: 0.7,
        autofix_confidence: 0.74,
        failure_signatures: ['sig-repeat'],
        triage_classifications: [{ failure_signature: 'sig-repeat', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }],
        admitted_findings: ['sig-repeat'],
        excluded_findings: [],
        applied_task_ids: ['task-2'],
        applied_repair_classes: ['snapshot_refresh'],
        files_touched: ['tests/a.snap'],
        verification_commands: ['pnpm test'],
        verification_outcomes: [{ command: 'pnpm test', exitCode: 1, ok: false }],
        final_status: 'blocked_low_confidence',
        stop_reasons: ['blocked'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      },
      {
        run_id: 'test-autofix-run-0003',
        generatedAt: '2026-03-20T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'allow_with_preferred_repair_class',
        confidence_threshold: 0.7,
        autofix_confidence: 0.82,
        failure_signatures: ['sig-repeat', 'sig-review'],
        triage_classifications: [{ failure_signature: 'sig-repeat', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }],
        admitted_findings: ['sig-repeat'],
        excluded_findings: [],
        applied_task_ids: ['task-3'],
        applied_repair_classes: ['snapshot_refresh'],
        files_touched: ['tests/a.snap'],
        verification_commands: ['pnpm test'],
        verification_outcomes: [{ command: 'pnpm test', exitCode: 0, ok: true }],
        final_status: 'review_required_only',
        stop_reasons: ['manual review'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      },
      {
        run_id: 'test-autofix-run-0004',
        generatedAt: '2026-03-21T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'allow_with_preferred_repair_class',
        confidence_threshold: 0.7,
        autofix_confidence: 0.8,
        failure_signatures: ['sig-repeat', 'sig-review'],
        triage_classifications: [{ failure_signature: 'sig-repeat', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }],
        admitted_findings: ['sig-repeat'],
        excluded_findings: [],
        applied_task_ids: ['task-4'],
        applied_repair_classes: ['snapshot_refresh'],
        files_touched: ['tests/a.snap'],
        verification_commands: ['pnpm test'],
        verification_outcomes: [{ command: 'pnpm test', exitCode: 0, ok: true }],
        final_status: 'fixed',
        stop_reasons: ['fixed'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      }
    ]);
    const latestArtifact = remediationLatest({ final_status: 'fixed', autofix_confidence: 0.8 });
    writeArtifact(repo, '.playbook/test-autofix-history.json', historyArtifact);
    writeArtifact(repo, '.playbook/test-autofix.json', latestArtifact);
    writeArtifact(repo, '.playbook/remediation-status.json', remediationStatus(historyArtifact, latestArtifact));

    const artifact = generateImprovementCandidates(repo);
    const blockedCandidate = artifact.candidates.find((candidate) => candidate.proposal_kind === 'repair_class_investigation');
    const thresholdCandidate = artifact.candidates.find((candidate) => candidate.proposal_kind === 'threshold_tuning');
    const blockedDoctrineCandidate = artifact.doctrine_candidates.candidates.find((candidate) => candidate.candidate_id === 'improvement_remediation_blocked_signature_sig_repeat');

    expect(blockedCandidate).toBeDefined();
    expect(blockedCandidate?.category).toBe('remediation_learning');
    expect(blockedCandidate?.required_review).toBe(true);
    expect(blockedCandidate?.gating_tier).toBe('CONVERSATIONAL');
    expect(blockedCandidate?.provenance?.failure_signatures).toContain('sig-repeat');
    expect(blockedCandidate?.provenance?.repair_classes).toContain('snapshot_refresh');
    expect(thresholdCandidate?.required_review).toBe(true);
    expect(thresholdCandidate?.gating_tier).toBe('GOVERNANCE');
    expect(thresholdCandidate?.suggested_action).toContain('candidate-only threshold tuning review');
    expect(blockedDoctrineCandidate).toBeDefined();
    expect(blockedDoctrineCandidate?.gating_tier).toBe('CONVERSATIONAL');

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('emits review-heavy and low-confidence-success doctrine candidates without changing execution paths', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.35);
    const historyArtifact = remediationHistory([
      {
        run_id: 'test-autofix-run-0001',
        generatedAt: '2026-03-18T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'review_required_repeat_failure',
        confidence_threshold: 0.7,
        autofix_confidence: 0.8,
        failure_signatures: ['sig-review'],
        triage_classifications: [{ failure_signature: 'sig-review', failure_kind: 'contract_gap', repair_class: 'fixture_update', package: null, test_file: null, test_name: null }],
        admitted_findings: ['sig-review'],
        excluded_findings: [],
        applied_task_ids: ['task-1'],
        applied_repair_classes: ['fixture_update'],
        files_touched: ['tests/fixture.json'],
        verification_commands: ['pnpm test'],
        verification_outcomes: [{ command: 'pnpm test', exitCode: 0, ok: true }],
        final_status: 'review_required_only',
        stop_reasons: ['manual review'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      },
      {
        run_id: 'test-autofix-run-0002',
        generatedAt: '2026-03-19T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'review_required_repeat_failure',
        confidence_threshold: 0.7,
        autofix_confidence: 0.79,
        failure_signatures: ['sig-review'],
        triage_classifications: [{ failure_signature: 'sig-review', failure_kind: 'contract_gap', repair_class: 'fixture_update', package: null, test_file: null, test_name: null }],
        admitted_findings: ['sig-review'],
        excluded_findings: [],
        applied_task_ids: ['task-2'],
        applied_repair_classes: ['fixture_update'],
        files_touched: ['tests/fixture.json'],
        verification_commands: ['pnpm test'],
        verification_outcomes: [{ command: 'pnpm test', exitCode: 0, ok: true }],
        final_status: 'review_required_only',
        stop_reasons: ['manual review'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      },
      {
        run_id: 'test-autofix-run-0003',
        generatedAt: '2026-03-20T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'allow_with_preferred_repair_class',
        confidence_threshold: 0.7,
        autofix_confidence: 0.76,
        failure_signatures: ['sig-fixture'],
        triage_classifications: [{ failure_signature: 'sig-fixture', failure_kind: 'fixture_gap', repair_class: 'fixture_update', package: null, test_file: null, test_name: null }],
        admitted_findings: ['sig-fixture'],
        excluded_findings: [],
        applied_task_ids: ['task-3'],
        applied_repair_classes: ['fixture_update'],
        files_touched: ['tests/fixture.json'],
        verification_commands: ['pnpm test'],
        verification_outcomes: [{ command: 'pnpm test', exitCode: 0, ok: true }],
        final_status: 'fixed',
        stop_reasons: ['fixed'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      }
    ]);
    const latestArtifact = remediationLatest({ run_id: 'test-autofix-run-0003', final_status: 'fixed', failure_signatures: ['sig-fixture'], autofix_confidence: 0.76 });
    writeArtifact(repo, '.playbook/test-autofix-history.json', historyArtifact);
    writeArtifact(repo, '.playbook/test-autofix.json', latestArtifact);
    writeArtifact(repo, '.playbook/remediation-status.json', remediationStatus(historyArtifact, latestArtifact));

    const artifact = generateImprovementCandidates(repo);
    const verifyCandidate = artifact.candidates.find(
      (candidate) => candidate.candidate_id === 'remediation_verify_rule_improvement_review_pressure'
    );
    const fixtureCandidate = artifact.candidates.find(
      (candidate) => candidate.candidate_id === 'remediation_fixture_contract_hardening_low_confidence_success'
    );
    const verifyDoctrineCandidate = artifact.doctrine_candidates.candidates.find(
      (candidate) => candidate.candidate_id === 'improvement_remediation_verify_rule_improvement_review_pressure'
    );
    const fixtureDoctrineCandidate = artifact.doctrine_candidates.candidates.find(
      (candidate) => candidate.candidate_id === 'improvement_remediation_fixture_contract_hardening_low_confidence_success'
    );

    expect(verifyCandidate?.proposal_kind).toBe('verify_rule_improvement');
    expect(verifyCandidate?.required_review).toBe(true);
    expect(verifyCandidate?.gating_tier).toBe('GOVERNANCE');
    expect(fixtureCandidate?.proposal_kind).toBe('fixture_contract_hardening');
    expect(fixtureCandidate?.required_review).toBe(true);
    expect(fixtureCandidate?.gating_tier).toBe('CONVERSATIONAL');
    expect(artifact.candidates.some((candidate) => candidate.proposal_kind === 'docs_doctrine_update')).toBe(true);
    expect(verifyDoctrineCandidate).toBeDefined();
    expect(verifyDoctrineCandidate?.gating_tier).toBe('GOVERNANCE');
    expect(fixtureDoctrineCandidate).toBeDefined();
    expect(fixtureDoctrineCandidate?.gating_tier).toBe('CONVERSATIONAL');
    expect(artifact.candidates.every((candidate) => candidate.category !== 'routing' || candidate.provenance?.remediation_source === undefined)).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('keeps remediation-learning proposals review-gated even when action text would otherwise fall through generic tier matching', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.4);
    const historyArtifact = remediationHistory([
      {
        run_id: 'test-autofix-run-0001',
        generatedAt: '2026-03-18T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'allow_with_preferred_repair_class',
        confidence_threshold: 0.7,
        autofix_confidence: 0.75,
        failure_signatures: ['sig-repeat'],
        triage_classifications: [],
        admitted_findings: ['sig-repeat'],
        excluded_findings: [],
        applied_task_ids: ['task-1'],
        applied_repair_classes: ['snapshot_refresh'],
        files_touched: [],
        verification_commands: [],
        verification_outcomes: [],
        final_status: 'blocked_low_confidence',
        stop_reasons: ['blocked'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      },
      {
        run_id: 'test-autofix-run-0002',
        generatedAt: '2026-03-19T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'allow_with_preferred_repair_class',
        confidence_threshold: 0.7,
        autofix_confidence: 0.77,
        failure_signatures: ['sig-repeat'],
        triage_classifications: [],
        admitted_findings: ['sig-repeat'],
        excluded_findings: [],
        applied_task_ids: ['task-2'],
        applied_repair_classes: ['snapshot_refresh'],
        files_touched: [],
        verification_commands: [],
        verification_outcomes: [],
        final_status: 'review_required_only',
        stop_reasons: ['review'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      },
      {
        run_id: 'test-autofix-run-0003',
        generatedAt: '2026-03-20T00:00:00.000Z',
        input: { path: 'failure.log' },
        mode: 'apply',
        retry_policy_decision: 'allow_with_preferred_repair_class',
        confidence_threshold: 0.7,
        autofix_confidence: 0.79,
        failure_signatures: ['sig-repeat'],
        triage_classifications: [],
        admitted_findings: ['sig-repeat'],
        excluded_findings: [],
        applied_task_ids: ['task-3'],
        applied_repair_classes: ['snapshot_refresh'],
        files_touched: [],
        verification_commands: [],
        verification_outcomes: [],
        final_status: 'fixed',
        stop_reasons: ['fixed'],
        provenance: { failure_log_path: 'failure.log', triage_artifact_path: 'triage.json', fix_plan_artifact_path: 'plan.json', apply_result_path: 'apply.json', autofix_result_path: 'autofix.json' }
      }
    ]);
    const latestArtifact = remediationLatest({ run_id: 'test-autofix-run-0003', final_status: 'fixed', autofix_confidence: 0.79 });
    writeArtifact(repo, '.playbook/test-autofix-history.json', historyArtifact);
    writeArtifact(repo, '.playbook/test-autofix.json', latestArtifact);
    writeArtifact(repo, '.playbook/remediation-status.json', remediationStatus(historyArtifact, latestArtifact));

    const artifact = generateImprovementCandidates(repo);
    const remediationCandidates = artifact.candidates.filter((candidate) => candidate.category === 'remediation_learning');

    expect(remediationCandidates.length).toBeGreaterThan(0);
    expect(remediationCandidates.every((candidate) => candidate.required_review)).toBe(true);
    expect(remediationCandidates.every((candidate) => candidate.gating_tier !== 'AUTO-SAFE')).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });
});


describe('opportunity analysis', () => {
  it('returns a deterministic ranked next-best improvement report with evidence pointers', () => {
    const repo = createRepo();
    writeLearningState(repo, 0.3);

    const fanoutFile = path.join(repo, 'packages', 'cli', 'src', 'commands', 'fanout.ts');
    fs.mkdirSync(path.dirname(fanoutFile), { recursive: true });
    fs.writeFileSync(
      fanoutFile,
      [
        "const artifacts = [",
        "  '.playbook/a.json',",
        "  '.playbook/b.json',",
        "  '.playbook/c.json',",
        "  '.playbook/d.json',",
        "  '.playbook/e.json',",
        "  '.playbook/f.json'",
        '];'
      ].join('\n')
    );

    const derivationFiles = ['one.ts', 'two.ts', 'three.ts', 'four.ts'].map((name) => path.join(repo, 'packages', 'engine', 'src', name));
    for (const file of derivationFiles) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "export const artifact = '.playbook/shared.json';\n");
    }

    const artifact = generateImprovementCandidates(repo);
    const analysis = artifact.opportunity_analysis;

    expect(analysis.top_recommendation).toBeDefined();
    expect(analysis.top_recommendation?.evidence.length).toBeGreaterThan(0);
    expect(analysis.top_recommendation?.why_it_matters.length).toBeGreaterThan(0);
    expect(analysis.top_recommendation?.likely_change_shape.length).toBeGreaterThan(0);
    expect(analysis.secondary_queue.every((entry, index, list) => index === 0 || list[index - 1]!.priority_score >= entry.priority_score)).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });
});
