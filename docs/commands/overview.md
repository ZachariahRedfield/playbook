# Command Contract Overview

This page documents the **CLI contract philosophy** for automation and contributors.

## Output modes

All top-level commands should support:

- **Human-readable text output** for local usage.
- **Machine-readable JSON output** via `--json` (or `--format json`) for CI and agent/tool integrations.

## JSON envelope conventions

JSON command responses should follow a stable envelope pattern:

- `schemaVersion`: schema compatibility marker (current: `"1.0"`).
- `command`: command identifier.
- `ok`: success/failure indicator.
- `exitCode`: process-compatible exit code.
- Command-specific structured fields (for example `findings`, `tasks`, `verify`, `applied`).

JSON output is a **public automation contract** and must remain stable and deterministic.

## Command architecture ownership

- CLI command modules: `packages/cli/src/commands/`
- CLI registry: `packages/cli/src/commands/index.ts`
- Shared CLI contract/types: `packages/cli/src/lib/cliContract.ts`
- Rule execution / planning / fix application logic: `packages/engine/src/`

## Remediation flow conventions

Current remediation flow is:

`analyze -> verify -> plan -> review artifact -> apply --from-plan -> verify`

Canonical automation-safe execution sequence:

`verify -> plan --json > plan.json -> review plan.json -> apply --from-plan plan.json -> verify`

`apply` is the bounded executor for deterministic, auto-fixable plan tasks and can execute either a freshly generated plan or an explicit serialized plan artifact.

`fix` remains available for opt-in/manual fix workflows (`--dry-run`, `--yes`, `--only`).
