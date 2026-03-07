# AGENTS.md

## Purpose

AGENTS.md is the canonical AI operating contract for the Playbook repository.

This document tells agents how to bootstrap, which commands to trust, and how to execute deterministic remediation workflows without drifting from Playbook's intended behavior.

## Playbook-First AI Workflow

Use Playbook as the primary repository intelligence layer for this task.

AI agents should prefer Playbook commands over direct repository inspection whenever command coverage exists.

### Recommended bootstrap

Before making non-trivial changes:

1. Build the local CLI so commands reflect the current branch.

```
pnpm -r build
```

2. Inspect Playbook agent context.

Preferred (if available):

```
node packages/cli/dist/main.js ai-context --json
```

Fallback:

```
node packages/cli/dist/main.js context --json
```

3. Use repository intelligence commands before broad file inspection.

Examples:

```
playbook query modules
playbook query architecture
playbook ask "where should a new feature live?"
playbook explain <target>
```

4. When addressing rule or governance behavior, treat the deterministic remediation workflow as the source of truth:

```
playbook verify
playbook explain <rule-id>
playbook plan
playbook apply
playbook verify
```

Direct file inspection should only be used when Playbook command coverage is insufficient.

## Default AI bootstrap

When operating inside this repository, start from local source:

```bash
pnpm -r build
node packages/cli/dist/main.js ai-context --json
node packages/cli/dist/main.js ai-contract --json
node packages/cli/dist/main.js context --json
```

Inside the Playbook repo, prefer local built CLI entrypoints over globally installed or published CLI binaries so validation reflects the current branch.

## Command authority

When command coverage exists, prefer Playbook command outputs over ad-hoc repository inference.

Recommended authority order:

1. `ai-context`
2. `ai-contract`
3. `context`
4. `query`
5. `ask`
6. `explain`
7. `rules`
8. `verify`
9. Direct file inspection only when command coverage is insufficient

## Canonical remediation workflow

Canonical machine-safe flow:

`verify -> plan -> apply -> verify`

Use this sequence for deterministic remediation.

Diagnostic augmentation: add `explain <rule-id>` between `verify` and `plan` when findings need rule-level interpretation before planning changes.

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

- Pattern: `playbook ai-context` is the preferred agent bootstrap command for Playbook-aware AI workflows.
- Rule: AI agents should prefer Playbook commands over broad repository inference when command coverage exists.
- Rule: Inside the Playbook repo, use local built CLI entrypoints to reflect current branch behavior.
- Pattern: `.playbook/ai-contract.json` is the canonical AI-operability handshake artifact for Playbook-enabled repositories.
- Pattern: `ai-context -> ai-contract -> context -> query/ask/explain -> verify/plan/apply` is the preferred AI operating ladder.
- Failure Mode: Agent drift occurs when AI tools bypass Playbook command outputs and reason directly from stale or incomplete file inspection.

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
- `ai-context`: Print deterministic AI bootstrap context for Playbook-aware agents
  - Example: `playbook ai-context --json`
- `ai-contract`: Print deterministic AI repository contract for Playbook-aware agents
  - Example: `playbook ai-contract --json`

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
| `ai-context` | `playbook ai-context --json` |
| `ai-contract` | `playbook ai-contract --json` |
| `index` | `playbook index --json` |
| `query` | `playbook query modules --json` |
| `deps` | `playbook deps workouts --json` |
| `ask` | `playbook ask "where should a new feature live?" --json` |
| `explain` | `playbook explain architecture --json` |
<!-- PLAYBOOK:EXAMPLES_END -->
