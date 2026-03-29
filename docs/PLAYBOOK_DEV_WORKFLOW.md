# Playbook Development Workflow

## Purpose

This document defines the standard workflow for developing Playbook so changes remain consistent, governed, and easy to review.

## Fact

- Workflow evidence should cite the commands, checks, and generated artifacts that were actually executed.

## Interpretation

- Workflow guidance should explain why those checks and artifacts are required for deterministic governance.

## Narrative

- Contributor-facing wording may evolve for clarity without changing factual evidence or governance meaning.

## Development principles

- Deterministic changes: every change is intentional, documented, and traceable.
- Documentation-driven delivery: command and behavior changes update their owning docs in the same change.
- Small increments: split large refactors into focused pull requests.

## Development loop

```text
Implement change
  ↓
Run tests and checks
  ↓
Update owned docs
  ↓
Open pull request
```

## Local setup

```bash
git clone https://github.com/<org>/playbook
cd playbook
pnpm install
pnpm -r build
```

## Required validation before PR

```bash
pnpm -r build
pnpm -r test
pnpm agents:update
pnpm agents:check
node scripts/validate-roadmap-contract.mjs
```

For pull request metadata validation in CI contexts, use:

```bash
node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id
```

The reusable Playbook CI action enforces this PR `feature_id` rule in `pull_request` workflows using deterministic precedence: PR title, then PR body, then `.playbook/pr-metadata.json` (`featureIds`).

Optional sync surface: run `pnpm pr:sync-metadata` to project `.playbook/pr-metadata.json` into GitHub PR title/body when token permissions allow. The sync helper degrades with warnings and is not required for validator success.

For retrieval review outcome changes, verify both queue and receipt seams stay deterministic:

Cadence fields are retrieval-review scheduling metadata only; they do not mutate doctrine.

Routing semantics for review outcomes are canonicalized in `docs/commands/knowledge.md` under `knowledge review handoffs` (single matrix, many consumers).

- Rule: Recall should be driven by both cadence and fresh evidence, not by time alone.
- Rule: Existing review surfaces should absorb evidence-triggered recall before inventing new workflow silos.
- Rule: Existing review surfaces should expose follow-up handoffs before inventing a new command family.
- Rule: Review decision meaning must stay consistent across docs, artifacts, and CLI surfaces.
- Pattern: Queue + receipt + cadence + evidence = governed retrieval review.
- Pattern: One review family should cover queue, receipt, and next-step handoff.
- Pattern: One routing matrix, many consumers.
- Failure Mode: A cadence-only system misses important new evidence; an evidence-only system becomes noisy and forgets routine maintenance.
- Failure Mode: Review systems that ignore fresh evidence become formally tidy but operationally stale.
- Failure Mode: Review outcomes become dead-end records instead of governed work handoffs.
- Failure Mode: Operators interpret revise/supersede differently across knowledge, docs, and backlog flows.

```bash
pnpm playbook knowledge review --due overdue --json
pnpm playbook knowledge review --trigger evidence --json
pnpm playbook knowledge review handoffs --decision revise --kind doc --json
pnpm playbook knowledge review record --from <queue-entry-id> --decision defer --json
```

For documentation/governance changes, also run:

```bash
pnpm playbook docs audit --ci --json
```

For remediation workflow updates, run canonical deterministic flow checks:

```bash
pnpm playbook verify --json
pnpm playbook plan --json
pnpm playbook apply --from-plan .playbook/plan.json --dry-run
pnpm playbook rendezvous create --json
pnpm playbook rendezvous status --json
pnpm playbook rendezvous release --dry-run --json
pnpm playbook interop fitness-contract --json
```

`rendezvous` is read-first in v1: it only creates/updates `.playbook/rendezvous-manifest.json` and never performs release mutation directly.

Fitness contract sync boundary clarification:

- Treat the Fitness contract as an external truth dependency consumed by this repository.
- Treat `pnpm playbook interop fitness-contract --json` as the canonical read-only verification seam for adapter/truth alignment.
- The Playbook-facing adapter must derive from the Fitness contract boundary rather than re-specifying it in local docs.
- If direct import from the external source is unavailable, any local mirror used for interop verification must match the upstream contract exactly (names, types, and semantics).

For trusted release preparation, use the dedicated manual workflow instead of ordinary PR CI mutation. The release-prep path must stay on the existing reviewed mutation boundary:

```bash
pnpm playbook release plan --json --out .playbook/release-plan.json
pnpm playbook apply --from-plan .playbook/release-plan.json
```

The GitHub Actions workflow `.github/workflows/release-prep.yml` is the only automation that should commit the resulting reviewed package-version, linked-workspace-dependency, and managed changelog updates into the single release-prep PR branch. Normal PR CI remains detect/plan/report only and must never auto-apply release mutations.

## Release Sync Enforcement

Release sync now has an atomic commit surface: use `pnpm playbook commit` instead of raw `git commit` for release-governed changes.

Behavior:

- `pnpm playbook commit` runs release sync, stages all repo changes, and executes `git commit` with pass-through flags (for example `-m`).
- `.husky/pre-commit` is warning-only for release drift (no mutation).
- `.husky/pre-push` remains fail-closed and blocks push when drift still exists.

Rule: Release governance must be applied before CI, not discovered by CI.
Rule: Release sync must occur before commit snapshot is created.
Rule: Release sync is part of commit, not a separate step.
Pattern: Atomic mutation = code + release state committed together.
Pattern: Mutation -> auto-sync -> commit -> push clean state.
Failure Mode: Relying on CI to detect release drift creates infinite failure loops and slows iteration.
Failure Mode: Separating release sync from commit creates drift and guarantees CI failure cycles.
Failure Mode: Mutating release state inside pre-commit leads to inconsistent commit snapshots and persistent CI drift.

Rule: Installable workflow policy is incomplete until the trusted/manual mutation path is installable too.
Pattern: Seed policy, seed reviewed executor, keep normal CI plan-only.
Failure Mode: Shipping only the policy file makes release governance look portable while leaving the actual release path repo-specific.
Rule: Release-plan output is generated runtime evidence; commit version/changelog results, not `.playbook/release-plan.json`.
Pattern: compute release plan -> mirror versions/changelog -> verify.
Failure Mode: Treating generated release-plan output as committed source of truth introduces drift between local and CI computation contexts.
Rule: Release-governed state should be reconciled inside the canonical mutation boundary, not as a separate human memory task.
Rule: Prefer one trusted finalization command (`apply`/`commit`) over separate release-memory steps.
Pattern: Compute -> Apply -> Verify (never Compute -> Verify).
Pattern: One trusted finalization path owns implementation writes and release-governance writes together.
Failure Mode: Generating release plans without applying them causes deterministic CI failures and repeated developer friction.
Failure Mode: Requiring developers to remember a separate release command creates deterministic CI failures from workflow friction, not implementation defects.
Rule: Release version must be derived from baseRef, not accumulated from prior local bumps.
Pattern: Compute from base -> apply once -> stable thereafter.
Failure Mode: Iterative release sync runs compound version increments and create infinite drift against CI.
Rule: Generated artifacts must not be enforced as committed repo state.
Pattern: Compute -> validate -> discard (not compute -> commit -> compare).
Failure Mode: Enforcing generated artifacts as committed state causes perpetual drift and CI instability.
Rule: Managed release artifacts must remain idempotent after first successful apply.
Pattern: Apply once, verify many times.
Failure Mode: Duplicate managed changelog prepends create permanent false drift.

## Release Sync Requirement

Release sync should run through `pnpm playbook commit` for atomic local commits, while pre-push keeps a fail-closed fallback check.

- Use `pnpm playbook commit -m "<message>"` for release-governed changes instead of raw `git commit`.
- `.husky/pre-commit` runs `pnpm playbook release sync --check` as warning-only and does not mutate.
- `.husky/pre-push` runs `pnpm playbook release sync --check` and fails closed without mutating repository state.
- CI parity is intentional: local push blocks and CI both fail on unresolved release drift.

Rule: Release plan must be applied before code leaves local environment.
Pattern: Detect drift locally -> apply -> commit -> push clean state.
Failure Mode: Relying on CI to detect release drift creates redundant failure cycles and slows iteration.
Rule: Release sync must be applied before pushing when drift exists.
Pattern: Local pre-push enforcement prevents CI release drift failures.
Failure Mode: Relying on CI-only detection causes repeated failed pipelines and wasted cycles.

## Smoke testing

Run the repository smoke test:

```bash
node scripts/smoke-test.mjs
```

The smoke test validates command execution, template generation, and verify behavior.

## CI sidecar reporting behavior

`analyze-pr-comment` reporting transport (sticky PR comments and inline diagnostics sync) is a non-authoritative sidecar: transient GitHub provider outages should degrade to warnings and not mark the workflow red when truth-producing checks already succeeded.

Rule: Optional reporting surfaces must degrade gracefully under transient provider outages.
Pattern: Truth-producing checks fail closed; commentary/reporting steps fail soft.
Failure Mode: When sidecar comment publishing is treated as a hard gate, transient GitHub instability looks like product failure.

## Component ownership

### CLI (`packages/cli`)

Responsibilities:

- command parsing
- user interface
- scaffolding templates
- invoking the engine

The CLI must not contain governance logic.

### Engine (`packages/engine`)

Responsibilities:

- repository analysis
- rule execution
- governance validation
- reporting

The engine must remain deterministic, modular, and testable.

## Rules and detectors

### Adding verify rules

Rules live in `packages/engine/src/verify/rules/` and should implement the Playbook rule contract with deterministic behavior and clear output.

### Adding analyze detectors

Detectors live in `packages/engine/src/analyze/detectors/` and should rely on stable filesystem signals rather than heavy parsing.

## Template updates

Templates used by `pnpm playbook init` live in `templates/repo/` and are promoted into the installable CLI template payload via the template sync/copy shipping flow.

Baseline scaffold outputs include:

- `docs/PLAYBOOK_NOTES.md`
- `playbook.config.json`

For eligible publishable Node/pnpm repositories, init should detect the root/workspace package layout and seed the full portable release-governance loop:

- `.playbook/version-policy.json`
- `.github/workflows/release-prep.yml`
- `docs/CHANGELOG.md` with the managed `PLAYBOOK:CHANGELOG_RELEASE_NOTES` block

`pnpm playbook upgrade --apply` should retrofit any missing release-governance scaffolding into the same eligible repos without clobbering existing custom workflow or policy content. That retrofit is now governed by `.playbook/managed-surfaces.json`: only `managed_by_playbook` paths may be auto-mutated, while repo-local product files remain immutable unless an explicit migration path is reviewed first.

Rule: Installable workflow policy is incomplete until the trusted/manual mutation path is installable too.
Pattern: Seed policy, seed reviewed executor, keep normal CI plan-only.
Failure Mode: Shipping only the policy file makes release governance look portable while leaving the actual release path repo-specific.

## Pull request guidelines

Pull requests should include:

- clear description
- reasoning behind the change
- documentation updates when applicable

PRs should remain focused and reviewable.

## Notes and release hygiene

Record major repository decisions in `docs/PLAYBOOK_NOTES.md` and keep `docs/CHANGELOG.md` aligned with released behavior.

## Documentation revision protocol (fact vs interpretation vs narrative)

For high-value documentation updates, follow `docs/architecture/PLAYBOOK_DOCUMENTATION_REVISION_PROTOCOL.md` before opening a PR.

Required classification for substantive edits:

- **Fact**: observed evidence only (commands, artifacts, chronology).
- **Interpretation**: meaning derived from facts.
- **Narrative**: communication framing and readability.

Rule: Documentation updates must preserve the difference between observed fact, interpretation, and narrative framing.
Pattern: Revise meaning without rewriting provenance.
Failure Mode: High-value docs that blend fact and interpretation silently mutate doctrine.

## Constraint-driven architecture decision protocol

For high-value architecture choices, use `docs/architecture/PLAYBOOK_CONSTRAINT_DRIVEN_ARCHITECTURE_RUBRIC.md` and record decisions with `templates/repo/docs/architecture/PLAYBOOK_ARCHITECTURE_DECISION_TEMPLATE.md` (installable via CLI template sync).

Required sections are intentionally compact:

- `## Constraints`
- `## Cost Surfaces`
- `## Options Considered`
- `## Chosen Shape`
- `## Why This Fits`
- `## Tradeoffs / Failure Modes`
- `## Review Triggers`

`pnpm playbook docs audit --json` enforces these sections only for `docs/architecture/decisions/*.md` via stable finding id `docs.architecture-rubric.required-sections`.

For deterministic extraction, write `## Review Triggers` entries in compact trigger form: `- [trigger_id] when <observable condition> -> <required review action>`.

Rule: Record architecture from governing constraints first, not from preferred shapes.
Pattern: Constraint -> optimization -> emergent structure.
Failure Mode: Teams cargo-cult attractive architectures without documenting the constraints that made them fit.
Rule: Architecture decisions should be recalled through explicit trigger metadata, not ad hoc memory.
Pattern: Architecture decision -> trigger hit -> retrieval review.
Failure Mode: Architecture decisions get written once and never re-evaluated when their own assumptions change.
Rule: Only governed architecture-decision docs should carry enforced rubric structure.
Pattern: Path-scoped architecture-rubric audit makes doctrine enforceable without widening documentation noise.
Failure Mode: Broad docs rules create compliance churn; no rubric rules leave architecture decisions style-driven and inconsistent.

## Operator postmortem reconsolidation loop

Use the new structured postmortem template as the first operational realization of `Recall -> reinterpret -> promote -> restabilize`. Keep this flow artifact-first and review-gated; it does not introduce a new command family or any automatic promotion path.

Compact operator workflow:

1. Incident or meaningful change happens.
2. Write a postmortem in the structured template (`templates/repo/docs/postmortems/PLAYBOOK_POSTMORTEM_TEMPLATE.md`) so facts, interpretations, changed mental models, and candidate updates stay separated.
3. Extract promotion candidates explicitly from the reviewed postmortem artifact.
4. Review those candidates through existing `memory` / `promote` surfaces before any doctrine changes land.
5. Restabilize the system by updating the right reviewed surfaces only: memory candidates, doctrine candidates, and docs revisions.

Postmortem outputs should feed three reviewed destinations:

- **Memory candidates** for evidence-bearing retrieval artifacts that may deserve future promotion.
- **Doctrine candidates** for reusable Rule / Pattern / Failure Mode updates that still require explicit review and promotion.
- **Docs revision** when the reviewed postmortem shows workflow, roadmap, or operator guidance should be clarified.

Rule: Retrieval-based revision must enter the system through explicit evidence-bearing review artifacts.
Rule: Postmortems must separate observed facts from interpretation and promotion candidates.
Pattern: Structured postmortem -> candidate extraction -> explicit promotion.
Pattern: Recall -> reinterpret -> promote -> restabilize becomes concrete through structured postmortems.
Failure Mode: Doctrine updates sourced from memory of the incident instead of the reviewed postmortem artifact create silent drift.
Failure Mode: Blending fact, explanation, and doctrine in one narrative rewrites history and weakens promotion quality.

## Deterministic delivery protocol (v1)

- Every PR must reference at least one roadmap `feature_id` from `docs/roadmap/ROADMAP.json`.
- Command output changes must update contract snapshots and `docs/contracts/COMMAND_CONTRACTS_V1.md`.
- Run `pnpm contracts:check` before the full test suite when contract-affecting surfaces change (`packages/contracts/**`, `packages/cli/**`, `packages/engine/src/memory/**`, contract registries, or snapshot emitters).
- Rule: Reduce duplicated execution before reducing coverage.
- Pattern: One authoritative gate per concern.
- Failure Mode: Running the same gate twice makes CI slower without making it safer.
- Generated artifacts must be produced in staging and promoted only after validation succeeds.
- Snapshot refresh uses the built CLI directly (`node scripts/update-contract-snapshots.mjs`) and therefore requires `pnpm -r build` before regeneration.
- Documentation and governance changes must pass `pnpm playbook docs audit` in CI.

## Suggested PR structure

Use this checklist in PR descriptions:

1. **Roadmap ID(s):** `PB-V...`
2. **Command surface affected:** list commands and output modes.
3. **Contracts updated:** schemas/docs/snapshots.
4. **Boundary impact:** CLI/Core/Engine ownership notes.
5. **Validation evidence:** exact commands run.


## Managed-vs-local upgrade boundary
- Rule: Upgrade must be scoped to managed artifacts only; repo-owned files are immutable unless explicitly migrated.
- Pattern: A safe framework upgrade system separates Playbook-managed surfaces from repo-local product truth.
- Failure Mode: Upgrade flows that cannot distinguish managed from local files overwrite product intent and destroy trust.

## AI proposal-only boundary

When using AI-assisted reasoning in Playbook, keep AI in proposal-only mode and route all state changes through governed deterministic commands.

Canonical pattern:

1. `pnpm playbook ai-context --json`
2. `pnpm playbook ai-contract --json`
3. `pnpm playbook ai propose --json --out .playbook/ai-proposal.json`
4. `pnpm playbook route ...` / `pnpm playbook plan --json`
5. `pnpm playbook apply --from-plan ...`
6. `pnpm playbook verify --json`

Rule: AI must remain a proposal-only layer within deterministic systems.

Pattern: AI -> proposal artifact -> route/plan/review -> apply -> verify.

Failure Mode: Allowing AI to mutate state directly collapses auditability and reproducibility.
