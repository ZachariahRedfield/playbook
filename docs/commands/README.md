# Playbook Command Status Index

This is the authoritative command-state snapshot for Playbook product docs.

## Operator truth boundary

For live command behavior/status questions, this page is the canonical operator surface.
Roadmap and planning docs may describe sequencing intent, but they are not command-status authority.

## Command truth

- The canonical operator-facing command surface is `pnpm playbook <command>`.
- Direct `node packages/cli/dist/main.js <command>` examples are internal/debug-oriented unless explicitly labeled otherwise.
- `npx`/published-package command examples are not part of current operator guidance unless distribution docs explicitly say so.

## Deterministic governance gates

- `pnpm docs:check` blocks managed command-state drift (`AGENTS.md`, this command index, and `docs/contracts/command-truth.json`) by regenerating candidate outputs first, validating roadmap/docs governance against the regenerated set, and only then reporting whether promotion would be required.
- `node scripts/validate-roadmap-contract.mjs --ci` blocks roadmap/live-command boundary drift by validating roadmap `commands` against `docs/contracts/command-truth.json`.
- `pnpm playbook docs audit --ci --json` blocks command-truth drift findings marked as errors (for example duplicate command metadata or managed status-table mismatch).

## Product-facing command surface (current)

The following section is generated from shared CLI command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:DOCS_COMMAND_STATUS_START -->

| Command / Artifact | Purpose | Lifecycle | Role | Discoverability | Onboarding | Status | Example |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `analyze` | Analyze project stack | compatibility | compatibility | hidden-compatibility | Later | Current (implemented) | `pnpm playbook analyze --json` |
| `pilot` | Run one-command external baseline analysis workflow for a target repository | canonical | bootstrap | primary | Later | Current (implemented) | `pnpm playbook pilot --repo "./target-repo" --json` |
| `verify` | Verify governance rules | canonical | governance | primary | P8 | Current (implemented) | `pnpm playbook verify --ci --json` |
| `plan` | Generate a structured fix plan from rule findings | canonical | remediation | primary | P9 | Current (implemented) | `pnpm playbook plan --json` |
| `lanes` | Derive deterministic lane-state from .playbook/workset-plan.json | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook lanes --json` |
| `workers` | Assign deterministic proposal-only workers to ready lanes from .playbook/lane-state.json | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook workers assign --json` |
| `orchestrate` | Generate deterministic orchestration lane artifacts for a goal or tasks-file workset | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook orchestrate --goal "ship capability" --lanes 3 --format both` |
| `execute` | Execute orchestration lanes through the execution supervisor runtime | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook execute --json` |
| `cycle` | Run the hardened execution primitives as one deterministic cycle orchestration pass | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook cycle --json` |
| `apply` | Execute deterministic auto-fixable plan tasks | canonical | remediation | primary | P10 | Current (implemented) | `pnpm playbook apply --from-plan .playbook/plan.json` |
| `analyze-pr` | Analyze local branch/worktree changes with deterministic PR intelligence | canonical | repo-intelligence | secondary | Later | Current (implemented) | `pnpm playbook analyze-pr --json` |
| `review-pr` | Run governed read-only PR review by composing analyze-pr, improve, and policy evaluate outputs | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook review-pr --json` |
| `doctor` | Diagnose repository health by aggregating verify, risk, docs, and index analyzers | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook doctor --fix --dry-run` |
| `diagram` | Generate deterministic architecture Mermaid diagrams | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` |
| `patterns` | Inspect pattern knowledge graph data and review promotion candidates | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook patterns list --json` |
| `docs` | Audit documentation governance surfaces and contracts | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook docs audit --json` |
| `audit` | Audit deterministic architecture guardrails and platform hardening controls | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook audit architecture --json` |
| `rules` | List loaded verify and analyze rules | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook rules --json` |
| `schema` | Print JSON Schemas for Playbook CLI command outputs | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook schema verify --json` |
| `context` | Print deterministic CLI and architecture context for tools and agents | canonical | bootstrap | primary | P3 | Current (implemented) | `pnpm playbook context --json` |
| `ai-context` | Print deterministic AI bootstrap context for Playbook-aware agents | canonical | bootstrap | primary | P1 | Current (implemented) | `pnpm playbook ai-context --json` |
| `ai-contract` | Print deterministic AI repository contract for Playbook-aware agents | canonical | bootstrap | primary | P2 | Current (implemented) | `pnpm playbook ai-contract --json` |
| `test-triage` | Parse deterministic test failure triage guidance from captured Vitest/pnpm logs | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook test-triage --input .playbook/ci-failure.log --json` |
| `test-fix-plan` | Generate a bounded remediation plan from a deterministic test-triage artifact | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook test-fix-plan --from-triage .playbook/test-triage.json --json` |
| `test-autofix` | Orchestrate deterministic test diagnosis, bounded repair, apply, and narrow-first verification | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook test-autofix --input .playbook/ci-failure.log --json` |
| `remediation-status` | Inspect recent test-autofix remediation history, repeat-policy decisions, and retry guidance | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook remediation-status --json` |
| `ignore` | Suggest and safely apply ranked .playbookignore recommendations | canonical | remediation | primary | P12 | Current (implemented) | `pnpm playbook ignore suggest --repo ../target-repo --json` |
| `contracts` | Emit deterministic contract registry for schemas, artifacts, and roadmap status | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook contracts --json` |
| `index` | Generate machine-readable repository intelligence index | canonical | repo-intelligence | primary | P4 | Current (implemented) | `pnpm playbook index --json` |
| `graph` | Summarize machine-readable repository knowledge graph from .playbook/repo-graph.json | canonical | repo-intelligence | secondary | Later | Current (implemented) | `pnpm playbook graph --json` |
| `query` | Query machine-readable repository intelligence from .playbook/repo-index.json | canonical | repo-intelligence | primary | P5 | Current (implemented) | `pnpm playbook query modules --json` |
| `deps` | Print module dependency graph from .playbook/repo-index.json | canonical | repo-intelligence | secondary | Later | Current (implemented) | `pnpm playbook deps workouts --json` |
| `ask` | Answer repository questions from machine-readable intelligence context | canonical | repo-intelligence | primary | P7 | Current (implemented) | `pnpm playbook ask "where should a new feature live?" --repo-context --json` |
| `explain` | Explain rules, modules, or architecture from repository intelligence | canonical | repo-intelligence | primary | P6 | Current (implemented) | `pnpm playbook explain architecture --json` |
| `receipt` | Ingest explicit execution results into receipt, updated-state, and next-queue | canonical | utility | secondary | Later | Current (implemented) | `pnpm playbook receipt ingest execution-results.json --json` |
| `route` | Classify tasks and emit deterministic proposal-only execution plans for task-specific routing decisions | canonical | repo-intelligence | primary | Later | Current (implemented) | `pnpm playbook route "summarize current repo state" --json` |
| `architecture` | Verify subsystem registry ownership and architecture mapping integrity | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook architecture verify --json` |
| `promote` | Promote reviewed repo-local stories and reusable pattern candidates into canonical artifacts | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook promote story repo/<repo-id>/story-candidates/<candidate-id> --json` |
| `story` | Manage the canonical repo-local story backlog state | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook story list --json` |
| `learn` | Draft deterministic knowledge candidates from local diff and repository intelligence | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook learn draft --json --out .playbook/knowledge/candidates.json` |
| `memory` | Inspect, review, and curate repository memory artifacts with explicit human-reviewed doctrine promotion | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook memory events --json` |
| `improve` | Generate deterministic improvement candidates from memory events and learning-state signals | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook improve --json` |
| `knowledge` | Inspect read-only knowledge artifacts and provenance surfaces | canonical | repo-intelligence | secondary | Later | Current (implemented) | `pnpm playbook knowledge list --json` |
| `security` | Inspect deterministic security baseline findings and summary | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook security baseline summary --json` |
| `telemetry` | Inspect deterministic repository/process telemetry and compact cross-run learning summaries | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook telemetry learning --json` |
| `policy` | Evaluate improvement proposals against governed runtime evidence (read-only control-plane) | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook policy evaluate --json` |
| `agent` | Read runtime control-plane records and run plan-backed dry-run previews | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook agent run --from-plan .playbook/plan.json --dry-run --json` |
| `observer` | Manage deterministic local observer registry and read-only local API server | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook observer serve --port 4300` |
<!-- PLAYBOOK:DOCS_COMMAND_STATUS_END -->

## Command docs index

### Implemented command docs

- Core flow: [`verify`](verify.md), [`plan`](plan.md), [`apply`](apply.md), [`pilot`](pilot.md)
- Repository intelligence: [`index`](index.md), [`query`](query.md), [`knowledge`](knowledge.md), [`deps`](deps.md), [`ask`](ask.md), [`explain`](explain.md), [`analyze-pr`](analyze-pr.md), [`test-triage`](test-triage.md), [`test-fix-plan`](test-fix-plan.md), [`test-autofix`](test-autofix.md)
- AI bootstrap/context: [`ai-context`](ai-context.md), [`ai-contract`](ai-contract.md), [`context`](overview.md)
- Governance and support: [`docs`](docs.md), [`audit`](audit.md), [`rules`](rules.md), [`doctor`](doctor.md), [`schema`](schema.md), [`contracts`](contracts.md), [`ignore`](ignore.md), [`diagram`](diagram.md), [`route`](route.md), [`memory`](memory.md), [`patterns`](patterns.md), [`story`](story.md), [`promote`](promote.md), [`observer`](observer.md), [`receipt`](receipt.md), [`learn`](learn.md), [`fix`](fix.md), [`upgrade`](upgrade.md), [`status`](status.md), [`analyze`](analyze.md)
- `status proof` is the canonical external-consumer bootstrap proof surface for proving runtime + CLI + docs/artifact + execution/governance readiness in one read-only flow. Its required automation truth stays in the canonical `proof` payload; additive interpretation metadata must be explicitly governed when present.

### Implemented control-plane command docs

- [`orchestrate`](orchestrate.md) (implemented v0 lane-contract artifact generation)
- [`lanes`](lanes.md) (implemented deterministic lane-state tracking from workset plans)
- [`workers`](workers.md) (implemented deterministic proposal-only worker assignment from lane-state readiness)

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

- Rule: One canonical command matrix per lifecycle seam.
- Pattern: Prefer one explicit promotion surface over many near-synonyms.
- Failure Mode: Promotion surface sprawl makes governance legible in code but confusing to operators.

## Artifact workflow governance

Artifact-producing pipelines in this repository follow one sequencing rule: generate candidate state, validate the regenerated candidate, then promote approved outputs into committed locations.

- Rule: All artifact-producing pipelines must validate regenerated candidate state, not stale committed outputs.
- Pattern: Use isolated candidate generation plus gated promotion for deterministic artifact workflows.
- Failure Mode: Writing or validating committed outputs too early causes false failures, drift, and unsafe partial promotion.

Implementation note: shared staging helpers live in `scripts/staged-artifact-workflow.mjs` and are used by managed docs refresh, contract snapshot refresh, template sync, and fallback release asset packaging so sequencing logic stays consistent across pipelines.

- Rule: Generated artifacts must be produced in staging and promoted only after validation succeeds.
- Rule: Durable workflow outputs must expose normalized staged-promotion metadata when they write repo-visible state.
- Rule: Promotion must emit a deterministic receipt whenever canonical knowledge is mutated or mutation is attempted.
- Rule: Advisory planning may consume only active promoted knowledge by default.
- Pattern: Promotion should be inspectable with the same rigor as execution.
- Pattern: Lifecycle state is part of knowledge truth, not presentation metadata.
- Failure Mode: Knowledge writes without receipts create invisible drift and undermine trust in promotion history.
- Failure Mode: Stale or superseded patterns leaking into planning context creates silent guidance drift.
- `pnpm playbook promote ... --json` writes `.playbook/promotion-receipts.json` in the mutated scope so Observer artifact inspection can review promotion provenance, target fingerprints, and noop/conflict outcomes.
- `pnpm playbook promote pattern-retire|pattern-demote|pattern-recall|pattern-supersede --json` reuses the same audited receipt path as initial promotion and preserves provenance/supersession lineage instead of deleting history.
- `pnpm playbook receipt ingest --json` now writes `.playbook/memory/lifecycle-candidates.json` as a read-only review surface for freshness/demotion/supersession recommendations; outcome evidence may suggest lifecycle changes, but it must not auto-mutate promoted knowledge.
- `promotion-receipts.json` is canonically sorted for deterministic inspection; it is a governed audit artifact, not an append-order event stream.
- Pattern: Shared staged-artifact orchestration should provide generation isolation, candidate validation, and gated promotion.
- Pattern: Reuse one shared workflow promotion contract instead of command-local promotion result shapes.
- Failure Mode: Environment-sensitive generation paths and direct committed-output writes undermine deterministic artifact governance.
- Failure Mode: Ad hoc workflow promotion metadata fragments governance semantics and makes Observer/orchestration reasoning inconsistent.
- Snapshot refresh invariant: `node scripts/update-contract-snapshots.mjs` now refreshes snapshots through a built-CLI generator path that avoids Vitest/Vite/esbuild optional-native resolution; the only prerequisite is a current local build (`pnpm -r build`).

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

## Test failure triage (`pnpm playbook test-triage`)

`pnpm playbook test-triage --input <path> --json` converts captured Vitest / pnpm recursive failure logs into a deterministic diagnosis artifact with repeatable failure classes, low-risk repair planning guidance, and prioritized rerun commands.

- Rule: Automate diagnosis first, repair second, merge never.
- Pattern: Repeated CI failures can be bucketed into deterministic repair classes.
- Failure Mode: Manual re-triage of the same test failure shapes wastes operator time and hides reusable automation.

## Execution command-surface normalization (verify / route / orchestrate / execute / telemetry / improve)

These command surfaces now align on deterministic behavior for:

- side-effect-free `--help`
- stable JSON failure envelopes for command-surface/missing-artifact errors
- explicit owned artifact declarations in command help/docs
- consistent text/JSON semantic alignment for success and failure states

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

### Learn doctrine (`pnpm playbook learn doctrine`)

`pnpm playbook learn doctrine` is the first-class post-merge doctrine extraction flow for turning merged change summaries into reusable report-only learning.

- Accepts `--input <path>` for text/JSON fixture summaries or `--summary <text>` for inline summaries.
- Produces a deterministic report-only payload with concise change summary, Rule / Pattern / Failure Mode extraction, suggested notes updates, and candidate future checks.
- Does not mutate the repository in report-only mode.
- Keeps doctrine promotion manual; it does not auto-update source-of-truth docs.

Examples:

```bash
pnpm playbook learn doctrine --input tests/contracts/fixtures/doctrine-extraction-summary.json --json
pnpm playbook learn doctrine --summary "artifact governance / staged promotion hardened the workflow-promotion contract" --json
```

Doctrine summary anchors:

- Pattern: Post-merge learning should extract reusable doctrine from real code changes.
- Failure Mode: Valuable engineering doctrine remains trapped in conversations and PR context unless extracted into reusable system knowledge.

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

## Knowledge inspection surfaces (`pnpm playbook knowledge ...`)

Command boundary note:

- `memory` = lifecycle/review/mutation surfaces over raw memory artifacts (events, candidates, promoted records).
- `knowledge` = normalized, read-only inspection/query surface for governed knowledge retrieval and provenance.

`pnpm playbook knowledge` is the read-only inspection surface for normalized knowledge records.

- `knowledge list` enumerates all record types.
- `knowledge query` filters by type, status, module, rule, or text.
- `knowledge inspect <id>` reads one record.
- `knowledge provenance <id>` resolves direct evidence and related records.
- `knowledge stale` returns stale, retired, and superseded records.

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

### Cross-repo pattern learning (`patterns`)

`pnpm playbook patterns cross-repo --json` emits a read-only governed comparison artifact at `.playbook/cross-repo-patterns.json` with deterministic `source_repos`, pairwise `comparisons`, and evidence-backed `candidate_patterns`.

- `pnpm playbook patterns portability --pattern <patternId> --json` returns deterministic portability factors and evidence-backed ranking rows.
- `pnpm playbook patterns generalized --json` filters to high-portability read-only/manual-only candidates.
- `pnpm playbook patterns repo-delta --left <repoId> --right <repoId> --json` reports governed artifact deltas between two repositories.
- Cross-repo intelligence in this phase is read-only: no cross-repo mutation and no automatic promotion.

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

`pnpm playbook patterns cross-repo --json` now emits a read-only governed comparison artifact at `.playbook/cross-repo-patterns.json` with deterministic `source_repos`, pairwise `comparisons`, and evidence-backed `candidate_patterns`.

- `pnpm playbook patterns portability --pattern <patternId> --json` returns deterministic portability factors and evidence refs for candidate patterns.
- `pnpm playbook patterns generalized --json` returns high-portability read-only/manual-only candidate recommendations (no auto-promotion).
- `pnpm playbook patterns repo-delta --left <repoId> --right <repoId> --json` reports governed artifact deltas between two repositories.
- `pnpm playbook patterns proposals --json` now groups cross-repo evidence into promotable portable-pattern candidates with explicit memory/story promotion targets and evidence lineage.
- `pnpm playbook patterns proposals promote --proposal <proposal-id> --target memory|story [--repo <repo-id>] --json` keeps cross-repo promotion explicit while writing into governed memory or backlog surfaces.
- Reusable pattern storage is scope-first: repo-local promoted memory stays at `.playbook/memory/knowledge/patterns.json`, cross-repo proposal bridge artifacts stay at `.playbook/pattern-proposals.json`, and global reusable pattern memory is canonically `.playbook/patterns.json` under `PLAYBOOK_HOME` with deterministic compatibility reads from legacy `patterns.json`.
- Cross-repo comparison may suggest promotion, but promotion remains explicit: no automatic doctrine updates, no hidden story mutation, and no non-governed artifact ingestion.

- `playbook story list --json` exposes the canonical repo-local story backlog artifact at `.playbook/stories.json`.
- `playbook story candidates --json` derives and writes the non-canonical inspectable candidate artifact at `.playbook/story-candidates.json` without mutating `.playbook/stories.json`.
- `playbook story promote <candidate-id> --json` explicitly promotes one candidate into the canonical backlog artifact.
- `playbook promote story global/patterns/<pattern-id> --repo <repo-id> --json` explicitly seeds a repo-local story from promoted pattern `storySeed` metadata and records provenance back to `patterns.json`.

- Rule: Stories are the durable repo-scoped action unit and must remain structured first, narrative second.
- Rule: Global knowledge may suggest local work, but only repo-local stories may enter execution planning.
- Pattern: Backlog state is a canonical repo-local artifact, not a UI-owned construct.
- Pattern: Findings need durable interpretation before they become backlog work.
- Pattern: Candidate stories require grouping, dedupe, and explicit promotion.
- Pattern: Reusable knowledge compounds when it can seed bounded local backlog items.
- Failure Mode: If story state is introduced without a canonical artifact and governed writes, backlog semantics fragment immediately.
- Failure Mode: Raw finding -> automatic story conversion creates backlog spam and weak planning signal.
- Failure Mode: Letting patterns enter execution directly creates a second control path and breaks operator trust.

- `playbook story plan <id> --json`: generate a route/execution plan from canonical story intent while keeping story, plan, worker, and receipt as separate linked artifacts.
- `playbook route --story <id> --json`: derive a deterministic route directly from a story id and stamp stable `story_reference` metadata into the generated execution plan.

## Pattern lifecycle and transfer

- `pnpm playbook promote pattern-retire <pattern-id> --reason <text> --json`
- `pnpm playbook promote pattern-demote <pattern-id> --reason <text> --json`
- `pnpm playbook promote pattern-recall <pattern-id> --reason <text> --json`
- `pnpm playbook patterns transfer export --pattern <id> --target-repo <repo-id> --json`
- Transfer packages are governance-bounded: exports carry provenance, sanitization, compatibility, risk, known failure modes, and recall/demotion lifecycle hooks; imports land as candidate-only input pending local review.
- Rule: Cross-repo transfer moves governed packages, not auto-enforced truth.
- Pattern: Transfer should preserve provenance and local review boundaries.
- Failure Mode: Importing foreign doctrine directly into execution context breaks private-first governance.
- `pnpm playbook patterns transfer import --file <path> --repo <repo-id> --json`
- `playbook route --story <id> --json`: derive a deterministic route directly from a story id and stamp stable `story_reference` metadata plus advisory `pattern_context` into the generated execution plan.
- Promoted global patterns may inform story-backed planning through read-only advisory context, but only repo-local stories remain execution authority.


## Test-fix planning (`pnpm playbook test-fix-plan`)

`pnpm playbook test-fix-plan --from-triage <artifact> --json` converts the stable `test-triage` diagnosis artifact into the bounded `test-fix-plan` remediation artifact, writing `.playbook/test-fix-plan.json` by default and carrying forward explicit exclusions for risky or unsupported findings. When operators choose to cross the mutation boundary, `pnpm playbook apply --from-plan .playbook/test-fix-plan.json` reuses the same reviewed `apply --from-plan` execution seam and task selection rules as ordinary plan artifacts.

Architecture note:

- `test-triage` = diagnosis.
- `test-fix-plan` = bounded repair planning.
- `apply` = reviewed execution.
- Risky findings remain review-required and must not be converted into executable tasks by diagnosis or planning docs.

`pnpm playbook test-autofix --input <path> --json` now includes a repeat-aware remediation policy layer between remediation history and mutation. Stable failure signatures are used to reuse prior successful repair guidance, block repeated failed repair classes after a bounded threshold, or escalate mixed repeat history for review instead of replaying noisy bad fixes. This command still performs at most one bounded repair attempt per run.

- Rule: trust-boundary docs must evolve at the same time as remediation command surfaces.
- Rule: every canonical remediation command must expose one stable artifact contract and one authoritative operator doc.
- Pattern: diagnosis -> planning -> execution should be documented as separate stages with different mutation authority.
- Pattern: add new remediation commands as artifact-producing seams before orchestration wrappers.
- Failure Mode: operators assume diagnosis commands mutate state if docs blur planning and execution boundaries.
- Failure Mode: hidden CLI-only behavior without contract/docs coverage drifts faster than engine truth.
