# AGENTS.md

## Purpose

AGENTS.md is the canonical AI operating contract for the Playbook repository.

This document tells agents how to bootstrap, which commands to trust, and how to execute deterministic remediation workflows without drifting from Playbook's intended behavior.

## Playbook-First AI Workflow

Use Playbook as the primary repository intelligence layer for this task.

AI agents should prefer Playbook commands over direct repository inspection whenever command coverage exists.

For repository-shape or architecture questions, prefer `pnpm playbook query`, `pnpm playbook explain`, or `pnpm playbook ask "<question>" --repo-context` over ad-hoc file inspection.

### Recommended bootstrap

Before making non-trivial changes:

1. Build the local CLI so commands reflect the current branch.

```
pnpm -r build
```

2. Inspect Playbook agent context.

Preferred (if available):

```
pnpm playbook ai-context --json
```

Fallback:

```
pnpm playbook context --json
```

3. Use repository intelligence commands before broad file inspection.

Examples:

```
pnpm playbook query modules
pnpm playbook query architecture
pnpm playbook ask "where should a new feature live?" --repo-context
pnpm playbook explain <target>
```

4. When addressing rule or governance behavior, treat the deterministic remediation workflow as the source of truth:

```
pnpm playbook verify
pnpm playbook explain <rule-id>
pnpm playbook plan
pnpm playbook apply
pnpm playbook verify
```

Direct file inspection should only be used when Playbook command coverage is insufficient.

## Default AI bootstrap

When operating inside this repository, start from local source:

```bash
pnpm -r build
pnpm playbook ai-context --json
pnpm playbook ai-contract --json
pnpm playbook context --json
```

Inside the Playbook repo, prefer local built CLI entrypoints over globally installed or published CLI binaries so validation reflects the current branch.

## Command authority

When command coverage exists, prefer Playbook command outputs over ad-hoc repository inference.

Recommended authority order:

1. `ai-context`
2. `ai-contract`
3. `context`
4. `index`
5. `query`
6. `explain`
7. `ask --repo-context` for repository-shape questions
8. `rules`
9. `verify`
10. Direct file inspection only when command coverage is insufficient

## Canonical remediation workflow

Canonical machine-safe flow:

`verify -> plan -> apply -> verify`

Use this sequence for deterministic remediation.

Diagnostic augmentation: add `explain <rule-id>` between `verify` and `plan` when findings need rule-level interpretation before planning changes.

## Repository intelligence workflow

- Generate or refresh machine-readable intelligence with `index`.
- Inspect structured fields with `query`.
- Ask repository-shape questions with `ask --repo-context` after `index` when repo context is required.
- Explain rules/modules/architecture targets with `explain`.
- Use `schema` to validate JSON contracts when integrating with automation.

## Working inside the Playbook repo

- Prefer local execution for branch validation:
  - `pnpm -r build`
  - `pnpm playbook <command> ...`
- Treat command metadata and command outputs as the source of truth for command inventory.
- Keep CLI command wrappers thin and engine behavior deterministic.

## Validation expectations

At minimum for command-surface changes:

- `pnpm -r build`
- `pnpm agents:update`
- `pnpm agents:check`

When documentation/governance surfaces are touched, also run:

- `pnpm playbook docs audit --json`

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

- Pattern: `pnpm playbook ai-context` is the preferred agent bootstrap command for Playbook-aware AI workflows.
- Rule: AI agents should prefer Playbook commands over broad repository inference when command coverage exists.
- Rule: Inside the Playbook repo, use local built CLI entrypoints to reflect current branch behavior.
- Pattern: `.playbook/ai-contract.json` is the canonical AI-operability handshake artifact for Playbook-enabled repositories.
- Pattern: `ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify/plan/apply` is the preferred AI operating ladder.
- Failure Mode: Agent drift occurs when AI tools bypass Playbook command outputs and reason directly from stale or incomplete file inspection.
- Pattern: AI working inside the Playbook repo should run docs audit alongside other branch-accurate local CLI validations.

## Managed command surface

The following section is generated from shared command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:COMMANDS_START -->

### Core

- `analyze`: Analyze project stack
  - Example: `pnpm playbook analyze --json`
- `pilot`: Run deterministic baseline external repository analysis in one command
  - Example: `pnpm playbook pilot --repo "./target-repo" --json`
- `verify`: Verify governance rules
  - Example: `pnpm playbook verify --ci --json`
- `plan`: Generate a structured fix plan from rule findings
  - Example: `pnpm playbook plan --json`
- `orchestrate`: Generate deterministic orchestration lane artifacts for a goal
  - Example: `pnpm playbook orchestrate --goal "ship capability" --lanes 3 --format both`
- `apply`: Execute deterministic auto-fixable plan tasks
  - Example: `pnpm playbook apply --from-plan .playbook/plan.json`

### Repository tools

- `analyze-pr`: Analyze local branch/worktree changes with deterministic PR intelligence
  - Example: `pnpm playbook analyze-pr --json`
- `doctor`: Diagnose repository health by aggregating verify, risk, docs, and index analyzers
  - Example: `pnpm playbook doctor --fix --dry-run`
- `diagram`: Generate deterministic architecture Mermaid diagrams
  - Example: `pnpm playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md`
- `patterns`: Inspect pattern knowledge graph data and review promotion candidates
  - Example: `pnpm playbook patterns list --json`
- `docs`: Audit documentation governance surfaces and contracts
  - Example: `pnpm playbook docs audit --json`
- `audit`: Audit deterministic architecture guardrails and platform hardening controls
  - Example: `pnpm playbook audit architecture --json`
- `rules`: List loaded verify and analyze rules
  - Example: `pnpm playbook rules --json`
- `schema`: Print JSON Schemas for Playbook CLI command outputs
  - Example: `pnpm playbook schema verify --json`
- `context`: Print deterministic CLI and architecture context for tools and agents
  - Example: `pnpm playbook context --json`
- `ai-context`: Print deterministic AI bootstrap context for Playbook-aware agents
  - Example: `pnpm playbook ai-context --json`
- `ai-contract`: Print deterministic AI repository contract for Playbook-aware agents
  - Example: `pnpm playbook ai-contract --json`
- `pilot`: Run one-command external baseline analysis workflow for a target repository
  - Example: `pnpm playbook pilot --repo ../target-repo --json`
- `ignore`: Suggest and safely apply ranked .playbookignore recommendations
  - Example: `pnpm playbook ignore suggest --repo ../target-repo --json`
- `contracts`: Emit deterministic contract registry for schemas, artifacts, and roadmap status
  - Example: `pnpm playbook contracts --json`

### Repository intelligence

- `index`: Generate machine-readable repository intelligence index
  - Example: `pnpm playbook index --json`
- `graph`: Summarize machine-readable repository knowledge graph from .playbook/repo-graph.json
  - Example: `pnpm playbook graph --json`
- `query`: Query machine-readable repository intelligence from .playbook/repo-index.json
  - Example: `pnpm playbook query modules --json`
- `deps`: Print module dependency graph from .playbook/repo-index.json
  - Example: `pnpm playbook deps workouts --json`
- `ask`: Answer repository questions from machine-readable intelligence context
  - Example: `pnpm playbook ask "where should a new feature live?" --repo-context --json`
- `explain`: Explain rules, modules, or architecture from repository intelligence
  - Example: `pnpm playbook explain architecture --json`
- `route`: Classify tasks into deterministic execution vs bounded model reasoning routes
  - Example: `pnpm playbook route "summarize current repo state" --json`
- `knowledge`: Inspect read-only knowledge artifacts and provenance surfaces
  - Example: `pnpm playbook knowledge list --json`

### Utility

- `learn`: Draft deterministic knowledge candidates from local diff and repository intelligence
  - Example: `pnpm playbook learn draft --json --out .playbook/knowledge/candidates.json`
- `memory`: Inspect, review, and curate repository memory artifacts with explicit human-reviewed doctrine promotion
  - Example: `pnpm playbook memory events --json`
- `security`: Inspect deterministic security baseline findings and summary
  - Example: `pnpm playbook security baseline summary --json`
- `telemetry`: Inspect deterministic repository/process telemetry and compact learning-state snapshots
  - Example: `pnpm playbook telemetry learning-state --json`
- `agent`: Read runtime control-plane records and run plan-backed dry-run previews
  - Example: `pnpm playbook agent run --from-plan .playbook/plan.json --dry-run --json`

- `demo`: Show the official Playbook demo repository and guided first-run workflow
- `init`: Initialize playbook docs/config
- `fix`: Apply safe, deterministic autofixes for verify findings
- `status`: Show overall Playbook repository health
- `upgrade`: Plan safe upgrades and local deterministic migrations
- `session`: Manage repo-scoped session memory and snapshot workflows
<!-- PLAYBOOK:COMMANDS_END -->

## Managed examples

The following command examples are generated from shared command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:EXAMPLES_START -->

| Command | Example |
| --- | --- |
| `analyze` | `pnpm playbook analyze --json` |
| `pilot` | `pnpm playbook pilot --repo "./target-repo" --json` |
| `verify` | `pnpm playbook verify --ci --json` |
| `plan` | `pnpm playbook plan --json` |
| `orchestrate` | `pnpm playbook orchestrate --goal "ship capability" --lanes 3 --format both` |
| `apply` | `pnpm playbook apply --from-plan .playbook/plan.json` |
| `analyze-pr` | `pnpm playbook analyze-pr --json` |
| `doctor` | `pnpm playbook doctor --fix --dry-run` |
| `diagram` | `pnpm playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` |
| `patterns` | `pnpm playbook patterns list --json` |
| `docs` | `pnpm playbook docs audit --json` |
| `audit` | `pnpm playbook audit architecture --json` |
| `rules` | `pnpm playbook rules --json` |
| `schema` | `pnpm playbook schema verify --json` |
| `context` | `pnpm playbook context --json` |
| `ai-context` | `pnpm playbook ai-context --json` |
| `ai-contract` | `pnpm playbook ai-contract --json` |
| `pilot` | `pnpm playbook pilot --repo ../target-repo --json` |
| `ignore` | `pnpm playbook ignore suggest --repo ../target-repo --json` |
| `contracts` | `pnpm playbook contracts --json` |
| `index` | `pnpm playbook index --json` |
| `graph` | `pnpm playbook graph --json` |
| `query` | `pnpm playbook query modules --json` |
| `deps` | `pnpm playbook deps workouts --json` |
| `ask` | `pnpm playbook ask "where should a new feature live?" --repo-context --json` |
| `explain` | `pnpm playbook explain architecture --json` |
| `route` | `pnpm playbook route "summarize current repo state" --json` |
| `learn` | `pnpm playbook learn draft --json --out .playbook/knowledge/candidates.json` |
| `memory` | `pnpm playbook memory events --json` |
| `knowledge` | `pnpm playbook knowledge list --json` |
| `security` | `pnpm playbook security baseline summary --json` |
| `telemetry` | `pnpm playbook telemetry learning-state --json` |
| `agent` | `pnpm playbook agent run --from-plan .playbook/plan.json --dry-run --json` |
<!-- PLAYBOOK:EXAMPLES_END -->
