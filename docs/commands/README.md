# Playbook Command Status Index

This is the authoritative command-state snapshot for Playbook product docs.

## Command truth

- The canonical operator-facing command surface is `pnpm playbook <command>`.
- Direct `node packages/cli/dist/main.js <command>` examples are internal/debug-oriented unless explicitly labeled otherwise.
- `npx`/published-package command examples are not part of current operator guidance unless distribution docs explicitly say so.

## Product-facing command surface (current)

The following section is generated from shared CLI command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:DOCS_COMMAND_STATUS_START -->

| Command / Artifact | Purpose | Lifecycle | Role | Discoverability | Onboarding | Status | Example |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `analyze` | Analyze project stack | compatibility | compatibility | hidden-compatibility | — | Current (implemented) | `pnpm playbook analyze --json` |
| `pilot` | Run deterministic baseline external repository analysis in one command | canonical | bootstrap | primary | — | Current (implemented) | `pnpm playbook pilot --repo "./target-repo" --json` |
| `verify` | Verify governance rules | canonical | governance | primary | 8 | Current (implemented) | `pnpm playbook verify --ci --json` |
| `plan` | Generate a structured fix plan from rule findings | canonical | remediation | primary | 9 | Current (implemented) | `pnpm playbook plan --json` |
| `orchestrate` | Generate deterministic orchestration lane artifacts for a goal | canonical | remediation | primary | — | Current (implemented) | `pnpm playbook orchestrate --goal "ship capability" --lanes 3 --format both` |
| `apply` | Execute deterministic auto-fixable plan tasks | canonical | remediation | primary | 10 | Current (implemented) | `pnpm playbook apply --from-plan .playbook/plan.json` |
| `analyze-pr` | Analyze local branch/worktree changes with deterministic PR intelligence | canonical | repo-intelligence | secondary | — | Current (implemented) | `pnpm playbook analyze-pr --json` |
| `doctor` | Diagnose repository health by aggregating verify, risk, docs, and index analyzers | canonical | governance | secondary | — | Current (implemented) | `pnpm playbook doctor --fix --dry-run` |
| `diagram` | Generate deterministic architecture Mermaid diagrams | utility | utility | secondary | — | Current (implemented) | `pnpm playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` |
| `patterns` | Apply explicit local promotion decisions for compacted pattern candidates | canonical | governance | secondary | — | Current (implemented) | `pnpm playbook patterns promote --id <pattern-id> --decision approve` |
| `docs` | Audit documentation governance surfaces and contracts | canonical | governance | secondary | — | Current (implemented) | `pnpm playbook docs audit --json` |
| `audit` | Audit deterministic architecture guardrails and platform hardening controls | canonical | governance | secondary | — | Current (implemented) | `pnpm playbook audit architecture --json` |
| `rules` | List loaded verify and analyze rules | canonical | governance | secondary | — | Current (implemented) | `pnpm playbook rules --json` |
| `schema` | Print JSON Schemas for Playbook CLI command outputs | utility | utility | secondary | — | Current (implemented) | `pnpm playbook schema verify --json` |
| `context` | Print deterministic CLI and architecture context for tools and agents | canonical | bootstrap | primary | 3 | Current (implemented) | `pnpm playbook context --json` |
| `ai-context` | Print deterministic AI bootstrap context for Playbook-aware agents | canonical | bootstrap | primary | 1 | Current (implemented) | `pnpm playbook ai-context --json` |
| `ai-contract` | Print deterministic AI repository contract for Playbook-aware agents | canonical | bootstrap | primary | 2 | Current (implemented) | `pnpm playbook ai-contract --json` |
| `pilot` | Run one-command external baseline analysis workflow for a target repository | canonical | bootstrap | primary | 11 | Current (implemented) | `pnpm playbook pilot --repo ../target-repo --json` |
| `ignore` | Suggest and safely apply ranked .playbookignore recommendations | canonical | remediation | primary | 12 | Current (implemented) | `pnpm playbook ignore suggest --repo ../target-repo --json` |
| `contracts` | Emit deterministic contract registry for schemas, artifacts, and roadmap status | utility | utility | secondary | — | Current (implemented) | `pnpm playbook contracts --json` |
| `index` | Generate machine-readable repository intelligence index | canonical | repo-intelligence | primary | 4 | Current (implemented) | `pnpm playbook index --json` |
| `graph` | Summarize machine-readable repository knowledge graph from .playbook/repo-graph.json | canonical | repo-intelligence | secondary | — | Current (implemented) | `pnpm playbook graph --json` |
| `query` | Query machine-readable repository intelligence from .playbook/repo-index.json | canonical | repo-intelligence | primary | 5 | Current (implemented) | `pnpm playbook query modules --json` |
| `deps` | Print module dependency graph from .playbook/repo-index.json | canonical | repo-intelligence | secondary | — | Current (implemented) | `pnpm playbook deps workouts --json` |
| `ask` | Answer repository questions from machine-readable intelligence context | canonical | repo-intelligence | primary | 7 | Current (implemented) | `pnpm playbook ask "where should a new feature live?" --repo-context --json` |
| `explain` | Explain rules, modules, or architecture from repository intelligence | canonical | repo-intelligence | primary | 6 | Current (implemented) | `pnpm playbook explain architecture --json` |
| `route` | Classify tasks into deterministic execution vs bounded model reasoning routes | canonical | repo-intelligence | primary | — | Current (implemented) | `pnpm playbook route "summarize current repo state" --json` |
| `learn` | Draft deterministic knowledge candidates from local diff and repository intelligence | utility | utility | secondary | — | Current (implemented) | `pnpm playbook learn draft --json --out .playbook/knowledge/candidates.json` |
| `memory` | Inspect, review, and curate repository memory artifacts with explicit human-reviewed doctrine promotion | utility | utility | secondary | — | Current (implemented) | `pnpm playbook memory events --json` |
| `agent` | Read runtime control-plane records and run plan-backed dry-run previews | utility | utility | secondary | — | Current (implemented) | `pnpm playbook agent run --from-plan .playbook/plan.json --dry-run --json` |
<!-- PLAYBOOK:DOCS_COMMAND_STATUS_END -->

## Command docs index

### Implemented command docs

- Core flow: [`verify`](verify.md), [`plan`](plan.md), [`apply`](apply.md), [`pilot`](pilot.md)
- Repository intelligence: [`index`](index.md), [`query`](query.md), [`deps`](deps.md), [`ask`](ask.md), [`explain`](explain.md), [`analyze-pr`](analyze-pr.md)
- AI bootstrap/context: [`ai-context`](ai-context.md), [`ai-contract`](ai-contract.md), [`context`](overview.md)
- Governance and support: [`docs`](docs.md), [`audit`](audit.md), [`rules`](rules.md), [`doctor`](doctor.md), [`schema`](schema.md), [`contracts`](contracts.md), [`ignore`](ignore.md), [`diagram`](diagram.md), [`route`](route.md), [`memory`](memory.md), [`fix`](fix.md), [`upgrade`](upgrade.md), [`analyze`](analyze.md)

### Implemented control-plane command docs

- [`orchestrate`](orchestrate.md) (implemented v0 lane-contract artifact generation)

## External repository targeting (`pnpm playbook --repo <path> <command>`)

- Canonical local invocation remains `pnpm playbook <command>`.
- Use `pnpm playbook --repo <path> <command>` to execute against an external repository without changing directories.
- Global `--repo` is parsed only from the argv prefix before the command token.
- Any `--repo` flags after the command token are command-local options and are left untouched for command parsers.
- External analysis writes deterministic runtime artifacts into the target repo's `.playbook/` directory.

Canonical one-command baseline flow:

```bash
TARGET_REPO_PATH="../my-repo"
pnpm playbook pilot --repo "$TARGET_REPO_PATH"
```

Optional convenience alias:

```bash
pnpm pilot "$TARGET_REPO_PATH"
```

`playbook pilot` deterministically executes `context -> index -> query modules -> verify -> plan`, writes machine-readable artifacts directly (`.playbook/findings.json`, `.playbook/plan.json`, `.playbook/pilot-summary.json`), and records one top-level runtime cycle with child phases.

Minimal external onboarding contract:

- `playbook.config.json` is optional and missing config must degrade gracefully to defaults.
- `.playbookignore` is optional and should be added when scan scope needs tuning.
- `.playbook/` is runtime-generated and owned by Playbook in the target repository.

Rule - External Runtime Writes Belong to the Target Repo
When a repo-intelligence CLI analyzes an external repository, all generated runtime artifacts must land in the target repo, not the tool repo.

Pattern - Coexistence-First External Runtime
When introducing a new repo runtime into a real project with legacy tooling, run alongside the old system first and isolate outputs under deterministic artifact boundaries.

Failure Mode - Tool-Repo Gravity
If external analysis still reads from or writes to the tool's own repo context, the system is not actually operating as an external runtime.

Failure Mode - Positional Parse Regression
Adding global options before positional subcommands can silently break commands like `query modules` unless argv normalization is handled centrally and tested.

Rule - Repeated Multi-Step Operator Flows Deserve a First-Class Command.

Pattern - Orchestrated Baseline Analysis.

Failure Mode - Manual Workflow Drift.

Failure Mode - Helper Script Becomes Shadow Product Surface.

## Additional implemented CLI utility commands

The CLI registry currently also exposes utility commands not treated as part of the product-facing command set above:

<!-- PLAYBOOK:DOCS_UTILITY_COMMANDS_START -->

- `demo`
- `init`
- `fix`
- `status`
- `upgrade`
- `session`
<!-- PLAYBOOK:DOCS_UTILITY_COMMANDS_END -->

Source of truth: shared command metadata in `packages/cli/src/lib/commandMetadata.ts` and generated truth contract `docs/contracts/command-truth.json`.

## Product-state anchoring rule

When command/workflow state changes, update these surfaces in the same change (or immediately after):

- `README.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/commands/README.md` and related command docs
- demo docs/contracts (`docs/ONBOARDING_DEMO.md`, `pnpm playbook demo` contract)
- `docs/CHANGELOG.md`

Pattern: **AI Anchor Drift**.

If docs and implementation disagree, treat implementation as source of truth and realign docs.


Command reference: [`pnpm playbook docs audit`](docs.md).

## Learn draft (`pnpm playbook learn draft`)

`pnpm playbook learn draft` generates deterministic knowledge-candidate drafts from local git diff context plus indexed repository intelligence.

- Requires `.playbook/repo-index.json` (run `pnpm playbook index` first when missing).
- Writes machine-readable candidates to `.playbook/knowledge/candidates.json` by default.
- Supports `--out <path>` to redirect artifact output.
- Supports `--append-notes` to append a human-readable draft section to `docs/PLAYBOOK_NOTES.md`.
- Candidate evidence contains only changed file paths (no raw source content), and dedupe markers are deterministic MVP placeholders (`kind: none`).

Examples:

```bash
pnpm playbook learn draft --json --out .playbook/knowledge/candidates.json
pnpm playbook learn draft --base main --json
pnpm playbook learn draft --append-notes --json
```

Artifact intent:

- `.playbook/knowledge/**` is runtime draft state and should stay gitignored by default.
- Promote/commit knowledge artifacts only when intentionally reviewed for upstream inclusion.

## Memory inspection surfaces (`pnpm playbook memory ...`)

`pnpm playbook memory` exposes thin operator review surfaces for repo-local memory artifacts.

- `memory events` lists episodic events with deterministic filters.
- `memory candidates` lists replay candidates for review.
- `memory knowledge` lists promoted knowledge records.
- `memory show <id>` resolves either a candidate id or knowledge id, including provenance expansion for candidates.
- `memory promote <candidate-id>` and `memory retire <knowledge-id>` provide explicit, human-driven lifecycle actions.

Examples:

```bash
pnpm playbook memory events --json
pnpm playbook memory candidates --json
pnpm playbook memory knowledge --json
pnpm playbook memory show <id> --json
```

## Internal knowledge compaction status (no public command surface yet)

- Compaction currently exists as internal deterministic engine behavior, not as a discoverable top-level CLI command.
- The current internal slice includes canonicalization, deterministic bucketing (`discard | attach | merge | add`), and deterministic review artifacts layered on top of bucket decisions.
- Review artifacts use canonical reason codes as the machine contract; human-readable rationale is derived deterministically from those codes.
- Promotion workflows and long-lived pattern storage remain future roadmap work.

## Repo-aware ask (`pnpm playbook ask --repo-context`)

`pnpm playbook ask` supports `--repo-context` to inject trusted Playbook-managed repository intelligence into ask context.

- Uses deterministic artifacts (`.playbook/repo-index.json`) and AI contract metadata for context hydration.
- Does **not** trigger broad ad-hoc repository crawling.
- Requires `pnpm playbook index` when `.playbook/repo-index.json` is missing.

Supported question classes (deterministic repository-intelligence scope):

- repository/module placement (for example: "where should a new feature live?")
- architecture and dependency shape grounded in indexed modules
- impact/risk and ownership questions grounded in indexed contracts

Unsupported/bounded question classes:

- broad internet knowledge or non-repository trivia
- speculative future roadmap commitments not present in contracts
- hidden file-system exploration outside indexed/local Playbook artifacts

Deterministic fallback guidance:

- if index context is missing, run `pnpm playbook index` and retry with `--repo-context`
- if the question is outside repository-intelligence scope, pivot to `pnpm playbook query` / `pnpm playbook explain` targets for deterministic answers

Deterministic missing-index guidance:

```text
Repository context is not available yet.
Run `pnpm playbook index` to generate .playbook/repo-index.json and retry.
```

Examples:

```bash
pnpm playbook ask "where should a new feature live?" --repo-context
pnpm playbook ask "how does auth work?" --repo-context --mode concise
pnpm playbook ask "how does this module work?" --module workouts --repo-context
pnpm playbook ask "what modules are affected by this?" --repo-context --json
```


## Structured PR intelligence (`pnpm playbook analyze-pr`)

`pnpm playbook analyze-pr` provides deterministic pull-request/change analysis as machine-readable output.

- Uses trusted local git diff + `.playbook/repo-index.json`.
- Reuses indexed impact/risk/docs/ownership intelligence instead of duplicating logic.
- Reports changed files, affected modules, downstream impact, architecture boundaries touched, docs review suggestions, and merge guidance.
- Keeps `--json` as the canonical analysis contract and applies a single formatter pipeline for `--format text|json|github-comment|github-review`.
- Supports formatter exports, including `--format github-comment` for sticky PR summaries and `--format github-review` for inline review diagnostics on specific files/lines without adding new analysis inference.
- GitHub Actions transport posts the summary formatter output as one sticky Playbook PR comment (`<!-- playbook:analyze-pr-comment -->`) and synchronizes inline diagnostics (`<!-- playbook:analyze-pr-inline -->`) so new findings are added, unchanged findings are not duplicated, and resolved findings are removed.
- Artifact contract: `analyze-pr` consumes `.playbook/repo-index.json`, so CI runs `pnpm playbook index` before PR analysis; creating `.playbook/` alone is insufficient.
- Diff contract: CI should pass explicit base refs (for example `--base origin/${{ github.base_ref }}`) and use `fetch-depth: 0` checkout for deterministic PR diff analysis.

Examples:

```bash
pnpm playbook analyze-pr
pnpm playbook analyze-pr --format text
pnpm playbook analyze-pr --json
pnpm playbook analyze-pr --base main --json
pnpm playbook analyze-pr --format github-comment
pnpm playbook analyze-pr --format github-review
```

Pattern: `pnpm playbook analyze-pr` composes local diff context with indexed repository intelligence to produce deterministic pull request analysis.

Rule: Pull request intelligence must rely on trusted local git + Playbook-managed artifacts, not cloud-only or fuzzy repository inference.

Pattern: `ask --diff-context` is conversational change reasoning; `analyze-pr` is the structured review/report surface.

Failure Mode: PR analysis becomes untrustworthy when implementation duplicates diff/impact/risk logic instead of composing shared intelligence helpers.

## Change-scoped ask (`pnpm playbook ask --diff-context`)

`pnpm playbook ask` supports `--diff-context` to narrow repository reasoning to the active local change set.

- Uses deterministic local git diff + `.playbook/repo-index.json` intelligence mapping.
- Hydrates ask context with changed files, affected modules, impact/dependents, changed docs, and indexed risk signals.
- Does **not** silently broaden to full-repo reasoning when diff context cannot be resolved.
- `--module` and `--diff-context` are intentionally incompatible for deterministic scope selection.

Examples:

```bash
pnpm playbook index
pnpm playbook ask "what modules are affected by this change?" --diff-context
pnpm playbook ask "what should I verify before merge?" --diff-context --mode concise
pnpm playbook ask "summarize the architectural risk of this diff" --diff-context --json
pnpm playbook ask "what modules are affected?" --diff-context --base main
```

Pattern: `pnpm playbook ask --diff-context` narrows repository reasoning to the active change set using trusted local diff + index intelligence.

Rule: Change-scoped ask must derive context from Playbook-managed intelligence and explicit diff inputs, not broad ad-hoc repository inference.

Pattern: Module-scoped and diff-scoped reasoning should share the same underlying repository intelligence layer.

Pattern: Change review workflows become much more trustworthy when blast radius is derived from indexed structure and actual changed files together.

Failure Mode: Diff-aware reasoning becomes misleading when the tool silently expands from â€œchanged filesâ€ into full-repo inference without telling the user.

In JSON mode, ask keeps the existing answer payload and includes deterministic provenance metadata in `context.sources` (for example `repo-index`, `module`, `diff`, `docs`, `rule-registry`, and `ai-contract`) plus `repoContext` hydration metadata. Provenance descriptors include only source metadata (paths/names/files), never raw repository file content.

## AI Response Modes for `pnpm playbook ask`

`pnpm playbook ask` supports `--mode <mode>` to control output verbosity.

- `normal` (default): Full explanation with context
- `concise`: Compressed but informative
- `ultra`: Maximum compression

Examples:

```bash
pnpm playbook ask "how does auth work?"
pnpm playbook ask "how does auth work?" --mode concise
pnpm playbook ask "how does this work?" --module workouts
pnpm playbook ask "how do I fix this rule violation?" --mode ultra
```


## Security contract verification

Run `pnpm test:security` to execute security contract tests and regression tests that validate runtime guards.

## Runtime artifact intent by command

Use the following intent model when deciding whether command outputs stay local, are reviewed in automation, or are committed as stable contracts/docs:

- `index`
  - Default intent: **local runtime artifacts** (`.playbook/repo-index.json`, `.playbook/repo-graph.json`, `.playbook/context/modules/*.json`) regenerated as repository intelligence changes.
  - JSON contract note: `pnpm playbook index --json` exposes `contextDir` so automation can discover digest artifact location deterministically.
  - Commit guidance: usually gitignored; commit only when intentionally maintaining a deterministic contract/example snapshot.
- `plan`
  - Default intent: **reviewed automation artifact** (for example `.playbook/plan.json`) used for deterministic remediation workflows and CI/agent handoff.
  - Safe capture examples:
    - bash/zsh: `pnpm playbook plan --json --out .playbook/plan.json`
    - PowerShell: `pnpm playbook plan --json --out .playbook/plan.json`
    - local Playbook repo path: `pnpm playbook plan --json --out .playbook/plan.json`
  - Commit guidance: typically ephemeral; commit only when a repository explicitly treats plan artifacts as stable review contracts.
- `query` / `deps` / `ask` / `explain`
  - Default intent: **runtime reads and derived outputs** from `.playbook/repo-index.json`; results are usually ephemeral unless exported intentionally for docs/contracts.
- `session` memory + cleanup flows
  - Default intent: **local repo-scoped workflow continuity artifacts** (`.playbook/session.json`, pinned findings/plan/run refs) plus optional cleanup reports under `.playbook/`.
  - Recommended continuity commands: `pnpm playbook session show`, `pnpm playbook session pin <artifact>`, `pnpm playbook session resume`, `pnpm playbook session clear`.
  - Commit guidance: keep local unless intentionally preserving an audit example or contract fixture.
- `diagram` and docs-facing flows
  - Default intent: **committed docs/contracts** when repositories choose generated architecture/docs outputs as source-controlled documentation surfaces.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated artifacts on every run causes unnecessary repo-history growth and noisy diffs.

Rule â€” Machine-Consumed Artifacts Must Be CLI-Written
If a CLI expects downstream commands to read generated JSON artifacts, those artifacts must be written by the CLI itself rather than relying on shell redirection.

Pattern â€” First-Class Artifact Emission
Structured runtime artifacts should be emitted through explicit flags with controlled encoding, directory creation, and content boundaries.

Failure Mode â€” Shell Redirection Artifact Corruption
When JSON artifacts are captured through script wrappers and shell redirection, banner text or encoding differences can silently corrupt machine-readable files.

Failure Mode â€” Human-Readable Wrapper Leakage
Operator-friendly wrapper output is acceptable on stdout, but it must never leak into persisted JSON artifacts that are intended for later programmatic reads.

Failure Mode â€” Opaque JSON Parse Crash
When corrupted runtime artifacts are parsed without a guardrail, later commands fail far from the original write site, making the real bug harder to diagnose.

Pattern â€” Artifact Consumers Treat Prior JSON as Untrusted Input
Commands that consume prior runtime artifacts should treat those files as untrusted inputs and degrade gracefully when artifacts are missing or malformed.

Failure Mode â€” Hidden Optional Artifact Dependency Crash
A secondary command like index can fail because of a hidden dependency on stale or corrupted `.playbook/*.json` artifacts produced by an earlier workflow step.

`.playbookignore` support is available for repository intelligence scans (`pnpm playbook index` and related repository scans). The file uses `.gitignore`-style syntax and should be used to exclude high-churn directories.

Recommended bootstrap flow:

```bash
pnpm playbook pilot --repo "<target-repo>"
pnpm playbook ignore suggest --repo "<target-repo>" --json
pnpm playbook ignore apply --repo "<target-repo>" --safe-defaults
```

`ignore suggest` reports ranked recommendations, safety level, rationale, expected scan impact, and whether each entry is already covered. `ignore apply --safe-defaults` writes only `safe-default` entries into a deterministic managed block and leaves lower-confidence recommendations in review-only output.
`ignore apply --safe-defaults` also writes explicit ignore outcome telemetry to `.playbook/runtime/current/ignore-apply.json` (and per-cycle copies), and updates `.playbook/runtime/history/ignore-apply-stats.json` as a compact cumulative rollup.

Rule - Apply Only Trusted Ignore Recommendations.

Pattern - Recommendation Before Application, Safe Defaults Before Review.

Failure Mode - Auto-Applying Ambiguous Ignores.

Failure Mode - Non-Idempotent Ignore Management.


## Playbook artifact hygiene diagnostics (`doctor`)

`pnpm playbook doctor` includes a **Playbook Artifact Hygiene** section that reports:

- committed runtime artifacts
- very large generated JSON artifacts
- frequently modified generated artifacts
- missing `.playbookignore` in large repositories

In JSON mode, `doctor --json` includes a structured `artifactHygiene` payload with `classification`, `findings`, and `suggestions` arrays for deterministic automation handling.

Suggested remediation IDs:

- `PB012`: add `.playbookignore`
- `PB013`: update `.gitignore` for runtime artifacts
- `PB014`: move runtime artifacts to `.playbook/`




### Deterministic pattern compaction query

`pnpm playbook query patterns` reads `.playbook/patterns.json` generated during `playbook verify` and returns compacted canonical engineering patterns.

- Canonical IDs collapse semantically equivalent observations (for example, module test absence variants).
- Buckets are deterministic: architecture, testing, dependency, documentation, governance.
- Output is stable machine-readable pattern summaries (`id`, `bucket`, `occurrences`, `examples`).

### Deterministic test hotspot discovery

`pnpm playbook query test-hotspots` reports likely test inefficiency candidates from test files using deterministic heuristics only.

- Detects candidate patterns such as broad retrieval followed by narrow filtering, repeated fixture setup, repeated CLI runner plumbing, and manual JSON contract plumbing.
- Emits stable text + JSON output for repository intelligence and validation automation workflows.
- Reports findings only (no codemod/apply behavior in MVP).

### Deterministic module impact

`pnpm playbook query impact <module>` converts indexed module/dependency data plus graph/digest context (`.playbook/repo-graph.json`, `.playbook/context/modules/*.json`) into deterministic module blast-radius analysis, including dependencies, reverse dependencies, docs/tests/rules, and risk signals when available.

Rule: Module impact and module-scoped ask rely on Playbook-managed index artifacts, not ad-hoc rescans.


## Deterministic Artifact Layer

Rule
Playbook artifacts must only be written via the artifact IO layer to guarantee determinism and pipeline reliability.

Failure Mode
Shell redirection (`>`) may introduce encoding corruption. CLI owned artifact output must always be preferred.

## Execution run state

Remediation ladder commands (`verify`, `plan`, `apply`, `verify`) now append deterministic step state to run artifacts at `.playbook/runs/<run-id>.json`.

Use query surfaces to inspect state:

- `pnpm playbook query runs`
- `pnpm playbook query run --id <run-id>`
