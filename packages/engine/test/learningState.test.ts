import { describe, expect, it } from 'vitest';
import { deriveLearningStateSnapshot } from '../src/telemetry/learningState.js';

describe('deriveLearningStateSnapshot', () => {
  it('derives deterministic compact metrics from telemetry evidence', () => {
    const artifact = deriveLearningStateSnapshot({
      outcomeTelemetry: {
        schemaVersion: '1.0',
        kind: 'outcome-telemetry',
        generatedAt: '2026-03-10T00:00:00.000Z',
        records: [
          {
            id: 'out-1',
            recordedAt: '2026-03-10T01:00:00.000Z',
            plan_churn: 1,
            apply_retries: 1,
            dependency_drift: 0,
            contract_breakage: 0,
            docs_mismatch: false,
            ci_failure_categories: ['lint']
          }
        ],
        summary: {
          total_records: 0,
          sum_plan_churn: 0,
          sum_apply_retries: 0,
          sum_dependency_drift: 0,
          sum_contract_breakage: 0,
          docs_mismatch_count: 0,
          ci_failure_category_counts: {}
        }
      },
      processTelemetry: {
        schemaVersion: '1.0',
        kind: 'process-telemetry',
        generatedAt: '2026-03-11T00:00:00.000Z',
        records: [
          {
            id: 'proc-1',
            recordedAt: '2026-03-11T01:00:00.000Z',
            task_family: 'docs_only',
            task_duration_ms: 100,
            files_touched: ['docs/README.md'],
            validators_run: ['pnpm playbook docs audit --json'],
            retry_count: 0,
            merge_conflict_risk: 0,
            first_pass_success: true,
            prompt_size: 10,
            reasoning_scope: 'narrow'
          },
          {
            id: 'proc-2',
            recordedAt: '2026-03-11T01:10:00.000Z',
            task_family: 'pattern_learning',
            task_duration_ms: 200,
            files_touched: ['packages/engine/src/learning/pattern.ts'],
            validators_run: ['pnpm test', 'pnpm -r build'],
            retry_count: 1,
            merge_conflict_risk: 0.2,
            first_pass_success: false,
            prompt_size: 100,
            reasoning_scope: 'cross-repo'
          }
        ],
        summary: {
          total_records: 0,
          total_task_duration_ms: 0,
          average_task_duration_ms: 0,
          total_retry_count: 0,
          first_pass_success_count: 0,
          average_merge_conflict_risk: 0,
          total_files_touched_unique: 0,
          total_validators_run_unique: 0,
          task_family_counts: {},
          validators_run_counts: {},
          reasoning_scope_counts: { narrow: 0, module: 0, repository: 0, 'cross-repo': 0 },
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
          average_parallel_lane_count: 0,
          over_validation_signal_count: 0,
          under_validation_signal_count: 0
        }
      },
      taskExecutionProfile: {
        schemaVersion: '1.0',
        kind: 'task-execution-profile',
        generatedAt: '2026-03-12T00:00:00.000Z',
        proposalOnly: true,
        profiles: []
      }
    });

    expect(artifact.kind).toBe('learning-state-snapshot');
    expect(artifact.metrics.first_pass_yield).toBe(0.5);
    expect(artifact.metrics.retry_pressure).toEqual({ docs_only: 0, pattern_learning: 1 });
    expect(artifact.metrics.validation_load_ratio).toBe(1.5);
    expect(artifact.metrics.route_efficiency_score.docs_only).toBe(1);
    expect(artifact.metrics.pattern_family_effectiveness_score.pattern_learning).toBe(0.15);
    expect(artifact.metrics.portability_confidence).toBe(0.45);
    expect(artifact.confidenceSummary.open_questions).toContain(
      'Low sample size: expand telemetry window before promoting routing proposals.'
    );
  });

  it('degrades safely when artifacts are missing', () => {
    const artifact = deriveLearningStateSnapshot({});

    expect(artifact.metrics.sample_size).toBe(0);
    expect(artifact.metrics.first_pass_yield).toBe(0);
    expect(artifact.sourceArtifacts.outcomeTelemetry.available).toBe(false);
    expect(artifact.sourceArtifacts.processTelemetry.available).toBe(false);
    expect(artifact.confidenceSummary.overall_confidence).toBe(0);
    expect(artifact.confidenceSummary.open_questions.length).toBeGreaterThan(0);
  });
});
