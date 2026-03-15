# Process Telemetry Contract (v1)

## Purpose

`process-telemetry.schema.json` defines deterministic execution/process evidence captured at:

- `.playbook/process-telemetry.json`

This artifact records how execution happened so workflow learning can be inspected separately from repository health outcomes.

## Contract shape

Top-level fields:

- `schemaVersion`: fixed schema version (`1.0`)
- `kind`: fixed artifact kind (`process-telemetry`)
- `generatedAt`: generation timestamp (ISO date-time)
- `records`: additive list of process execution records
- `summary`: deterministic rollup computed from `records`

Each `records[]` entry includes required baseline fields:

- `id`
- `recordedAt`
- `task_family`
- `task_duration_ms`
- `files_touched`
- `validators_run`
- `retry_count`
- `merge_conflict_risk`
- `first_pass_success`
- `prompt_size`
- `reasoning_scope`

Route-learning additive fields (optional; safe to omit for backward compatibility):

- `task_profile_id`
- `route_id`
- `rule_packs_selected`
- `required_validations_selected`
- `optional_validations_selected`
- `validation_duration_ms`
- `planning_duration_ms`
- `apply_duration_ms`
- `human_intervention_required`
- `parallel_lane_count`
- `actual_merge_conflict`
- `over_validation_signal`
- `under_validation_signal`

Summary now includes deterministic rollups for route-level evidence, validation cost, intervention pressure, and parallel-safety outcomes:

- route/profile/rule-pack/validation count maps
- total validation/planning/apply durations
- intervention/conflict/signal counts
- average parallel lane count

## Rule

Process telemetry must capture selected route details, not just execution totals.

## Pattern

Route learning improves when validation load and intervention pressure are explicit.

## Failure mode

A router optimized without validation-cost signals will drift toward fragile decisions.

## Determinism and safety

- Array-like route detail fields are deduplicated and sorted during normalization.
- Summary maps are key-sorted to keep outputs stable and bounded.
- Missing optional route-learning fields degrade safely to conservative defaults without failing telemetry commands.
- Process telemetry remains evidence for learning review and does not auto-promote doctrine.
