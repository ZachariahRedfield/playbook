# Playbook Command Status Index

This is the authoritative command-state snapshot for Playbook product docs.

## Product-facing command surface (current)

The following section is generated from shared CLI command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:DOCS_COMMAND_STATUS_START -->

| Command / Artifact | Purpose | Status | Example |
| --- | --- | --- | --- |
| `analyze` | Analyze project stack | Current (implemented) | `playbook analyze --json` |
| `verify` | Verify governance rules | Current (implemented) | `playbook verify --ci --json` |
| `plan` | Generate a structured fix plan from rule findings | Current (implemented) | `playbook plan --json` |
| `apply` | Execute deterministic auto-fixable plan tasks | Current (implemented) | `playbook apply --from-plan .playbook/plan.json` |
| `doctor` | Repository health entry point for architecture, governance, and issues | Current (implemented) | `playbook doctor --fix --dry-run` |
| `diagram` | Generate deterministic architecture Mermaid diagrams | Current (implemented) | `playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` |
| `docs` | Audit documentation governance surfaces and contracts | Current (implemented) | `playbook docs audit --json` |
| `rules` | List loaded verify and analyze rules | Current (implemented) | `playbook rules --json` |
| `schema` | Print JSON Schemas for Playbook CLI command outputs | Current (implemented) | `playbook schema verify --json` |
| `context` | Print deterministic CLI and architecture context for tools and agents | Current (implemented) | `playbook context --json` |
| `ai-context` | Print deterministic AI bootstrap context for Playbook-aware agents | Current (implemented) | `playbook ai-context --json` |
| `ai-contract` | Print deterministic AI repository contract for Playbook-aware agents | Current (implemented) | `playbook ai-contract --json` |
| `index` | Generate machine-readable repository intelligence index | Current (implemented) | `playbook index --json` |
| `query` | Query machine-readable repository intelligence from .playbook/repo-index.json | Current (implemented) | `playbook query modules --json` |
| `deps` | Print module dependency graph from .playbook/repo-index.json | Current (implemented) | `playbook deps workouts --json` |
| `ask` | Answer repository questions from machine-readable intelligence context | Current (implemented) | `playbook ask "where should a new feature live?" --repo-context --json` |
| `explain` | Explain rules, modules, or architecture from repository intelligence | Current (implemented) | `playbook explain architecture --json` |
<!-- PLAYBOOK:DOCS_COMMAND_STATUS_END -->

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

Source of truth: shared command metadata in `packages/cli/src/lib/commandMetadata.ts`.

## Product-state anchoring rule

When command/workflow state changes, update these surfaces in the same change (or immediately after):

- `README.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/commands/README.md` and related command docs
- demo docs/contracts (`docs/ONBOARDING_DEMO.md`, `playbook demo` contract)
- `docs/CHANGELOG.md`

Pattern: **AI Anchor Drift**.

If docs and implementation disagree, treat implementation as source of truth and realign docs.


Command reference: [`playbook docs audit`](docs.md).


## Repo-aware ask (`playbook ask --repo-context`)

`playbook ask` supports `--repo-context` to inject trusted Playbook-managed repository intelligence into ask context.

- Uses deterministic artifacts (`.playbook/repo-index.json`) and AI contract metadata for context hydration.
- Does **not** trigger broad ad-hoc repository crawling.
- Requires `playbook index` when `.playbook/repo-index.json` is missing.

Deterministic missing-index guidance:

```text
Repository context is not available yet.
Run `playbook index` to generate .playbook/repo-index.json and retry.
```

Examples:

```bash
playbook ask "where should a new feature live?" --repo-context
playbook ask "how does auth work?" --repo-context --mode concise
playbook ask "how does this module work?" --module workouts --repo-context
playbook ask "what modules are affected by this?" --repo-context --json
```

In JSON mode, ask keeps the existing answer payload and adds `repoContext` metadata with `enabled` and `sources` fields so callers can audit provenance.

## AI Response Modes for `playbook ask`

`playbook ask` supports `--mode <mode>` to control output verbosity.

- `normal` (default): Full explanation with context
- `concise`: Compressed but informative
- `ultra`: Maximum compression

Examples:

```bash
playbook ask "how does auth work?"
playbook ask "how does auth work?" --mode concise
playbook ask "how does this work?" --module workouts
playbook ask "how do I fix this rule violation?" --mode ultra
```


## Security contract verification

Run `pnpm test:security` to execute security contract tests and regression tests that validate runtime guards.

## Runtime artifact intent by command

Use the following intent model when deciding whether command outputs stay local, are reviewed in automation, or are committed as stable contracts/docs:

- `index`
  - Default intent: **local runtime artifact** (`.playbook/repo-index.json`) regenerated as repository intelligence changes.
  - Commit guidance: usually gitignored; commit only when intentionally maintaining a deterministic contract/example snapshot.
- `plan`
  - Default intent: **reviewed automation artifact** (for example `.playbook/plan.json`) used for deterministic remediation workflows and CI/agent handoff.
  - Commit guidance: typically ephemeral; commit only when a repository explicitly treats plan artifacts as stable review contracts.
- `query` / `deps` / `ask` / `explain`
  - Default intent: **runtime reads and derived outputs** from `.playbook/repo-index.json`; results are usually ephemeral unless exported intentionally for docs/contracts.
- `session` cleanup/reporting flows
  - Default intent: **local hygiene/runtime maintenance artifacts** (for example cleanup reports under `.playbook/`).
  - Commit guidance: keep local unless intentionally preserving an audit example or contract fixture.
- `diagram` and docs-facing flows
  - Default intent: **committed docs/contracts** when repositories choose generated architecture/docs outputs as source-controlled documentation surfaces.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated artifacts on every run causes unnecessary repo-history growth and noisy diffs.

`.playbookignore` support is available for repository intelligence scans (`playbook index` and related repository scans). The file uses `.gitignore`-style syntax and should be used to exclude high-churn directories (for example `node_modules`, `dist`, `build`, `coverage`, `.next`, and `.playbook/cache`).


## Playbook artifact hygiene diagnostics (`doctor`)

`playbook doctor` includes a **Playbook Artifact Hygiene** section that reports:

- committed runtime artifacts
- very large generated JSON artifacts
- frequently modified generated artifacts
- missing `.playbookignore` in large repositories

In JSON mode, `doctor --json` includes a structured `artifactHygiene` payload with `classification`, `findings`, and `suggestions` arrays for deterministic automation handling.

Suggested remediation IDs:

- `PB012`: add `.playbookignore`
- `PB013`: update `.gitignore` for runtime artifacts
- `PB014`: move runtime artifacts to `.playbook/`


### Deterministic module impact

`playbook query impact <module>` converts indexed module/dependency data from `.playbook/repo-index.json` into deterministic module blast-radius analysis, including dependencies, reverse dependencies, and risk signals.

Rule: Module impact and module-scoped ask rely on Playbook-managed index artifacts, not ad-hoc rescans.
