# Playbook

AI-aware engineering governance for modern repositories.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) [![Playbook Diagrams Check](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml/badge.svg)](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml) ![Version](https://img.shields.io/badge/version-v0.1.1-blue)
[![Architecture](https://img.shields.io/badge/architecture-auto--generated%20by%20playbook-blueviolet?style=flat-square&logo=mermaid)](docs/ARCHITECTURE_DIAGRAMS.md)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

Playbook is a governance CLI for repositories that keeps checks deterministic for both humans and AI agents. It helps teams inspect current policy status, understand active rules, and apply safe fixes with confidence.

## Shared core, project-local intelligence

Playbook uses a **shared core + project-local Playbook state** integration model:

- The Playbook product (CLI/engine/contracts) is shared core.
- Installing Playbook in a consumer repository creates **project-local Playbook state** (config, index/artifacts, plans, and repository-specific extensions), not a fork by default.
- Repository observations stay local/private by default.
- Reusable patterns and product improvements are promoted upstream intentionally (docs/roadmap/rules), not via hidden mutation.

Pattern: **private-first by default**. Standard Playbook usage does not imply automatic upstream content export.

Pattern: **config/plugins/rule packs over forks** for project-specific customization.

## Runtime artifacts and storage

Playbook uses `.playbook/` as the default home for local runtime artifacts (for example repository intelligence indexes, plans, and machine-readable reports).

- Generated runtime artifacts should generally be gitignored unless intentionally committed as stable contracts/examples.
- Committed demo artifacts under `.playbook/demo-artifacts/` are product-facing snapshot contracts and examples, not general-purpose runtime logs.
- Playbook remains local/private-first by default: local scanning and artifact generation do not imply automatic cloud sync or upstream export.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated runtime artifacts on every run causes unnecessary repository-history growth and review noise.

## Playbook artifact lifecycle

Playbook classifies repository artifacts into deterministic storage classes:

- **Runtime artifacts**: local outputs like `.playbook/repo-index.json`, `.playbook/plan.json`, `.playbook/verify.json`, session cleanup reports, and cache files.
- **Automation artifacts**: CI handoff outputs such as CI plan and verification artifacts.
- **Contract artifacts**: committed snapshots and docs contracts like `tests/contracts/*.snapshot.json`, `.playbook/demo-artifacts/*`, and generated diagram documentation.

Use `.playbookignore` to control repository intelligence scan scope for `playbook index` and other repository scans. The syntax mirrors `.gitignore`.

Recommended starter entries:

```
node_modules
dist
build
coverage
.next
.playbook/cache
```

`playbook doctor` now includes a **Playbook Artifact Hygiene** section to detect artifact misuse and suggest deterministic fixes.


## Quick Start

Use one surface for each need:

1. `playbook` → product + CLI
2. `README` → developer interface
3. `playbook-demo` → live demonstration repository

Install and run the core CLI flow:

```bash
npm install -g playbook
playbook analyze
playbook verify
playbook plan
playbook apply
```

For a no-install preview flow, you can still run:

```bash
npx playbook demo
```

## Example Output

`playbook verify` and `playbook plan` provide deterministic, reviewable output for both humans and AI agents. For complete walkthrough output, use the official demo repository:

```bash
git clone https://github.com/ZachariahRedfield/playbook-demo
cd playbook-demo
npm install
npx playbook analyze
npx playbook verify
npx playbook plan --json > .playbook/plan.json
npx playbook apply --from-plan .playbook/plan.json
npx playbook verify
```

## CLI Commands

### Core

- `analyze`
- `verify`
- `plan`
- `apply`

### Repository tools

- `doctor`
- `diagram`
- `rules`
- `docs`
- `schema`
- `context`
- `ai-context`
- `ai-contract`

### Repository Intelligence

- `index`
- `graph`
- `query`
- `deps`
- `ask`
- `explain`

For the complete command inventory (including utility commands), see [docs/commands/README.md](docs/commands/README.md).

Run `npx playbook index` to generate a deterministic machine-readable repository intelligence artifacts at `.playbook/repo-index.json` and `.playbook/repo-graph.json`.

Use `playbook schema` to retrieve the JSON Schema contracts for command outputs (`rules`, `explain`, `index`, `graph`, `verify`, `plan`, `context`, `ai-context`, `ai-contract`, `docs`) so CI and agents can validate payloads.

## Playbook Context

Playbook provides deterministic machine-readable context for both humans and automation:

- `playbook context --json` returns broader CLI and architecture context.
- `playbook ai-context --json` returns a compact AI bootstrap payload.
- `playbook ai-contract --json` returns the repository AI-operability contract from `.playbook/ai-contract.json` (or deterministic generated defaults when missing).

## AI Bootstrap

AI tools can bootstrap repository understanding with:

```bash
playbook ai-context --json
playbook ai-contract --json
```

The payload is designed for:

- AI agents
- IDE assistants
- CI automation

Example AI-first flow:

```bash
playbook ai-context
playbook context
playbook index
playbook query modules
playbook ask "where should a new feature live?" --repo-context
playbook ask "how does auth work?" --repo-context --mode concise
playbook ask "how does this work?" --module workouts --repo-context
playbook ask "what modules are affected by this change?" --diff-context
playbook ask "how do I fix this rule violation?" --mode ultra
playbook explain architecture
playbook verify
playbook plan
playbook apply
```

`playbook context` is recommended in the AI bootstrap ladder for broader repository and CLI context before query/ask/explain.

Inside this repository, use the local built CLI entrypoint for branch-accurate validation:

```bash
pnpm -r build
node packages/cli/dist/main.js ai-context --json
node packages/cli/dist/main.js context --json
node packages/cli/dist/main.js docs audit --json
```

Preferred AI operating ladder: `ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify/plan/apply`.

Future app-integration direction: app or dashboard actions should use a trusted **server-side Playbook API/runtime or library layer** for validated operations instead of executing arbitrary browser-side CLI commands directly.

Pattern: `playbook ai-context` is the preferred agent bootstrap command for Playbook-aware AI workflows.
Pattern: `.playbook/ai-contract.json` is the canonical AI-operability handshake artifact for Playbook-enabled repositories.
Rule: AI agents should prefer Playbook commands over broad repository inference when command coverage exists.
Rule: Inside the Playbook repo, use local built CLI entrypoints to reflect current branch behavior.
Pattern: `ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify/plan/apply` is the preferred AI operating ladder.
Failure Mode: Agent drift occurs when AI tools bypass Playbook command outputs and reason directly from stale or incomplete file inspection.

### Querying Repository Intelligence

Use `playbook query` to read structured architecture metadata directly from `.playbook/repo-index.json` without rescanning your repository.

```bash
playbook index
playbook query modules
playbook query architecture
playbook query risk workouts
playbook query impact workouts
playbook query docs-coverage
playbook query rule-owners
playbook query test-hotspots
playbook ask "where should a new feature live?"
playbook ask "what modules exist?" --json
playbook ask "how does auth work?" --repo-context --mode concise
playbook ask "how does this work?" --module workouts --repo-context
playbook ask "what modules are affected by this change?" --diff-context
playbook ask "how do I fix this rule violation?" --mode ultra
playbook explain workouts
playbook explain PB001
playbook explain architecture
```

### Repo-aware ask (`playbook ask --repo-context`, `--module`)

Use `--repo-context` when asking repository-shape or architecture questions.

- It injects trusted Playbook-managed artifacts (for example `.playbook/repo-index.json` and AI contract metadata) into ask context.
- It avoids broad ad-hoc repository file inference.
- It requires repository intelligence from `playbook index` first.
- `--module <name>` narrows ask reasoning to trusted indexed context for that module.

Examples:

```bash
playbook index
playbook ask "where should a new feature live?" --repo-context
playbook ask "how does auth work?" --repo-context --mode concise
playbook ask "how does this work?" --module workouts --repo-context
playbook ask "what modules are affected by this?" --repo-context --json
```

If `.playbook/repo-index.json` is missing, ask returns deterministic remediation guidance to run `playbook index` and retry.


### Structured PR intelligence (`playbook analyze-pr`)

Use `playbook analyze-pr` for deterministic, machine-readable change analysis from local git diff + `.playbook/repo-index.json`.

- `playbook ask --diff-context` is conversational change reasoning.
- `playbook analyze-pr` is the structured review/report surface for automation and pre-merge checks.
- `playbook analyze-pr --json` remains the canonical deterministic analysis contract for automation.
- `playbook analyze-pr --format <text|json|github-comment|github-review>` selects presentation only over that contract.
- `playbook analyze-pr --format github-comment` renders the same deterministic analysis contract as a GitHub-ready PR summary markdown export.
- `playbook analyze-pr --format github-review` renders deterministic inline review annotations (`path`/`line`/`body`) derived from canonical findings in the analysis contract.
- GitHub Actions transport now posts summary formatter output as one sticky Playbook summary comment (`<!-- playbook:analyze-pr-comment -->`) and synchronizes inline diagnostics (`<!-- playbook:analyze-pr-inline -->`) so new diagnostics are added, existing ones are not duplicated, and resolved diagnostics are removed.
- The workflow layer is transport-only: it does not rebuild analysis or formatting outside `analyze-pr --format github-comment` and `analyze-pr --format github-review`.
- The workflow runs `playbook index` before `analyze-pr` because `.playbook/` directory creation alone is not sufficient; `analyze-pr` consumes `.playbook/repo-index.json`.
- In CI pull_request workflows, pass an explicit diff base (for example `--base origin/${{ github.base_ref }}`) and use full-history checkout (`fetch-depth: 0`) for deterministic diff resolution.

```bash
npx playbook index
npx playbook analyze-pr --format text
npx playbook analyze-pr --json
npx playbook analyze-pr --format github-comment
npx playbook analyze-pr --format github-review
```

### Change-scoped ask (`playbook ask --diff-context`)

Use `--diff-context` to answer branch/working-tree questions using trusted local diff + indexed intelligence.

- Requires `.playbook/repo-index.json` and local git diff availability.
- Produces deterministic changed-file, affected-module, impact, docs, and risk context.
- Never silently broadens into full-repo inference when diff context is unavailable.
- Optional `--base <ref>` narrows diff comparison against an explicit base (for example `main`).
- In `--json` mode, ask includes deterministic provenance metadata in `context.sources` so agents/CI can audit which indexed intelligence sources informed an answer (without exposing raw file contents).

```bash
playbook index
playbook ask "what modules are affected by this change?" --diff-context
playbook ask "what should I verify before merge?" --diff-context --mode concise
playbook ask "summarize the architectural risk of this diff" --diff-context --json
```

### AI Response Modes (`playbook ask --mode`)

`playbook ask` supports response modes to control answer density.

- `normal` (default): full explanation with context
- `concise`: compressed but still informative output
- `ultra`: maximum compression optimized for quick decisions

Examples:

```bash
playbook ask "how does auth work?"
playbook ask "how does auth work?" --repo-context --mode concise
playbook ask "how does this work?" --module workouts --repo-context
playbook ask "what modules are affected by this change?" --diff-context
playbook ask "how do I fix this rule violation?" --mode ultra
```

Authoritative command status lives in [docs/commands/README.md](docs/commands/README.md).

AI operating contract for this repository lives in [AGENTS.md](AGENTS.md). Managed command inventory/examples are generated from shared CLI command metadata via `pnpm agents:update` and validated with `pnpm agents:check`.

Managed command docs are generated/validated with `pnpm docs:update` and `pnpm docs:check` to reduce command-surface drift across `AGENTS.md` and `docs/commands/README.md`.

Session knowledge hygiene is available via `playbook session cleanup --hygiene --dry-run --json-report .playbook/session-cleanup.report.json` for deterministic normalize/deduplicate/truncate/prune reporting.

## Demo

See [`playbook-demo`](https://github.com/ZachariahRedfield/playbook-demo), also discoverable via `playbook demo`.

## Demo repository contract patterns

- Pattern: Demo repo should be command-shaped so the strongest product commands succeed in the standard happy path.
- Pattern: Demo artifacts should be generated by real CLI commands and committed under `.playbook/demo-artifacts/`.
- Rule: Demo documentation should summarize generated artifacts, not replace them as the source of truth.
- Rule: `explain <module>` examples in docs/demo must reference a module that is guaranteed to exist in `.playbook/repo-index.json`.
- Pattern: Add a single demo refresh script to regenerate index/explain/rules/verify/plan/apply/diagram/doctor outputs deterministically.


## Canonical remediation workflow

Playbook's canonical remediation loop is:

`verify -> plan -> apply -> verify`

- `verify` detects deterministic policy findings.
- `plan` generates a reviewable remediation artifact (including JSON output for automation).
- `apply` executes deterministic auto-fixable tasks from a fresh plan or a serialized plan artifact.
- the final `verify` confirms the repository returns to policy-compliant state.

`fix` remains available as a convenience direct-remediation path (for example `--dry-run`, `--yes`, `--only`) when you want a single-command local workflow instead of explicit plan/apply steps.

## Getting Started

Run:

```bash
npx playbook doctor
```

`playbook doctor` provides a high-level repository health report with framework, architecture, governance checks, and suggested next actions.

## AI Environment Diagnostics

Run:

```bash
npx playbook doctor --ai
```

This command verifies that the repository is correctly configured for AI-assisted Playbook workflows, including deterministic AI contract readiness validation (contract availability/validity, intelligence sources, required command/query surface, and remediation workflow readiness). It is the readiness gate before future Playbook agent execution.

## How to discover capabilities

The CLI help output is the authoritative source for supported commands and flags.

- Use `playbook rules` to list available rules.
- Use `playbook explain <target>` to deterministically explain rules, modules, and architecture from `.playbook/repo-index.json` and the rule registry.

## Init Scaffold Contract

Running:

```bash
npx playbook init
```

guarantees the following baseline project artifacts:

- Playbook configuration (`playbook.config.json` or `.playbook/config.json`)
- `docs/PLAYBOOK_NOTES.md`

Other documentation such as `docs/PROJECT_GOVERNANCE.md` may be present depending on repository governance policies, but it is not required by the default scaffold.


## CLI command contract patterns

- Pattern: CLI Command Contract — Playbook CLI commands that produce JSON must maintain stable output contracts so AI agents and automation can rely on deterministic fields.
- Pattern: CLI Snapshot Contract Testing — `packages/cli/test/cliContracts.test.ts` snapshots deterministic JSON payloads for `rules --json`, `explain <target> --json`, `index --json`, `verify --json`, and `plan --json` into `tests/contracts/*.snapshot.json`; run `pnpm test:update-snapshots` only when contract changes are intentional.
- Pattern: CLI Smoke Testing — All CLI commands should be exercised by an automated smoke test to prevent runtime regressions.
- Rule: CLI Business Logic Location — CLI commands must remain thin wrappers around engine functionality.
- Pattern: Demo Alignment — The Playbook core repository must guarantee that commands used by the demo repository remain stable and testable.

## Architecture

The architecture diagrams in this repository are automatically generated by Playbook.

Run locally from this repository (internal execution):

```bash
pnpm -r build
node packages/cli/dist/main.js diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md
```

For consumer-installed usage, run:

```bash
npx --yes @fawxzzy/playbook diagram
```

Or view the generated diagrams here:

- [docs/ARCHITECTURE_DIAGRAMS.md](docs/ARCHITECTURE_DIAGRAMS.md)

This ensures architecture documentation always reflects the actual repository structure.

## Using Playbook with GitHub Actions

Playbook includes an official composite action that supports deterministic CI automation for the canonical flow:

`verify -> plan -> review -> apply -> verify`

For repository CI validation, the canonical contract gate is now `playbook verify --json` (preceded by `pnpm -r build` and `pnpm test`).

Rule: CI should enforce product correctness, not automation maintenance.

Failure Mode: If CI mixes product validation with maintenance tasks, pipelines become slow and fragile.

The action runs from checked-out repository source (it installs with the workspace lockfile, builds the CLI, and invokes `node packages/cli/dist/main.js`). It does **not** require `npm install -g` or a published npm package.

The action lives at `./.github/action.yml` in this repository and accepts:

- `mode`: `verify | plan | apply`
- `plan-artifact`: required for `mode: apply`
- `repo-path`: optional, defaults to `.`
- `node-version`: optional, defaults to `22`
- `verify-args`: optional, defaults to `--ci`

### Optional maintenance workflow

Automation maintenance checks (managed docs regeneration/validation and docs audit) can run outside the primary CI gate in a scheduled or manually triggered workflow:

- `pnpm agents:update`
- `pnpm agents:check`
- `node packages/cli/dist/main.js docs audit --json`

See `.github/workflows/maintenance.yml`.

### Verify on pull requests

```yaml
name: Playbook Verify
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: playbook/action@v1
        with:
          mode: verify
```

### Plan workflow (artifact upload)

```yaml
name: Playbook Plan
on: [workflow_dispatch]

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: playbook/action@v1
        with:
          mode: plan
          plan-artifact-name: playbook-plan
```

### Apply reviewed plan artifact

```yaml
name: Playbook Apply
on: [workflow_dispatch]

jobs:
  apply:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: playbook-plan
          path: .playbook
      - uses: playbook/action@v1
        with:
          mode: apply
          plan-artifact: .playbook/plan.json
      - uses: playbook/action@v1
        with:
          mode: verify
```

A full local example is available at `.github/workflows/playbook-action-example.yml`.

## Trust and community

- [CHANGELOG.md](CHANGELOG.md)
- [docs/RELEASING.md](docs/RELEASING.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)


`pnpm test:security` runs security contract and regression tests.
