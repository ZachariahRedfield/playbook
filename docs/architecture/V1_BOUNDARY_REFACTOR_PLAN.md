# V1 Boundary Refactor Plan

## Objective

Eliminate boundary drift between CLI, core, and engine by making CLI commands thin wrappers around one canonical engine implementation per command.

## Canonical ownership (target)

| Command surface | Canonical implementation package | Notes |
| --- | --- | --- |
| `index`, `query`, `deps`, `ask`, `explain`, `graph` | `@zachariahredfield/playbook-engine` | Already mostly aligned. |
| `verify`, `plan`, `apply`, `rules` | `@zachariahredfield/playbook-engine` | Keep deterministic remediation flow in one layer. |
| `analyze` | `@zachariahredfield/playbook-engine` | **Refactor required** to retire duplicated analyze path in core. |
| formatting and output adapters | `@fawxzzy/playbook` (CLI package) | Parse args, print deterministic envelopes, no domain logic. |

## Module boundary corrections (v1 action items)

1. Move `analyze` domain behavior to engine and keep `packages/cli/src/commands/analyze.ts` as wiring only.
2. Define a single plugin registry contract consumed by both verify and explain/rules surfaces.
3. Route SCM base and merge-base resolution through one shared context module used by `verify`, `ask --diff-context`, and `analyze-pr`.
4. Keep JSON schema contracts in sync with command contract docs before changing command output fields.

## File-level implementation proposal

- Add `packages/engine/src/analyze/*` as canonical analyzer pipeline.
- Reduce `packages/core/src/analyze*` to compatibility wrapper (temporary) then remove.
- Add unified plugin adapter at `packages/engine/src/plugins/unifiedPluginRegistry.ts`.
- Update CLI command files to call engine entry points only.

## Failure modes this plan prevents

- Core/engine behavior drift for the same command.
- Plugin bifurcation where execution and explainability see different rule sets.
- SCM normalization drift across diff-based commands.
