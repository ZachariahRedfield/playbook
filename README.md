# Playbook

Deterministic repo runtime and trust layer for humans and AI agents.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) [![Playbook Diagrams Check](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml/badge.svg)](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml) ![Version](https://img.shields.io/badge/version-v0.1.8-blue)
[![Architecture](https://img.shields.io/badge/architecture-auto--generated%20by%20playbook-blueviolet?style=flat-square&logo=mermaid)](docs/ARCHITECTURE_DIAGRAMS.md)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

Playbook helps humans and AI agents understand, govern, and safely change real repositories through deterministic repo intelligence and reviewed remediation.

Playbook is not positioned as a general-purpose chat assistant. It is the runtime between assistants and production codebases: explicit contracts, deterministic findings, and policy-gated change loops.

## Category and product claim

Playbook is best understood as **deterministic repo intelligence + governance + safe remediation runtime**:

- **Read substrate**: `ai-context`, `ai-contract`, `index`, `query`, `knowledge`, `deps`, `ask --repo-context`, `explain`
- **Governance kernel**: `verify`
- **Change bridge**: `plan -> apply -> verify`
- **Delivery surfaces**: one engine used via CLI, CI, automation, and integrations

This framing is the core promise: deterministic evidence over ad-hoc inference, and reviewed intent before execution.

Operator-facing text surfaces should stay brief-thin: lead with decision/status, affected surfaces, blockers, and next action, while leaving machine-heavy state in JSON contracts and `.playbook/*` artifacts.

- Rule: Human surfaces should show decision, action, and why — not raw machine state.
- Pattern: Artifact-rich, brief-thin operator surfaces keep review fast.
- Failure Mode: Making humans parse machine-oriented artifacts slows review and pushes important decisions off the visible surface.

Recent implementation note: `pnpm playbook test-autofix --input <path> --json` now closes the bounded test-remediation loop by orchestrating `test-triage`, `test-fix-plan`, `apply --from-plan`, and the exact narrow-first rerun plan already emitted by triage, while still preserving the same reviewed execution boundary and explicit final-status classification.
Recent implementation note: `test-autofix` now also persists `.playbook/test-autofix-history.json` as the evidence layer for bounded self-repair, recording stable failure signatures, admitted vs excluded findings, applied repair classes, verification outcomes, and provenance back to the failure log, triage artifact, fix-plan artifact, apply result, and final autofix artifact so repeat detection can become trustworthy before retry policy is automated.
Recent implementation note: `pnpm playbook test-fix-plan --from-triage <artifact> --json` now exposes the bounded remediation seam after diagnosis, turning only pre-approved low-risk `test-triage` findings into stable apply-compatible tasks while preserving risky or unsupported findings as explicit exclusions. Those artifacts are now accepted directly by `pnpm playbook apply --from-plan`, which reuses the existing approved-plan execution boundary instead of introducing a separate mutation path.
Recent implementation note: `test-autofix` now evaluates a deterministic repeat-aware remediation policy between history lookup and mutation, using stable failure signatures plus remediation history to allow one bounded repair attempt, surface a previously successful repair class as preferred guidance, or stop/escalate before replaying a known-bad fix. This slice still performs only one bounded repair attempt per run and does not introduce recursive autofix loops.
Recent implementation note: `pnpm playbook remediation-status --json` is now the canonical read-only soak surface for operators, aggregating the latest autofix result, remediation history, stable failure signatures, repeat-policy decisions, preferred repair classes, blocked retries, safe-to-retry signatures, confidence calibration buckets, failure-class success rates, blocked-low-confidence telemetry, conservative-confidence advisory signals, and deterministic soak rollups for failure classes, repair classes, blocked signatures, threshold counterfactuals, dry-run/apply deltas, and manual-review pressure so trust does not depend on reading raw artifacts by hand. This telemetry is tuning/observation only and does not widen mutation authority or introduce a second policy engine.
Recent implementation note: repository CI now captures failed `pnpm test` output to `.playbook/ci-failure.log`, runs canonical `test-autofix` in dry-run mode on protected branches, requires `autofix_confidence >= confidence_threshold` before any mutation path is allowed, uploads the resulting `.playbook/` remediation artifacts in both dry-run and apply modes, and renders one sticky PR remediation comment from those artifacts without introducing workflow-local repair logic.
Recent implementation note: `pnpm playbook test-triage` now doubles as Playbook's first-class failure-summary surface, normalizing Vitest/pnpm/GitHub Actions failures into deterministic `status`, `summary`, `primaryFailureClass`, `failures[]`, `crossCuttingDiagnosis[]`, and `recommendedNextChecks[]` fields while still preserving raw CI logs for auditability. CI now emits `.playbook/failure-summary.json` plus `.playbook/failure-summary.md` and appends the markdown summary directly to the GitHub step summary for copy-paste-ready remediation context.
Recent implementation note: `pnpm playbook learn doctrine --json` now provides a first-class report-only post-merge learning surface that turns merged change summaries into reusable Rule / Pattern / Failure Mode suggestions, notes-update guidance, and candidate future verification checks without auto-promoting doctrine into source-of-truth docs.
Recent implementation note: promoted reusable patterns now carry explicit lifecycle truth (`active`, `superseded`, `retired`, `demoted`), lifecycle mutations emit audited receipts through `pnpm playbook promote pattern-retire|pattern-demote|pattern-recall|pattern-supersede`, and advisory planning context consumes only active promoted knowledge by default.
Recent implementation note: `pnpm playbook receipt ingest --json` now converts receipts, drift signals, rollback/deactivation notes, promotion history, and later portability outcomes into reviewable `.playbook/memory/lifecycle-candidates.json` rows that stay candidate-only until explicit human lifecycle review.
Recent implementation note: `pnpm playbook docs consolidate --json` now provides a deterministic proposal-only docs seam for protected singleton narrative surfaces by reading worker fragments plus the protected-surface registry, writing `.playbook/docs-consolidation.json`, surfacing duplicate/conflicting fragment targets explicitly, and emitting one compact lead-agent integration brief without introducing any new doc mutation executor.
Recent implementation note: `pnpm playbook docs consolidate-plan --json` now compiles `.playbook/docs-consolidation.json` into the first-class `.playbook/docs-consolidation-plan.json` reviewed-write artifact, stamping target-locked file/block fingerprints or anchor context onto each executable task so `pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json` fails closed if reviewed protected-doc targets drift before execution. Protected singleton docs still mutate only through `apply --from-plan`, so consolidation planning does not become a shadow executor.

## Shared core, project-local intelligence

Playbook uses a **shared core + project-local Playbook state** integration model:

- The Playbook product (CLI/engine/contracts) is shared core.
- Playbook is designed to be installed **per repository**, not as a required global binary.
- Installing Playbook in a consumer repository creates **project-local Playbook state** (config, index/artifacts, plans, and repository-specific extensions), not a fork by default.
- Repository observations stay local/private by default.
- Reusable patterns and product improvements are promoted upstream intentionally (docs/roadmap/rules), not via hidden mutation.

Pattern: **private-first by default**. Standard Playbook usage does not imply automatic upstream content export.

Pattern: **config/plugins/rule packs over forks** for project-specific customization.

## Runtime artifacts and storage

Playbook uses `.playbook/` as the default home for local runtime artifacts (for example repository intelligence indexes, plans, and machine-readable reports).
Playbook also publishes checked-in machine-readable Lifeline presets under `exports/lifeline/` so external tooling can consume stable defaults directly from a local Playbook checkout without starting the Playbook UI.
Playbook routing inspection emits deterministic proposal-only execution plans at `.playbook/execution-plan.json` via `pnpm playbook route "<task>" --json`.

- Generated runtime artifacts should generally be gitignored unless intentionally committed as stable contracts/examples.
- Committed demo artifacts under `.playbook/demo-artifacts/` are product-facing snapshot contracts and examples, not general-purpose runtime logs.
- Allowed committed `.playbook` content is limited to curated contract/example fixtures (`.playbook/demo-artifacts/*.example.json`) and explicit governance metadata (`.playbook/pr-metadata.json`); generated runtime outputs like `.playbook/repo-index.json` and `.playbook/repo-graph.json` must remain untracked.
- Playbook remains local/private-first by default: local scanning and artifact generation do not imply automatic cloud sync or upstream export.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated runtime artifacts on every run causes unnecessary repository-history growth and review noise.

## Playbook artifact lifecycle

Playbook classifies repository artifacts into deterministic storage classes:

- **Runtime artifacts**: local outputs like `.playbook/repo-index.json`, `.playbook/plan.json`, `.playbook/verify.json`, `.playbook/session.json`, session cleanup reports, and cache files.
- **Automation artifacts**: CI handoff outputs such as CI plan and verification artifacts.
- **Contract artifacts**: committed snapshots and docs contracts like `tests/contracts/*.snapshot.json`, `.playbook/demo-artifacts/*`, and generated diagram documentation.

Use `.playbookignore` to control repository intelligence scan scope for `pnpm playbook index` and other repository scans. The syntax mirrors `.gitignore`.

Safe bootstrap flow:

```
pnpm playbook pilot --repo "<target-repo-path>" --json
pnpm playbook ignore suggest --repo "<target-repo-path>" --json
pnpm playbook ignore apply --repo "<target-repo-path>" --safe-defaults
```

`ignore suggest` reads ranked runtime recommendations and reports which entries are already covered. `ignore apply --safe-defaults` writes only `safe-default` entries into a deterministic managed block and leaves `review-first` recommendations as manual review items.

`pnpm playbook doctor` now includes a **Playbook Artifact Hygiene** section to detect artifact misuse and suggest deterministic fixes.

## Quick Start (canonical ladder)

Playbook operator workflows assume a **repo-local CLI install** (for example `node_modules/.bin/playbook` via `pnpm playbook ...`), so clean machines and CI do not depend on PATH-global Playbook binaries.

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
pnpm playbook apply --from-plan .playbook/test-fix-plan.json
pnpm playbook test-autofix --input .playbook/ci-failure.log --json
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
pnpm playbook --repo "$TARGET_REPO_PATH" index --json
pnpm playbook --repo "$TARGET_REPO_PATH" query modules --json
```

This keeps `pnpm playbook <command>` as the canonical invocation while letting operators target external repositories deterministically from a single working checkout.

### Consumer repository runtime resolution contract

Consumer repositories should resolve Playbook using this deterministic order:

1. `PLAYBOOK_BIN` override (explicit operator/CI choice).
2. Repo-local installed CLI (`node_modules/.bin/playbook`, typically via `pnpm playbook ...`).
3. Optional local-checkout development fallback (non-canonical; temporary development aid only).
4. Explicit failure with actionable guidance.

Rules:

- Global PATH-based `playbook` resolution is non-canonical and must never be required for successful operation.
- Missing runtime resolution must fail loudly with actionable setup guidance; silent PATH assumptions are not allowed.
- Development fallbacks must remain opt-in and must not become the default runtime path.

When `--repo` is set, runtime artifacts are written into the target repository under `.playbook/` (for example `repo-index.json`, `repo-graph.json`, `findings.json`, `plan.json`, and runtime cycle artifacts).

For machine-consumed JSON artifacts, use CLI-owned output flags (for example `--json --out ...`). Shell redirection is not a supported canonical artifact-generation path.

### External Repo Pilot

Canonical command:

```bash
pnpm playbook pilot --repo "C:\Users\zjhre\dev\FawxzzyFitness"
```

Optional convenience alias:

```bash
pnpm playbook pilot --repo "C:\Users\zjhre\dev\FawxzzyFitness"
```

Optional convenience alias:

```bash
pnpm pilot "C:\Users\zjhre\dev\FawxzzyFitness"
```

`playbook pilot` executes one deterministic baseline cycle (`context -> index -> query modules -> verify -> plan`), writes machine-readable artifacts directly, records one top-level runtime cycle with child phases, and emits a compact final summary.

Artifacts written in the target repository:

- `.playbook/repo-index.json` _(runtime-only, gitignored)_
- `.playbook/repo-graph.json` _(runtime-only, gitignored)_
- `.playbook/findings.json` _(runtime-only, gitignored)_
- `.playbook/plan.json` _(runtime-only, gitignored)_
- `.playbook/pilot-summary.json` _(runtime-only, gitignored)_
- `.playbook/runtime/current/*` _(runtime-only, gitignored)_
- `.playbook/runtime/cycles/*` _(runtime-only, gitignored)_
- `.playbook/runtime/history/*`

Rule - Repeated Multi-Step Operator Flows Deserve a First-Class Command.

Pattern - Orchestrated Baseline Analysis.

Failure Mode - Manual Workflow Drift.

Failure Mode - Helper Script Becomes Shadow Product Surface.

External onboarding contract (minimal):

- `playbook.config.json` is optional; missing config is not a failure and Playbook runs with defaults.
- `.playbookignore` is optional; add it to tune repository scan scope for large/high-churn paths.
- `.playbook/` is runtime-generated Playbook state owned by Playbook commands for the target repo.
- first-run warning guidance is actionable: add `playbook.config.json` when you want explicit policy/config, add `.playbookignore` when scan scope should be narrowed.

Recommended follow-up after `pilot`:

```bash
pnpm playbook ignore suggest --repo "C:\Users\zjhre\dev\FawxzzyFitness" --json
pnpm playbook ignore apply --repo "C:\Users\zjhre\dev\FawxzzyFitness" --safe-defaults
```

Rule - Apply Only Trusted Ignore Recommendations.

Pattern - Recommendation Before Application, Safe Defaults Before Review.

Failure Mode - Auto-Applying Ambiguous Ignores.

Failure Mode - Non-Idempotent Ignore Management.

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
- `ignore`
- `context`
- `ai-context`
- `ai-contract`

### Repository Intelligence

- `index`
- `graph`
- `query`
- `knowledge`
- `deps`
- `ask`
- `explain`

For the complete command inventory (including utility commands), see [docs/commands/README.md](docs/commands/README.md).

Command truth packaging is metadata-driven via `packages/cli/src/lib/commandMetadata.ts` and generated as `docs/contracts/command-truth.json` (canonical vs compatibility vs utility + bootstrap/remediation sequencing).

Run `pnpm playbook index` to generate deterministic machine-readable repository intelligence artifacts at `.playbook/repo-index.json`, `.playbook/repo-graph.json`, and compressed module digests under `.playbook/context/modules/*.json`.

Complexity Through Compression: Playbook reduces repository complexity by extracting small deterministic artifacts (index -> graph -> module digests) and reusing them across query/explain/ask surfaces rather than repeatedly rescanning broad repository state.

Use `pnpm playbook schema` to retrieve the JSON Schema contracts for command outputs (`rules`, `explain`, `index`, `graph`, `verify`, `plan`, `context`, `ai-context`, `ai-contract`, `query`, `knowledge`, `docs`) so CI and agents can validate payloads.

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
pnpm playbook knowledge list
pnpm playbook knowledge query --type candidate
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

`pnpm playbook knowledge` is the read-only inspection surface for normalized evidence, candidate knowledge, promoted doctrine, and superseded knowledge.

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

Managed command docs are generated and validated through a staged artifact pipeline with `pnpm docs:update` and `pnpm docs:check`, which regenerate candidate outputs first, validate roadmap/docs governance against those regenerated artifacts, and only then promote approved updates to `AGENTS.md`, `docs/commands/README.md`, and `docs/contracts/command-truth.json`.

Session knowledge hygiene is available via `pnpm playbook session cleanup --hygiene --dry-run --json-report .playbook/session-cleanup.report.json` for deterministic normalize/deduplicate/truncate/prune reporting.
Session continuity is repo-scoped and deterministic via `.playbook/session.json` with `pnpm playbook session show`, `pnpm playbook session pin <artifact>`, `pnpm playbook session resume`, and `pnpm playbook session clear`.

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

## Deterministic orchestration workflow

Use `pnpm playbook orchestrate --goal "<implementation goal>" --lanes 3 --format both` to compile a governance-safe lane contract set for parallel Codex plan-mode workers. The implemented v0 command writes `.playbook/orchestrator/orchestrator.json` plus lane prompt markdown artifacts (format-dependent), defines lane boundaries/dependencies, keeps prompts compact for humans, and reserves protected singleton docs for fragment-only contribution instead of direct concurrent edits. It remains control-plane only (no worker launch, branch, PR, or merge automation).
Use `pnpm playbook workers --json` or `pnpm playbook workers assign` to derive proposal-only worker assignment contracts from lane-state readiness and dependency gates. This writes `.playbook/worker-assignments.json` plus per-lane prompt handoff files in `.playbook/prompts/` without launching workers, creating branches, or automating PRs, while keeping full machine state in `.playbook` artifacts instead of duplicating it into worker prompts.

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

- Pattern: CLI Command Contract â€” Playbook CLI commands that produce JSON must maintain stable output contracts so AI agents and automation can rely on deterministic fields.
- Pattern: CLI Snapshot Contract Testing â€” `packages/cli/test/cliContracts.test.ts` snapshots deterministic JSON payloads for `rules --json`, `explain <target> --json`, `index --json`, `verify --json`, and `plan --json` into `tests/contracts/*.snapshot.json`; run `pnpm test:update-snapshots` only when contract changes are intentional.
- Pattern: CLI Smoke Testing â€” All CLI commands should be exercised by an automated smoke test to prevent runtime regressions.
- Rule: CLI Business Logic Location â€” CLI commands must remain thin wrappers around engine functionality.
- Pattern: Demo Alignment â€” The Playbook core repository must guarantee that commands used by the demo repository remain stable and testable.
- Pattern: Cross-Repo Pattern Learning â€” `pnpm playbook patterns cross-repo|portability|generalized|repo-delta` provides deterministic portability scoring from `.playbook/cross-repo-patterns.json` without introducing autonomous doctrine mutation.

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

Package-first runtime parity note: `@fawxzzy/playbook-cli` is now a thin entrypoint package that delegates directly to `@fawxzzy/playbook` runtime implementation, so consumer repos receive the same semantic `.playbook/*` artifacts (for example `findings.json`, `plan.json`, and `repo-graph.json`) instead of log-only shim behavior.

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

Automation maintenance checks (managed docs regeneration/validation) can run outside the primary CI gate in a scheduled or manually triggered workflow. Managed docs follow the same default artifact shape used by demo refresh: generate → validate → promote, so stale generated artifacts are refreshed before governance validation runs:

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

## Deterministic execution runs

Playbook now records multi-step remediation as first-class execution run state in `.playbook/runs/<run-id>.json`.

- Rule: Every multi-step remediation flow must be representable as a deterministic execution run artifact.
- Pattern: A system becomes agent-ready when actions are represented as inspectable state transitions rather than transient command output.
- Failure Mode: Without explicit run-state, the system cannot reliably resume, audit, compare, or learn from execution behavior.

Execution runs are appended by `verify`, `plan`, `apply`, and follow-up `verify`, and can be inspected via:

- `playbook query runs`
- `playbook query run --id <run-id>`

## Adoption readiness status

`pnpm playbook status --json` now includes a deterministic adoption/readiness contract for connected repositories:

- connection status and Playbook detection
- governed artifact presence/validity (`repo-index`, `repo-graph`, `plan`, `policy-apply-result`)
- lifecycle stage (`playbook_not_detected` -> `playbook_detected_index_pending` -> `indexed_plan_pending` -> `planned_apply_pending` -> `ready`)
- fallback-proof and cross-repo eligibility gates
- deterministic blockers and exact next command recommendations

Use this as the single operator status surface before running fallback proof or cross-repo comparison.
Run `pnpm playbook status proof --json` when you need an end-to-end external-consumer bootstrap proof. It deterministically validates runtime acquisition, local CLI resolution, initialization, required docs/governance artifacts, required execution state, and governed bootstrap contract success, then returns the single highest-priority next action if proof fails.

For portfolio-level triage, run `pnpm playbook status fleet --json` to aggregate lifecycle-stage counts, blocker frequencies, fallback/cross-repo eligibility counts, and deterministic `repos_by_priority` ordering across connected Observer repos.

For actionable execution sequencing, run `pnpm playbook status queue --json` to produce a deterministic, read-only adoption work queue with ordered work items, explicit dependencies, Wave 1/Wave 2 breakdown, and parallel-safe grouped action lanes.

For deterministic execution outcome ingestion, place operator-supplied prompt outcomes in `.playbook/execution-outcome-input.json` and run `pnpm playbook status receipt --json`. Playbook combines the current execution plan, current work queue, current readiness summary, and outcome input to emit a governed execution receipt that records prompt/wave/repo outcomes, artifact deltas, blockers, and planned-vs-actual lifecycle drift.

Receipt semantics:

- `intended_transition`: the lifecycle move implied by the planned lane (`connect` -> `playbook_not_detected`, `init` -> `playbook_detected_index_pending`, `index` -> `indexed_plan_pending`, `verify/plan` -> `planned_apply_pending`, `apply` -> `ready`).
- `observed_transition`: the lifecycle move proven by current governed readiness artifacts after execution.
- `status`: `success`, `failed`, `partial_success`, `mismatch`, or `not_run`, derived from the ingested operator outcome plus governed artifact evidence.

This receipt is designed to feed future prioritization cleanly: `verification_summary.repos_needing_retry[]` and `planned_vs_actual_drift[]` identify the exact repos/prompts that should return to the next deterministic work queue.

- Rule: execution receipts must prefer governed artifact evidence over operator claims whenever lifecycle state can be proven from readiness artifacts.
- Pattern: reuse execution plan + work queue + readiness as the only planning inputs so outcome ingestion does not invent a second reasoning system.
- Failure Mode: execution-outcome drift appears when operators report success but lifecycle evidence does not reach the planned target stage.

- Rule: identical readiness input must produce identical queue ordering, wave assignment, and execution-plan packaging.
- Pattern: execute grouped lanes in stage order (`init` -> `index` -> `verify/plan` -> `apply`) and keep one repo in one active lane per wave to reduce conflicts.
- Failure Mode: queue drift appears when dependent actions are run before prerequisite lane completion or when a repo is split across conflicting same-wave lanes.

- `playbook story list --json` exposes the canonical repo-local story backlog artifact at `.playbook/stories.json`.
- `playbook story candidates --json` derives and writes the non-canonical inspectable candidate artifact at `.playbook/story-candidates.json` without mutating `.playbook/stories.json`.
- `playbook story promote <candidate-id> --json` explicitly promotes one candidate into the canonical backlog artifact.
- `playbook promote story global/patterns/<pattern-id> --repo <repo-id> --json` explicitly seeds a repo-local story from promoted global pattern metadata while still writing only `.playbook/stories.json` in the target repo.
- `playbook route --story <id> --json` and `playbook story plan <id> --json` now attach read-only advisory `pattern_context` from promoted patterns, but only the repo-local story remains execution authority.
- `playbook promote` now emits deterministic audited receipts to `.playbook/promotion-receipts.json` for promoted, noop, and conflict outcomes so canonical knowledge mutation attempts remain inspectable through the same artifact-viewer path used elsewhere.
- `pnpm playbook patterns proposals --json` groups cross-repo comparisons into promotable portable-pattern/story candidates with evidence lineage and explicit governed promotion targets.
- `pnpm playbook patterns proposals promote --target memory` now lands as candidate-only input in `.playbook/memory/candidates.json`; it never auto-promotes imported/reused patterns into enforced doctrine.
- `pnpm playbook patterns transfer export --pattern <id> --target-repo <repo-id>` now emits deterministic transfer packages with provenance, sanitization status, compatibility metadata, risk class, known failure modes, and lifecycle hooks for later recall/demotion handling.
- `pnpm playbook patterns transfer import --file <path> --repo <repo-id>` imports those packages as candidate-only pattern input with fail-closed compatibility checks, pending local review, and no direct execution-planning effect.
- `pnpm playbook promote pattern-retire|pattern-demote|pattern-recall <pattern-id> --reason <text>` manages reusable-pattern lifecycle without removing receipt/audit lineage.
- `pnpm playbook patterns proposals promote --proposal <proposal-id> --target memory|story [--repo <repo-id>] --json` keeps cross-repo adoption explicit while bridging into reusable memory or canonical backlog surfaces.

- Rule: Stories are the durable repo-scoped action unit and must remain structured first, narrative second.
- Rule: Global knowledge may suggest local work, but only repo-local stories may enter execution planning.
- Pattern: Backlog state is a canonical repo-local artifact, not a UI-owned construct.
- Pattern: Findings need durable interpretation before they become backlog work.
- Pattern: Candidate stories require grouping, dedupe, and explicit promotion.
- Pattern: Reusable knowledge compounds when it can seed bounded local backlog items.
- Failure Mode: If story state is introduced without a canonical artifact and governed writes, backlog semantics fragment immediately.
- Failure Mode: Raw finding -> automatic story conversion creates backlog spam and weak planning signal.
- Failure Mode: Letting patterns enter execution directly creates a second control path and breaks operator trust.
- `pnpm playbook promote pattern ...` and global pattern read surfaces now normalize the canonical global reusable pattern store to `.playbook/patterns.json` under `PLAYBOOK_HOME`, with deterministic compatibility reads from legacy `patterns.json` during migration.
- Rule: One canonical storage contract per knowledge scope.
- Pattern: Scope-first knowledge resolution beats path inference.
- Failure Mode: Global pattern path drift creates operator confusion and hidden read/write mismatch.
