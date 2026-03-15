# Learning State Snapshot Contract (v1)

## Purpose

`learning-state.schema.json` defines a deterministic, compact, proposal-only learning layer that sits between raw telemetry evidence and future router/meta-evolution proposals.

Artifact target:

- `.playbook/learning-state.json` (inspection output target, optional write path)

Inputs are read-only evidence surfaces:

- `.playbook/outcome-telemetry.json`
- `.playbook/process-telemetry.json`
- `.playbook/task-execution-profile.json` (optional)

## Contract shape

Top-level fields:

- `schemaVersion`: fixed schema version (`1.0`)
- `kind`: fixed artifact kind (`learning-state-snapshot`)
- `generatedAt`: deterministic latest-source timestamp fallback
- `proposalOnly`: fixed `true`
- `sourceArtifacts`: availability + record-count summary for each source input artifact
- `metrics`: compact interpreted learning metrics (no raw log replay)
- `confidenceSummary`: confidence decomposition and explicit open questions

Required metrics:

- `first_pass_yield`
- `retry_pressure`
- `validation_load_ratio`
- `route_efficiency_score`
- `smallest_sufficient_route_score`
- `parallel_safety_realized`
- `router_fit_score`
- `reasoning_scope_efficiency`
- `validation_cost_pressure`
- `pattern_family_effectiveness_score`
- `portability_confidence`

## Rule

Learning metrics must stay grounded in observable execution evidence.

## Pattern

Enriched telemetry increases learning quality without requiring autonomous mutation.

## Failure modes

- Self-evolution from unsegmented telemetry.
- Goodhart router.
- Compaction logic becomes misleading if richer evidence exists but is ignored.

## Determinism and safety

- Deterministic ordering is applied to all map-like outputs.
- Missing source artifacts degrade to partial summaries instead of command failure.
- Snapshot outputs are proposal-only and do not mutate canonical governance knowledge.
