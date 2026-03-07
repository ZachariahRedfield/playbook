# Remediation Trust Model

Remediation features require defined trust boundaries and change-scope levels.

## Scope

This model governs `playbook verify`, `playbook plan`, and `playbook apply` execution boundaries.

## Trust boundary principles

- `verify`: read-only analysis and policy evaluation.
- `plan`: deterministic proposal generation from failures; no repository mutation.
- `apply`: bounded executor that may mutate repository content only through approved plan tasks.

## Change levels

### Level 0 — Read-only analysis

- Commands: `verify`, `analyze`, `query`, `explain`, `ask`, `rules`, `docs audit`
- Allowed actions: inspect repository state and emit diagnostics
- Forbidden actions: file mutation

### Level 1 — Docs/tests/generated artifacts

- Commands: bounded `apply` tasks that modify docs, tests, or generated runtime artifacts
- Examples: update `.gitignore` artifact entries, regenerate `.playbook` runtime artifacts
- Risk profile: low, broadly reversible

### Level 2 — Scoped module code changes

- Commands: future deterministic auto-fixes limited to one owned module boundary
- Requirements: explicit rule mapping, deterministic patch shape, contract tests
- Risk profile: medium

### Level 3 — Cross-module or security-sensitive changes

- Commands: never auto-applied by default
- Requirements: explicit human review and out-of-band approval gates
- Risk profile: high

## Enforcement expectations

- Plans must classify each task with explicit change-level metadata.
- `apply` must reject tasks above configured trust level unless an explicit override contract exists.
- JSON contracts should keep change-level intent machine-readable for CI/auditors.

## Safety baseline

Default safety posture:

- Read-only and Level 1 automation allowed under deterministic policy controls.
- Level 2+ requires stronger scope constraints and human-reviewed rollout.
- Level 3 remains advisory-only in default Playbook operation.

