# Artifact Evolution Policy

This policy defines compatibility and regeneration rules for persisted Playbook artifacts.

## Why this policy exists

Playbook’s long-term reliability depends on deterministic repository artifacts powering higher-level intelligence commands.

All persisted artifacts must include schema versioning and an explicit evolution policy.

## Contract scope

This policy applies to persisted artifacts produced or consumed by Playbook command workflows, including:

- `.playbook/repo-index.json`
- `.playbook/repo-graph.json`
- `.playbook/verify.json` and `verify --json` envelopes
- `.playbook/plan.json` and `plan --json` envelopes
- deterministic analyze-pr/risk outputs emitted via CLI JSON contracts
- demo and snapshot contract fixtures used for test/contract stability

## Required contract fields

All persisted artifacts must include:

- `schemaVersion`: explicit compatibility contract marker
- `command` or `kind`: producer identity and artifact classification
- deterministic ordering for list-like fields where ordering is part of the contract

## Compatibility model

Playbook uses semantic version intent for artifact schemas:

- **patch** (`1.0` -> `1.0.x` docs/tests only): clarifications with no payload shape change
- **minor** (`1.0` -> `1.1`): additive, backward-compatible fields or enum values
- **major** (`1.x` -> `2.0`): breaking change to required fields, semantics, or identifiers

### Non-breaking (allowed)

- adding optional fields
- adding additive node/edge kinds where consumers are instructed to tolerate unknown kinds
- adding deterministic summary sections that do not change existing required fields

### Breaking (requires major bump)

- removing or renaming required fields
- changing semantic meaning of existing fields
- changing ID conventions relied on by downstream consumers
- changing deterministic ordering assumptions without migration guidance

## Regeneration and freshness expectations

- `pnpm playbook index` is the canonical producer for `.playbook/repo-index.json` and `.playbook/repo-graph.json`.
- Repository intelligence consumers (`query`, `deps`, `ask --repo-context`, `explain`, `analyze-pr`) must treat index artifacts as authoritative and fail with deterministic guidance when missing.
- Freshness detection should surface deterministic warnings when artifacts appear stale relative to current repository state (for example via `pnpm playbook doctor`).
- CI pipelines should regenerate required runtime artifacts before artifact-consuming analysis steps.

## CI mismatch behavior

When artifact schema versions mismatch command expectations:

1. Command must fail deterministically with an explicit schema mismatch error.
2. Output should include actionable remediation (`re-run pnpm playbook index`, regenerate plan, or rerun producing command).
3. CI should treat mismatch as a contract failure, not a soft warning.

## Governance rule

Documentation synchronization is a required part of Playbook governance.

When artifact contracts evolve, update in the same PR:

- command docs (`docs/commands/*`)
- contract docs (`docs/contracts/*`)
- roadmap/changelog surfaces (`docs/PLAYBOOK_PRODUCT_ROADMAP.md`, `docs/CHANGELOG.md`)
- tests/snapshots/schemas guarding the affected command output
