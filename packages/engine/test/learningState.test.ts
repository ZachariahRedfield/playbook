import { describe, expect, it } from 'vitest';
import { deriveLearningStateSnapshot } from '../src/telemetry/learningState.js';

describe('deriveLearningStateSnapshot', () => {
  it('improves route-fit confidence when enriched telemetry evidence is present', () => {
    const artifact = deriveLearningStateSnapshot({
      outcomeTelemetry: {
        schemaVersion: '1.0',
        kind: 'outcome-telemetry',
        generatedAt: '2026-03-10T00:00:00.000Z',
        records: [
          {
            id: 'out-1',
            recordedAt: '2026-03-10T01:00:00.000Z',
            plan_churn: 0,
            apply_retries: 0,
            dependency_drift: 0,
            contract_breakage: 0,
            docs_mismatch: false,
            ci_failure_categories: [],
            task_family: 'docs_only',
            post_apply_verify_passed: true,
            post_apply_ci_passed: true
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
            task_profile_id: 'docs-profile',
            route_id: 'docs-lane',
            task_duration_ms: 100,
            files_touched: ['docs/README.md'],
            validators_run: ['pnpm playbook docs audit --json'],
            rule_packs_selected: ['docs-governance'],
            required_validations_selected: ['pnpm playbook docs audit --json'],
            validation_duration_ms: 30,
            planning_duration_ms: 20,
            apply_duration_ms: 50,
            retry_count: 0,
            merge_conflict_risk: 0,
            actual_merge_conflict: false,
            first_pass_success: true,
            human_intervention_required: false,
            parallel_lane_count: 2,
            over_validation_signal: false,
            under_validation_signal: false,
            prompt_size: 10,
            reasoning_scope: 'narrow'
          },
          {
            id: 'proc-2',
            recordedAt: '2026-03-11T01:10:00.000Z',
            task_family: 'contracts_schema',
            task_profile_id: 'contracts-profile',
            route_id: 'contracts-lane',
            task_duration_ms: 200,
            files_touched: ['packages/contracts/src/learning-state.schema.json'],
            validators_run: ['pnpm playbook schema verify --json', 'pnpm -r build'],
            rule_packs_selected: ['contract-registry', 'schema-governance'],
            required_validations_selected: ['pnpm playbook schema verify --json', 'pnpm -r build'],
            validation_duration_ms: 60,
            planning_duration_ms: 40,
            apply_duration_ms: 100,
            retry_count: 0,
            merge_conflict_risk: 0.1,
            actual_merge_conflict: false,
            first_pass_success: true,
            human_intervention_required: false,
            parallel_lane_count: 2,
            over_validation_signal: false,
            under_validation_signal: false,
            prompt_size: 50,
            reasoning_scope: 'module'
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
        profiles: [
          {
            task_family: 'docs_only',
            scope: 'single-file',
            affected_surfaces: ['docs', 'governance'],
            rule_packs: ['docs-governance'],
            required_validations: ['pnpm playbook docs audit --json'],
            optional_validations: ['pnpm -r build'],
            docs_requirements: ['docs/CHANGELOG.md'],
            parallel_safe: true,
            estimated_change_surface: 'small'
          },
          {
            task_family: 'contracts_schema',
            scope: 'single-module',
            affected_surfaces: ['contracts', 'schemas'],
            rule_packs: ['contract-registry', 'schema-governance'],
            required_validations: ['pnpm playbook schema verify --json', 'pnpm -r build'],
            optional_validations: ['pnpm playbook verify --ci --json'],
            docs_requirements: ['docs/CHANGELOG.md'],
            parallel_safe: false,
            estimated_change_surface: 'medium'
          }
        ]
      }
    });

    expect(artifact.metrics.router_fit_score).toBeGreaterThan(0.8);
    expect(artifact.metrics.parallel_safety_realized).toBe(1);
    expect(artifact.metrics.validation_cost_pressure).toBeGreaterThan(0);
    expect(artifact.confidenceSummary.overall_confidence).toBeGreaterThan(0.6);
  });

  it('degrades safely with legacy telemetry artifacts that lack enriched fields', () => {
    const artifact = deriveLearningStateSnapshot({
      processTelemetry: {
        schemaVersion: '1.0',
        kind: 'process-telemetry',
        generatedAt: '2026-03-11T00:00:00.000Z',
        records: [
          {
            id: 'proc-legacy',
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
      }
    });

    expect(artifact.metrics.sample_size).toBe(1);
    expect(artifact.metrics.router_fit_score).toBeGreaterThanOrEqual(0);
    expect(artifact.confidenceSummary.open_questions).toContain(
      'Limited enriched route signals: collect route/profile/validation-selection telemetry before adjusting router policy.'
    );
    expect(artifact.confidenceSummary.open_questions).toContain(
      'Validation duration evidence missing: validation_cost_pressure currently relies on coarse validator counts.'
    );
  });

  it('increases evidence completeness confidence with richer telemetry signal quality', () => {
    const legacy = deriveLearningStateSnapshot({
      processTelemetry: {
        schemaVersion: '1.0',
        kind: 'process-telemetry',
        generatedAt: '2026-03-11T00:00:00.000Z',
        records: [
          {
            id: 'proc-legacy',
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
      }
    });

    const enriched = deriveLearningStateSnapshot({
      outcomeTelemetry: {
        schemaVersion: '1.0',
        kind: 'outcome-telemetry',
        generatedAt: '2026-03-10T00:00:00.000Z',
        records: [
          {
            id: 'out-1',
            recordedAt: '2026-03-10T01:00:00.000Z',
            plan_churn: 0,
            apply_retries: 0,
            dependency_drift: 0,
            contract_breakage: 0,
            docs_mismatch: false,
            ci_failure_categories: [],
            task_family: 'docs_only'
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
            task_profile_id: 'docs-profile',
            route_id: 'docs-lane',
            task_duration_ms: 100,
            files_touched: ['docs/README.md'],
            validators_run: ['pnpm playbook docs audit --json'],
            rule_packs_selected: ['docs-governance'],
            required_validations_selected: ['pnpm playbook docs audit --json'],
            validation_duration_ms: 30,
            planning_duration_ms: 20,
            apply_duration_ms: 50,
            retry_count: 0,
            merge_conflict_risk: 0,
            actual_merge_conflict: false,
            first_pass_success: true,
            human_intervention_required: false,
            parallel_lane_count: 2,
            over_validation_signal: false,
            under_validation_signal: false,
            prompt_size: 10,
            reasoning_scope: 'narrow'
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
        profiles: [
          {
            task_family: 'docs_only',
            scope: 'single-file',
            affected_surfaces: ['docs', 'governance'],
            rule_packs: ['docs-governance'],
            required_validations: ['pnpm playbook docs audit --json'],
            optional_validations: ['pnpm -r build'],
            docs_requirements: ['docs/CHANGELOG.md'],
            parallel_safe: true,
            estimated_change_surface: 'small'
          }
        ]
      }
    });

    expect(enriched.confidenceSummary.evidence_completeness_score).toBeGreaterThan(legacy.confidenceSummary.evidence_completeness_score);
    expect(enriched.confidenceSummary.overall_confidence).toBeGreaterThan(legacy.confidenceSummary.overall_confidence);
  });
});
