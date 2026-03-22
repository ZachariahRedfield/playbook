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
- `.playbook/version-policy.json`

For publishable Node/pnpm repositories, init should detect the root/workspace package layout and seed one explicit opt-out-capable `default` lockstep version group so release governance starts from installable policy rather than repo-by-repo setup drift.

Rule: Installable workflow policy belongs in templates, not tribal setup steps.
Pattern: Seed policy once, then let verify/release use it everywhere.
Failure Mode: Repo-by-repo manual version conventions never become reliable workflow.

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
