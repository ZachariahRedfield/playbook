# AGENTS.md

## Purpose

AGENTS.md is the canonical AI operating contract for the Playbook repository.

This document tells agents how to bootstrap, which commands to trust, and how to execute deterministic remediation workflows without drifting from Playbook's intended behavior.

## Default AI bootstrap

When operating inside this repository, start from local source:

```bash
pnpm -r build
node packages/cli/dist/main.js context --json
```

Inside the Playbook repo, prefer local built CLI entrypoints over globally installed or published CLI binaries so validation reflects the current branch.

## Command authority

When command coverage exists, prefer Playbook command outputs over ad-hoc repository inference.

Recommended authority order:

1. `context`
2. `query`
3. `ask`
4. `explain`
5. `rules`
6. `verify`
7. Direct file inspection only when command coverage is insufficient

## Canonical remediation workflow

Canonical machine-safe flow:

`verify -> explain -> plan -> apply -> verify`

Use this sequence for deterministic diagnosis and remediation.

## Repository intelligence workflow

- Generate or refresh machine-readable intelligence with `index`.
- Inspect structured fields with `query`.
- Ask repository-shape questions with `ask`.
- Explain rules/modules/architecture targets with `explain`.
- Use `schema` to validate JSON contracts when integrating with automation.

## Working inside the Playbook repo

- Prefer local execution for branch validation:
  - `pnpm -r build`
  - `node packages/cli/dist/main.js <command> ...`
- Treat command metadata and command outputs as the source of truth for command inventory.
- Keep CLI command wrappers thin and engine behavior deterministic.

## Validation expectations

At minimum for command-surface changes:

- `pnpm -r build`
- `pnpm agents:update`
- `pnpm agents:check`

Add targeted smoke/contract tests when command behavior or output contracts change.

## Documentation expectations

When command/workflow state changes, keep these aligned in the same change (or immediately after):

- `README.md`
- `docs/commands/README.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- demo docs/contracts
- `docs/CHANGELOG.md`

Copy-pastable governance bullets:

- Pattern: Managed AGENTS.md sections should be generated from shared command metadata rather than hand-maintained.
- Rule: AGENTS.md is the canonical AI operating contract for the Playbook repository.
- Rule: Playbook command outputs are authoritative over ad-hoc repository inference when command coverage exists.
- Pattern: Shared command metadata should feed command registry and AI-facing command inventory to reduce drift.
- Failure Mode: AI Contract Drift occurs when new commands are added without refreshing AGENTS.md managed sections.

## Managed command surface

The following section is generated from shared command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:COMMANDS_START -->

### Core

- `analyze`: Analyze project stack
  - Example: `playbook analyze --json`
- `verify`: Verify governance rules
  - Example: `playbook verify --ci --json`
- `plan`: Generate a structured fix plan from rule findings
  - Example: `playbook plan --json`
- `apply`: Execute deterministic auto-fixable plan tasks
  - Example: `playbook apply --from-plan .playbook/plan.json`

### Repository tools

- `doctor`: Repository health entry point for architecture, governance, and issues
  - Example: `playbook doctor --fix --dry-run`
- `diagram`: Generate deterministic architecture Mermaid diagrams
  - Example: `playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md`
- `rules`: List loaded verify and analyze rules
  - Example: `playbook rules --json`
- `schema`: Print JSON Schemas for Playbook CLI command outputs
  - Example: `playbook schema verify --json`
- `context`: Print deterministic CLI and architecture context for tools and agents
  - Example: `playbook context --json`

### Repository intelligence

- `index`: Generate machine-readable repository intelligence index
  - Example: `playbook index --json`
- `query`: Query machine-readable repository intelligence from .playbook/repo-index.json
  - Example: `playbook query modules --json`
- `deps`: Print module dependency graph from .playbook/repo-index.json
  - Example: `playbook deps workouts --json`
- `ask`: Answer repository questions from machine-readable intelligence context
  - Example: `playbook ask "where should a new feature live?" --json`
- `explain`: Explain rules, modules, or architecture from repository intelligence
  - Example: `playbook explain architecture --json`

### Utility

- `demo`: Show the official Playbook demo repository and guided first-run workflow
- `init`: Initialize playbook docs/config
- `fix`: Apply safe, deterministic autofixes for verify findings
- `status`: Show overall Playbook repository health
- `upgrade`: Plan safe upgrades and local deterministic migrations
- `session`: Import, merge, and cleanup session snapshots
<!-- PLAYBOOK:COMMANDS_END -->

## Managed examples

The following command examples are generated from shared command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:EXAMPLES_START -->

| Command | Example |
| --- | --- |
| `analyze` | `playbook analyze --json` |
| `verify` | `playbook verify --ci --json` |
| `plan` | `playbook plan --json` |
| `apply` | `playbook apply --from-plan .playbook/plan.json` |
| `doctor` | `playbook doctor --fix --dry-run` |
| `diagram` | `playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` |
| `rules` | `playbook rules --json` |
| `schema` | `playbook schema verify --json` |
| `context` | `playbook context --json` |
| `index` | `playbook index --json` |
| `query` | `playbook query modules --json` |
| `deps` | `playbook deps workouts --json` |
| `ask` | `playbook ask "where should a new feature live?" --json` |
| `explain` | `playbook explain architecture --json` |
<!-- PLAYBOOK:EXAMPLES_END -->
