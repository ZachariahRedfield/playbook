import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateLearningClustersArtifact } from './learningClusters.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-learning-clusters-'));

const writeArtifact = (repoRoot: string, relativePath: string, payload: unknown): void => {
  const filePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

describe('learning clusters', () => {
  it('clusters repeated signals deterministically from canonical artifacts', () => {
    const repo = createRepo();

    writeArtifact(repo, '.playbook/outcome-feedback.json', {
      schemaVersion: '1.0',
      kind: 'playbook-outcome-feedback',
      command: 'outcome-feedback',
      reviewOnly: true,
      authority: { mutation: 'read-only', promotion: 'review-required' },
      generatedAt: '2026-04-01T00:00:00.000Z',
      sourceArtifacts: {
        executionReceiptPath: '.playbook/execution-receipt.json',
        interopUpdatedTruthPath: '.playbook/interop-updated-truth.json',
        interopFollowupsPath: '.playbook/interop-followups.json',
        remediationStatusPath: '.playbook/remediation-status.json',
        remediationHistoryPath: '.playbook/test-autofix-history.json'
      },
      outcomeCounts: { success: 1, 'bounded-failure': 1, 'blocked-policy': 3, 'rollback-deactivation': 0, 'later-regression': 0 },
      outcomes: [],
      signals: {
        confidence: [],
        triggerQuality: ['query help needed', 'query context unclear', 'other'],
        staleKnowledge: [],
        trends: []
      },
      governance: { candidateOnly: true, autoPromotion: false, autoMutation: false, reviewRequired: true }
    });

    writeArtifact(repo, '.playbook/test-autofix-history.json', {
      schemaVersion: '1.0',
      kind: 'test-autofix-remediation-history',
      generatedAt: '2026-04-02T00:00:00.000Z',
      runs: [
        { run_id: 'run-001', generatedAt: '2026-04-01T00:00:00.000Z', final_status: 'blocked_low_confidence' },
        { run_id: 'run-002', generatedAt: '2026-04-02T00:00:00.000Z', final_status: 'blocked_low_confidence' },
        { run_id: 'run-003', generatedAt: '2026-04-03T00:00:00.000Z', final_status: 'fixed' }
      ]
    });

    writeArtifact(repo, '.playbook/remediation-status.json', {
      schemaVersion: '1.0',
      kind: 'remediation-status',
      command: 'remediation-status',
      generatedAt: '2026-04-03T00:00:00.000Z',
      source: { latest_result_path: '.playbook/test-autofix.json', remediation_history_path: '.playbook/test-autofix-history.json' },
      latest_run: { run_id: 'run-003' },
      blocked_signatures: ['sig-governance'],
      review_required_signatures: ['sig-governance'],
      safe_to_retry_signatures: [],
      stable_failure_signatures: [
        {
          failure_signature: 'sig-repeat',
          occurrences: 3,
          latest_run_id: 'run-003',
          latest_generatedAt: '2026-04-03T00:00:00.000Z',
          final_statuses: ['blocked_low_confidence', 'fixed'],
          applied_repair_classes: ['snapshot_refresh'],
          successful_repair_classes: ['snapshot_refresh'],
          blocked_repair_classes: ['snapshot_refresh'],
          retry_outlook: 'blocked'
        }
      ],
      repeat_policy_decisions: [
        { decision: 'review_required_repeat_failure', count: 2, latest_run_id: 'run-003', failure_signatures: ['sig-repeat'] }
      ],
      preferred_repair_classes: [],
      recent_final_statuses: [],
      telemetry: {
        confidence_buckets: [], failure_classes: [], blocked_low_confidence_runs: 0, top_repeated_blocked_signatures: [],
        dry_run_runs: 0, apply_runs: 0, dry_run_to_apply_ratio: '0:0', repeat_policy_block_counts: [],
        conservative_confidence_signal: {}, failure_class_rollup: [], repair_class_rollup: [], blocked_signature_rollup: [],
        threshold_counterfactuals: [], dry_run_vs_apply_delta: {}, manual_review_pressure: {}
      },
      remediation_history: [],
      latest_result: {}
    });

    writeArtifact(repo, '.playbook/process-telemetry.json', {
      schemaVersion: '1.0',
      kind: 'process-telemetry',
      generatedAt: '2026-04-04T00:00:00.000Z',
      records: [],
      summary: {
        total_records: 3,
        total_task_duration_ms: 30,
        average_task_duration_ms: 10,
        total_retry_count: 0,
        first_pass_success_count: 2,
        average_merge_conflict_risk: 0,
        total_files_touched_unique: 0,
        total_validators_run_unique: 0,
        task_family_counts: { query_modules: 3 },
        validators_run_counts: {},
        reasoning_scope_counts: { narrow: 0, module: 3, repository: 0, 'cross-repo': 0 },
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
        router_accuracy_records: 0,
        average_router_fit_score: 0,
        average_lane_delta: 0,
        average_validation_delta: 0
      }
    });

    writeArtifact(repo, '.playbook/learning-state.json', {
      schemaVersion: '1.0',
      kind: 'learning-state-snapshot',
      generatedAt: '2026-04-04T00:00:00.000Z',
      proposalOnly: true,
      sourceArtifacts: {
        outcomeTelemetry: { available: false, recordCount: 0, artifactPath: '.playbook/outcome-telemetry.json' },
        processTelemetry: { available: true, recordCount: 3, artifactPath: '.playbook/process-telemetry.json' },
        taskExecutionProfile: { available: false, recordCount: 0, artifactPath: '.playbook/task-execution-profile.json' }
      },
      metrics: {
        sample_size: 3,
        first_pass_yield: 0.67,
        retry_pressure: {},
        validation_load_ratio: 0,
        route_efficiency_score: {},
        smallest_sufficient_route_score: 0,
        parallel_safety_realized: 0,
        router_fit_score: 0,
        reasoning_scope_efficiency: 0,
        validation_cost_pressure: 0,
        pattern_family_effectiveness_score: {},
        portability_confidence: 0
      },
      confidenceSummary: {
        sample_size_score: 0.5,
        coverage_score: 0.5,
        evidence_completeness_score: 0.5,
        overall_confidence: 0.5,
        open_questions: []
      }
    });

    writeArtifact(repo, '.playbook/longitudinal-state.json', {
      schemaVersion: '1.0',
      kind: 'playbook-longitudinal-state',
      generatedAt: '2026-04-04T00:00:00.000Z',
      recurring_evidence: {
        finding_clusters: [{ key: 'verify.governance.drift', count: 2, refs: ['verify:1', 'verify:2'] }]
      }
    });

    writeArtifact(repo, '.playbook/pattern-convergence.json', {
      schemaVersion: '1.0',
      kind: 'pattern-convergence',
      generatedAt: '2026-04-04T00:00:00.000Z',
      proposalOnly: true,
      sourceArtifacts: ['.playbook/pattern-candidates.json'],
      clusters: [
        {
          clusterId: 'cluster:review-gated-evolution',
          intent: 'review-gated-evolution',
          constraint_class: 'mutation-boundary',
          resolution_strategy: 'review-gated-promotion',
          members: [{ source: 'candidate', id: 'a', title: 'A', intent: 'review', constraint_class: 'mutation-boundary', resolution_strategy: 'review-gated-promotion' }, { source: 'candidate', id: 'b', title: 'B', intent: 'review', constraint_class: 'mutation-boundary', resolution_strategy: 'review-gated-promotion' }],
          shared_abstraction: 'x',
          convergence_confidence: 0.9,
          recommended_higher_order_pattern: 'y'
        }
      ]
    });

    const first = generateLearningClustersArtifact(repo);
    const second = generateLearningClustersArtifact(repo);

    expect(second).toEqual(first);
    expect(first.clusters.length).toBeGreaterThan(3);
    expect(first.clusters.some((cluster) => cluster.clusterDimension === 'repeated_failure_shape')).toBe(true);
    expect(first.clusters.some((cluster) => cluster.clusterDimension === 'repeated_remediation_outcome')).toBe(true);
    expect(first.clusters.some((cluster) => cluster.clusterDimension === 'repeated_query_runtime_usage')).toBe(true);
    expect(first.clusters.some((cluster) => cluster.clusterDimension === 'repeated_governance_blocker')).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('does not emit clusters for non-recurring noise', () => {
    const repo = createRepo();

    writeArtifact(repo, '.playbook/test-autofix-history.json', {
      schemaVersion: '1.0',
      kind: 'test-autofix-remediation-history',
      generatedAt: '2026-04-02T00:00:00.000Z',
      runs: [{ run_id: 'run-001', generatedAt: '2026-04-01T00:00:00.000Z', final_status: 'fixed' }]
    });

    writeArtifact(repo, '.playbook/process-telemetry.json', {
      schemaVersion: '1.0',
      kind: 'process-telemetry',
      generatedAt: '2026-04-03T00:00:00.000Z',
      records: [],
      summary: {
        total_records: 1,
        total_task_duration_ms: 10,
        average_task_duration_ms: 10,
        total_retry_count: 0,
        first_pass_success_count: 1,
        average_merge_conflict_risk: 0,
        total_files_touched_unique: 0,
        total_validators_run_unique: 0,
        task_family_counts: { query_modules: 1 },
        validators_run_counts: {},
        reasoning_scope_counts: { narrow: 1, module: 0, repository: 0, 'cross-repo': 0 },
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
        router_accuracy_records: 0,
        average_router_fit_score: 0,
        average_lane_delta: 0,
        average_validation_delta: 0
      }
    });

    const artifact = generateLearningClustersArtifact(repo);
    expect(artifact.clusters).toEqual([]);

    fs.rmSync(repo, { recursive: true, force: true });
  });
});
