# Playbook

Deterministic repo runtime and trust layer for humans and AI agents.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) [![Playbook Diagrams Check](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml/badge.svg)](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml) ![Version](https://img.shields.io/badge/version-v0.1.1-blue)
[![Architecture](https://img.shields.io/badge/architecture-auto--generated%20by%20playbook-blueviolet?style=flat-square&logo=mermaid)](docs/ARCHITECTURE_DIAGRAMS.md)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

Playbook helps humans and AI agents understand, govern, and safely change real repositories through deterministic repo intelligence and reviewed remediation.

Playbook is not positioned as a general-purpose chat assistant. It is the runtime between assistants and production codebases: explicit contracts, deterministic findings, and policy-gated change loops.

## Category and product claim

Playbook is best understood as **deterministic repo intelligence + governance + safe remediation runtime**:

- **Read substrate**: `ai-context`, `ai-contract`, `index`, `query`, `deps`, `ask --repo-context`, `explain`
- **Governance kernel**: `verify`
- **Change bridge**: `plan -> apply -> verify`
- **Delivery surfaces**: one engine used via CLI, CI, automation, and integrations

This framing is the core promise: deterministic evidence over ad-hoc inference, and reviewed intent before execution.

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

Use `.playbookignore` to control repository intelligence scan scope for `pnpm playbook index` and other repository scans. The syntax mirrors `.gitignore`.

Recommended starter entries:

```
node_modules
dist
build
coverage
.next
.playbook/cache
```

`pnpm playbook doctor` now includes a **Playbook Artifact Hygiene** section to detect artifact misuse and suggest deterministic fixes.


## Quick Start (canonical ladder)

### Command truth

- The canonical operator-facing invocation form is `pnpm playbook <command>`.
- Direct execution via `node packages/cli/dist/main.js <command>` is internal/debug-oriented unless explicitly called out for implementation workflows.
- Do not use `npx`-based package examples for operator guidance unless Playbook publish/distribution docs explicitly reintroduce that path.

Run the canonical Playbook-first operating ladder:

```bash
pnpm playbook ai-context --json
pnpm playbook ai-contract --json
pnpm playbook context --json
pnpm playbook index --json
pnpm playbook query modules --json
pnpm playbook explain architecture --json
pnpm playbook ask "where should a new feature live?" --repo-context --json
pnpm playbook verify --json
pnpm playbook plan --json --out .playbook/plan.json
pnpm playbook apply --from-plan .playbook/plan.json
pnpm playbook verify --json
```

`analyze` remains available for compatibility and lightweight stack inspection, but it is no longer the sole serious quick-start path.

For local branch-accurate validation inside this repository, prefer:

```bash
pnpm playbook plan --json --out .playbook/plan.json
pnpm playbook apply --from-plan .playbook/plan.json --json
```

PowerShell-safe local equivalent:

```powershell
pnpm playbook plan --json --out .playbook/plan.json
pnpm playbook apply --from-plan .playbook/plan.json --json
```

For a no-install preview flow:

```bash
pnpm playbook demo
```

`pnpm playbook demo` follows the same canonical serious-user ladder (`ai-context -> ai-contract -> context -> index -> query/explain -> verify -> plan -> apply -> verify`) and does not use `fix` as the primary onboarding path.

### External repo targeting

Use `--repo <path>` to run Playbook from this monorepo against another local repository without changing directories:

```bash
TARGET_REPO_PATH="../my-repo"
pnpm playbook --repo "$TARGET_REPO_PATH" context --json
pnpm playbook --repo "$TARGET_REPO_PATH" index --json
pnpm playbook --repo "$TARGET_REPO_PATH" query modules --json
pnpm playbook --repo "$TARGET_REPO_PATH" verify --json --out "$TARGET_REPO_PATH/.playbook/findings.json"
pnpm playbook --repo "$TARGET_REPO_PATH" plan --json --out "$TARGET_REPO_PATH/.playbook/plan.json"
```

This keeps `pnpm playbook <command>` as the canonical invocation while letting operators target external repositories deterministically from a single working checkout.

When `--repo` is set, runtime artifacts are written into the target repository under `.playbook/` (for example `repo-index.json`, `repo-graph.json`, `findings.json`, and `plan.json`).

### External Repo Pilot

Run the canonical external-repository analysis pipeline with one command:

```bash
pnpm pilot "C:\Users\zjhre\dev\FawxzzyFitness"
```

The pilot runner executes `context -> index -> query modules -> verify -> plan` and writes deterministic artifacts into the target repository:

- `.playbook/repo-index.json`
- `.playbook/repo-graph.json`
- `.playbook/findings.json`
- `.playbook/plan.json`

Rule — External Repo Analysis Should Be One Command.

Pattern — CLI Playbook Workflow Runner.

Failure Mode — Operator Command Drift.

External onboarding contract (minimal):

- `playbook.config.json` is optional; missing config is not a failure and Playbook runs with defaults.
- `.playbookignore` is optional; add it to tune repository scan scope for large/high-churn paths.
- `.playbook/` is runtime-generated Playbook state owned by Playbook commands for the target repo.
- first-run warning guidance is actionable: add `playbook.config.json` when you want explicit policy/config, add `.playbookignore` when scan scope should be narrowed.

## Example Output

`pnpm playbook verify` and `pnpm playbook plan` provide deterministic, reviewable output for both humans and AI agents. For complete walkthrough output, use the official demo repository:

```bash
git clone https://github.com/ZachariahRedfield/playbook-demo
cd playbook-demo
npm install
pnpm playbook ai-context --json
pnpm playbook index --json
pnpm playbook verify --json
# bash/zsh
pnpm playbook plan --json --out .playbook/plan.json
# PowerShell-safe
pnpm playbook plan --json --out .playbook/plan.json
pnpm playbook apply --from-plan .playbook/plan.json
pnpm playbook verify --json
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

Command truth packaging is metadata-driven via `packages/cli/src/lib/commandMetadata.ts` and generated as `docs/contracts/command-truth.json` (canonical vs compatibility vs utility + bootstrap/remediation sequencing).

Run `pnpm playbook index` to generate deterministic machine-readable repository intelligence artifacts at `.playbook/repo-index.json`, `.playbook/repo-graph.json`, and compressed module digests under `.playbook/context/modules/*.json`.

Complexity Through Compression: Playbook reduces repository complexity by extracting small deterministic artifacts (index -> graph -> module digests) and reusing them across query/explain/ask surfaces rather than repeatedly rescanning broad repository state.

Use `pnpm playbook schema` to retrieve the JSON Schema contracts for command outputs (`rules`, `explain`, `index`, `graph`, `verify`, `plan`, `context`, `ai-context`, `ai-contract`, `docs`) so CI and agents can validate payloads.

## Playbook Context

Playbook provides deterministic machine-readable context for both humans and automation:

- `pnpm playbook context --json` returns broader CLI and architecture context.
- `pnpm playbook ai-context --json` returns a compact AI bootstrap payload.
- `pnpm playbook ai-contract --json` returns the repository AI-operability contract from `.playbook/ai-contract.json` (or deterministic generated defaults when missing).

## AI Bootstrap

AI tools can bootstrap repository understanding with:

```bash
pnpm playbook ai-context --json
pnpm playbook ai-contract --json
```

The payload is designed for:

- AI agents
- IDE assistants
- CI automation

Example AI-first flow:

```bash
pnpm playbook ai-context
pnpm playbook context
pnpm playbook index
pnpm playbook query modules
pnpm playbook ask "where should a new feature live?" --repo-context
pnpm playbook ask "how does auth work?" --repo-context --mode concise
pnpm playbook ask "how does this work?" --module workouts --repo-context
pnpm playbook ask "what modules are affected by this change?" --diff-context
pnpm playbook ask "how do I fix this rule violation?" --mode ultra
pnpm playbook explain architecture
pnpm playbook verify
pnpm playbook plan
pnpm playbook apply
```

`pnpm playbook context` is recommended in the AI bootstrap ladder for broader repository and CLI context before query/ask/explain.

Inside this repository, use the local built CLI entrypoint for branch-accurate validation:

```bash
pnpm -r build
pnpm playbook ai-context --json
pnpm playbook context --json
pnpm playbook docs audit --json
```

Preferred AI operating ladder: `ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify/plan/apply`.

Future app-integration direction: app or dashboard actions should use a trusted **server-side Playbook API/runtime or library layer** for validated operations instead of executing arbitrary browser-side CLI commands directly.

Pattern: `pnpm playbook ai-context` is the preferred agent bootstrap command for Playbook-aware AI workflows.
Pattern: `.playbook/ai-contract.json` is the canonical AI-operability handshake artifact for Playbook-enabled repositories.
Rule: AI agents should prefer Playbook commands over broad repository inference when command coverage exists.
Rule: Inside the Playbook repo, use local built CLI entrypoints to reflect current branch behavior.
Pattern: `ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify/plan/apply` is the preferred AI operating ladder.
Failure Mode: Agent drift occurs when AI tools bypass Playbook command outputs and reason directly from stale or incomplete file inspection.

### Querying Repository Intelligence

Use `pnpm playbook query` to read structured architecture metadata directly from `.playbook/repo-index.json` without rescanning your repository.

For modular-monolith repositories, Playbook indexes `src/features/*` directories as first-class modules (falling back to immediate `src/*` module directories when `src/features/*` is absent).

```bash
pnpm playbook index
pnpm playbook query modules
pnpm playbook query architecture
pnpm playbook query risk workouts
pnpm playbook query impact workouts
pnpm playbook query docs-coverage
pnpm playbook query rule-owners
pnpm playbook query test-hotspots
pnpm playbook ask "where should a new feature live?"
pnpm playbook ask "what modules exist?" --json
pnpm playbook ask "how does auth work?" --repo-context --mode concise
pnpm playbook ask "how does this work?" --module workouts --repo-context
pnpm playbook ask "what modules are affected by this change?" --diff-context
pnpm playbook ask "how do I fix this rule violation?" --mode ultra
pnpm playbook explain workouts
pnpm playbook explain PB001
pnpm playbook explain architecture
```

### Repo-aware ask (`pnpm playbook ask --repo-context`, `--module`)

Use `--repo-context` when asking repository-shape or architecture questions.

- It injects trusted Playbook-managed artifacts (for example `.playbook/repo-index.json` and AI contract metadata) into ask context.
- It avoids broad ad-hoc repository file inference.
- It requires repository intelligence from `pnpm playbook index` first.
- `--module <name>` narrows ask reasoning to trusted indexed context for that module.

Examples:

```bash
pnpm playbook index
pnpm playbook ask "where should a new feature live?" --repo-context
pnpm playbook ask "how does auth work?" --repo-context --mode concise
pnpm playbook ask "how does this work?" --module workouts --repo-context
pnpm playbook ask "what modules are affected by this?" --repo-context --json
```

If `.playbook/repo-index.json` is missing, ask returns deterministic remediation guidance to run `pnpm playbook index` and retry.


### Structured PR intelligence (`pnpm playbook analyze-pr`)

Use `pnpm playbook analyze-pr` for deterministic, machine-readable change analysis from local git diff + `.playbook/repo-index.json`.

- `pnpm playbook ask --diff-context` is conversational change reasoning.
- `pnpm playbook analyze-pr` is the structured review/report surface for automation and pre-merge checks.
- `pnpm playbook analyze-pr --json` remains the canonical deterministic analysis contract for automation.
- `pnpm playbook analyze-pr --format <text|json|github-comment|github-review>` selects presentation only over that contract.
- `pnpm playbook analyze-pr --format github-comment` renders the same deterministic analysis contract as a GitHub-ready PR summary markdown export.
- `pnpm playbook analyze-pr --format github-review` renders deterministic inline review annotations (`path`/`line`/`body`) derived from canonical findings in the analysis contract.
- GitHub Actions transport now posts summary formatter output as one sticky Playbook summary comment (`<!-- playbook:analyze-pr-comment -->`) and synchronizes inline diagnostics (`<!-- playbook:analyze-pr-inline -->`) so new diagnostics are added, existing ones are not duplicated, and resolved diagnostics are removed.
- The workflow layer is transport-only: it does not rebuild analysis or formatting outside `analyze-pr --format github-comment` and `analyze-pr --format github-review`.
- The workflow runs `pnpm playbook index` before `analyze-pr` because `.playbook/` directory creation alone is not sufficient; `analyze-pr` consumes `.playbook/repo-index.json`.
- In CI pull_request workflows, pass an explicit diff base (for example `--base origin/${{ github.base_ref }}`) and use full-history checkout (`fetch-depth: 0`) for deterministic diff resolution.

```bash
pnpm playbook index
pnpm playbook analyze-pr --format text
pnpm playbook analyze-pr --json
pnpm playbook analyze-pr --format github-comment
pnpm playbook analyze-pr --format github-review
```

### Change-scoped ask (`pnpm playbook ask --diff-context`)

Use `--diff-context` to answer branch/working-tree questions using trusted local diff + indexed intelligence.

- Requires `.playbook/repo-index.json` and local git diff availability.
- Produces deterministic changed-file, affected-module, impact, docs, and risk context.
- Never silently broadens into full-repo inference when diff context is unavailable.
- Optional `--base <ref>` narrows diff comparison against an explicit base (for example `main`).
- In `--json` mode, ask includes deterministic provenance metadata in `context.sources` so agents/CI can audit which indexed intelligence sources informed an answer (without exposing raw file contents).

```bash
pnpm playbook index
pnpm playbook ask "what modules are affected by this change?" --diff-context
pnpm playbook ask "what should I verify before merge?" --diff-context --mode concise
pnpm playbook ask "summarize the architectural risk of this diff" --diff-context --json
```

### AI Response Modes (`pnpm playbook ask --mode`)

`pnpm playbook ask` supports response modes to control answer density.

- `normal` (default): full explanation with context
- `concise`: compressed but still informative output
- `ultra`: maximum compression optimized for quick decisions

Examples:

```bash
pnpm playbook ask "how does auth work?"
pnpm playbook ask "how does auth work?" --repo-context --mode concise
pnpm playbook ask "how does this work?" --module workouts --repo-context
pnpm playbook ask "what modules are affected by this change?" --diff-context
pnpm playbook ask "how do I fix this rule violation?" --mode ultra
```

Authoritative command status lives in [docs/commands/README.md](docs/commands/README.md).

AI operating contract for this repository lives in [AGENTS.md](AGENTS.md). Managed command inventory/examples are generated from shared CLI command metadata via `pnpm agents:update` and validated with `pnpm agents:check`.

Managed command docs are generated/validated with `pnpm docs:update` and `pnpm docs:check` to reduce command-surface drift across `AGENTS.md` and `docs/commands/README.md`.

Session knowledge hygiene is available via `pnpm playbook session cleanup --hygiene --dry-run --json-report .playbook/session-cleanup.report.json` for deterministic normalize/deduplicate/truncate/prune reporting.

## Demo

See [`playbook-demo`](https://github.com/ZachariahRedfield/playbook-demo), also discoverable via `pnpm playbook demo`.

## Demo repository contract patterns

- Pattern: Demo repo should be command-shaped so the strongest product commands succeed in the standard happy path.
- Pattern: Demo artifacts should be generated by real CLI commands and committed under `.playbook/demo-artifacts/`.
- Rule: Demo documentation should summarize generated artifacts, not replace them as the source of truth.
- Rule: `explain <module>` examples in docs/demo must reference a module that is guaranteed to exist in `.playbook/repo-index.json`.
- Pattern: Add a single demo refresh script to regenerate index/explain/rules/verify/plan/apply/diagram/doctor outputs deterministically.
- Pattern: Cross-repo demo artifact refresh automation should run in dedicated maintenance workflows and open PRs against `ZachariahRedfield/playbook-demo` instead of mutating `main` directly.


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
pnpm playbook doctor
```

`pnpm playbook doctor` provides a high-level repository health report with framework, architecture, governance checks, and suggested next actions.

## AI Environment Diagnostics

Run:

```bash
pnpm playbook doctor --ai
```

This command verifies that the repository is correctly configured for AI-assisted Playbook workflows, including deterministic AI contract readiness validation (contract availability/validity, intelligence sources, required command/query surface, and remediation workflow readiness). It is the readiness gate before future Playbook agent execution.

Use `pnpm playbook doctor --help` to view doctor-specific flags, including `--ai`.

## How to discover capabilities

The CLI help output is the authoritative source for supported commands and flags.

- Use `pnpm playbook rules` to list available rules.
- Use `pnpm playbook explain <target>` to deterministically explain rules, modules, and architecture from `.playbook/repo-index.json` and the rule registry.

## Init Scaffold Contract

Running:

```bash
pnpm playbook init
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
pnpm playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md
```

For consumer-installed usage, run:

```bash
pnpm playbook diagram
```

Or view the generated diagrams here:

- [docs/ARCHITECTURE_DIAGRAMS.md](docs/ARCHITECTURE_DIAGRAMS.md)

This ensures architecture documentation always reflects the actual repository structure.

## Using Playbook with GitHub Actions

Playbook includes an official composite action that supports deterministic CI automation for the canonical flow:

`verify -> plan -> review -> apply -> verify`

For repository CI validation, the canonical contract gates are `pnpm playbook verify --json`, roadmap contract validation, and `pnpm playbook docs audit --ci --json` (preceded by `pnpm -r build` and `pnpm test`).

Rule: CI should enforce deterministic product/governance correctness and roadmap-contract alignment.

Failure Mode: If delivery workflow rules (roadmap linkage and docs governance) are documented but not enforced in CI, roadmap drift accelerates.

The action runs from checked-out repository source (it installs with the workspace lockfile, builds the CLI, and invokes `node packages/cli/dist/main.js`). It does **not** require `npm install -g` or a published npm package.

The action lives at `./.github/action.yml` in this repository and accepts:

- `mode`: `verify | plan | apply`
- `plan-artifact`: required for `mode: apply`
- `repo-path`: optional, defaults to `.`
- `node-version`: optional, defaults to `22`
- `verify-args`: optional, defaults to `--ci`

### Optional maintenance workflow

Automation maintenance checks (managed docs regeneration/validation) can run outside the primary CI gate in a scheduled or manually triggered workflow:

- `pnpm agents:update`
- `pnpm agents:check`

See `.github/workflows/maintenance.yml`.

### Demo refresh maintenance workflow

Cross-repo `playbook-demo` artifact/doc refresh automation is isolated from the main correctness CI path and runs through dedicated maintenance workflows:

- dry-run/integration: `.github/workflows/demo-integration.yml`
- PR-based refresh orchestration: `.github/workflows/demo-refresh.yml`

`demo-refresh` uses local branch-built CLI bits (`packages/cli/dist/main.js`) and runs `scripts/demo-refresh.mjs`, which:

- clones `ZachariahRedfield/playbook-demo`
- injects `PLAYBOOK_CLI_PATH`
- resolves refresh execution by package manager lockfile (`npm run <script>` for npm, `pnpm run <script>` for pnpm, `yarn run <script>` for yarn)
- runs refresh commands without `bash -lc` (argv/spawn execution)
- enforces an allowlist of committed generated surfaces
- configures git author identity in push mode (`PLAYBOOK_GIT_AUTHOR_NAME` / `PLAYBOOK_GIT_AUTHOR_EMAIL`, with bot defaults)
- configures explicit token auth for push via `PLAYBOOK_DEMO_GH_TOKEN` (or `GH_TOKEN`) and opens/updates a PR (never direct push to `main`).

Local usage:

- Safe default dry-run:
  - `node scripts/demo-refresh.mjs --dry-run`
- Push + PR mode:
  - `PLAYBOOK_DEMO_GH_TOKEN=<token> node scripts/demo-refresh.mjs --push --base main --feature-id PB-V1-DEMO-REFRESH-001`
- Optional overrides:
  - `PLAYBOOK_DEMO_REFRESH_CMD` (explicit refresh command override)
  - `PLAYBOOK_GIT_AUTHOR_NAME` / `PLAYBOOK_GIT_AUTHOR_EMAIL` (commit identity)

Workflow requirements for PR mode:

- secret: `PLAYBOOK_DEMO_GH_TOKEN`
- permissions: `contents: write`, `pull-requests: write`

Companion assumptions for demo-side script support are documented in `docs/integration/PLAYBOOK_DEMO_COMPANION_CHANGES.md`.

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
