# Playbook Architecture

This document describes **current-state architecture**. Future-state initiatives live in [PLAYBOOK_PRODUCT_ROADMAP.md](./PLAYBOOK_PRODUCT_ROADMAP.md).

## System layering

Playbook is organized as a layered monorepo:

- **`packages/cli`**: command parsing, output rendering, and exit codes.
- **`packages/engine`**: deterministic analysis, verification, plan generation, and fix execution.
- **`packages/node`**: Node/runtime adapter utilities used by CLI and engine integration points.
- **`packages/core`**: shared core contracts/utilities retained for package compatibility.

Primary flow:

`CLI -> engine (+ node adapter) -> repository`

## CLI command architecture

- CLI command handlers live in `packages/cli/src/commands/`.
- `packages/cli/src/commands/index.ts` is the central command registry and dispatch surface.
- Shared CLI helpers live in `packages/cli/src/lib/`.
- Engine behavior and rule execution logic should stay in `packages/engine`, not command files.

This separation keeps command modules thin and keeps governance logic reusable/testable.

## Analyze -> verify -> plan -> apply flow

Playbook governance execution follows a staged flow:

1. **`analyze`** detects repository structure and stack signals.
2. **`verify`** executes deterministic governance rules and returns findings.
3. **`plan`** converts verify failures into ordered, machine-safe tasks.
4. **`apply`** executes deterministic auto-fixable tasks from a generated plan.

`fix` remains available as a convenience command for direct local remediation flows, but the canonical machine-safe execution path is `plan -> apply`.

`plan` and `apply` are the machine-safe planning/execution path for remediation.

## Deterministic task and output contracts

The plan/execution pipeline is deterministic by contract:

- Verify findings are sorted before task generation.
- Task fields are stable (`ruleId`, `file`, `action`, `autoFix`).
- Nullable values are normalized (`file: null` when evidence is absent).
- JSON responses are structured for automation, not best-effort prose parsing.

Deterministic JSON output is treated as a public interface for CI, tooling, and agents.
