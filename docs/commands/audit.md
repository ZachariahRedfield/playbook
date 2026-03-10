# `pnpm playbook audit architecture`

`pnpm playbook audit architecture` runs deterministic architecture guardrail checks for core platform hardening controls.

## Usage

```bash
pnpm playbook audit architecture
pnpm playbook audit architecture --json
```

## What it checks (v1.1 hardening)

1. artifact evolution policy
2. artifact schema versioning (`schemaVersion` quality check)
3. SCM/git context normalization layer (shared module + docs quality check)
4. remediation trust model (bounded scope/change-level quality check)
5. AI vs deterministic boundary (source-of-truth boundary quality check)
6. ecosystem adapter boundaries (adapter isolation quality check)
7. context/token efficiency strategy (incremental/narrow/token-aware quality check)
8. roadmap/docs hardening coverage (tolerant concept coverage)

## Severity + status semantics

- `pass`: required guardrail exists and satisfies minimum contract quality.
- `warn`: guardrail is missing or incomplete, but repository safety can continue.
- `fail`: reserved for future contract-breaking unsafe gaps (currently no architecture checks emit `fail`).

## Output contract

`--json` returns a stable envelope:

- `schemaVersion: "1.0"`
- `command: "audit-architecture"`
- `ok`
- `summary` (`status`, `checks`, `pass`, `warn`, `fail`)
- `audits[]` (`id`, `title`, `status`, `severity`, `evidence[]`, `recommendation`)
- `nextActions[]`

Determinism guarantees:

- checks execute in explicit ID order
- audit IDs are explicitly sorted
- `evidence[]` lines are sorted
- `nextActions[]` is sorted by audit ID prefix

## Human output layout

Text output is optimized for operator review:

1. summary first
2. actionable findings (`warn`/`fail`) first
3. passing checks after
4. next actions at the end

## Workflow integration

`pnpm playbook doctor` now consumes architecture-audit findings and surfaces non-pass checks in repository health reporting, so architecture hardening coverage stays visible in routine diagnostics.

## Governance intent

- Hardened `pnpm playbook audit architecture` by standardizing severity semantics and guaranteeing deterministic output ordering.
- Improved architecture audit maintainability so new checks can be added with minimal command-layer changes.
- Reduced brittleness in roadmap coverage auditing by using tolerant concept-based matching instead of fragile heading-only checks.
- Improved human-readable architecture audit output for faster operator review and actionability.
- Integrated architecture audit more directly into the broader repository health workflow.
- Upgraded selected architecture checks from presence-only validation to minimum-quality deterministic validation.
- Pattern: governance commands should start with existence checks, then evolve toward minimum-quality validation without sacrificing determinism.
- Rule: audit findings, evidence, and next actions must remain stably ordered to preserve trust in automation and contract snapshots.
