# Playbook Development Workflow

## Purpose

This document defines the standard workflow for developing Playbook so changes remain consistent, governed, and easy to review.

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

For documentation/governance changes, also run:

```bash
pnpm playbook docs audit --ci --json
```

For remediation workflow updates, run canonical deterministic flow checks:

```bash
pnpm playbook verify --json
pnpm playbook plan --json
pnpm playbook apply --from-plan .playbook/plan.json --dry-run
```

For trusted release preparation, use the dedicated manual workflow instead of ordinary PR CI mutation. The release-prep path must stay on the existing reviewed mutation boundary:

```bash
pnpm playbook release plan --json --out .playbook/release-plan.json
pnpm playbook apply --from-plan .playbook/release-plan.json
```

The GitHub Actions workflow `.github/workflows/release-prep.yml` is the only automation that should commit the resulting reviewed package-version, linked-workspace-dependency, and managed changelog updates into the single release-prep PR branch. Normal PR CI remains detect/plan/report only and must never auto-apply release mutations.

Rule: Installable workflow policy is incomplete until the trusted/manual mutation path is installable too.
Pattern: Seed policy, seed reviewed executor, keep normal CI plan-only.
Failure Mode: Shipping only the policy file makes release governance look portable while leaving the actual release path repo-specific.

## Smoke testing

Run the repository smoke test:

```bash
node scripts/smoke-test.mjs
```

The smoke test validates command execution, template generation, and verify behavior.

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
