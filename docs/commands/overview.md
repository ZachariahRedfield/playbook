# Command Contract Overview

This page documents the **CLI contract philosophy** for automation and contributors.

For current command status (current vs planned), use [Command Status Index](./README.md).

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

Canonical remediation flow is:

`verify -> plan -> apply -> verify`

Canonical automation-safe execution sequence:

`verify -> plan --json > plan.json -> review plan.json -> apply --from-plan plan.json -> verify`

Command roles:

- `verify`: detect deterministic governance findings.
- `plan`: produce remediation intent as a deterministic, machine-readable task artifact.
- `apply`: bounded executor for deterministic auto-fixable plan tasks (from a fresh plan or `--from-plan`).
- `fix`: convenience/direct remediation path for local/manual workflows (`--dry-run`, `--yes`, `--only`).

Pattern: reviewed intent before execution. In automation, generate plan output first, review the artifact, then execute that exact artifact.


## Onboarding discoverability doctrine

- Rule: demo discovery should be available from the Playbook CLI, not only repository docs.
- Pattern: onboarding commands should return both human-readable output and a machine-readable JSON contract.
- Rule: initial demo command behavior must remain deterministic and side-effect free.
- Failure mode: environment-dependent onboarding steps (implicit clone/open/install behavior) reduce trust when user systems vary.


## Capability discovery guidance

- The CLI help output is authoritative for command and flag discovery (`playbook --help`, `playbook <command> --help`).
- Use `pnpm playbook rules` to discover active deterministic rules.
- Use `pnpm playbook explain <rule>` and `pnpm playbook explain architecture` to retrieve deterministic rule and repository-intelligence explanations.
