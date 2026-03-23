# `pnpm playbook verify`

## What it does
Runs deterministic governance rule checks and reports policy findings.

## Common usage
- `pnpm playbook verify`
- `pnpm playbook verify --ci`
- `pnpm playbook verify --json`
- `pnpm playbook verify --json --explain`
- `pnpm playbook verify --policy --json`
- `pnpm playbook verify --phase preflight --json --out .playbook/verify-preflight.json`

## Phase and rule selection

`verify` can now run a deterministic low-cost subset before the full repository gate.

- `--phase preflight` currently selects only `release.version-governance`.
- `--rule <id>` restricts execution to explicit rule ids without teaching CI any workflow-local semver logic.
- JSON output includes `phase` and `selectedRules` so `.playbook/verify-preflight.json` stays machine-auditable.
- The full later `pnpm playbook verify --json` run remains the final merge authority.

Canonical cheap CI preflight:

```bash
pnpm playbook release plan --json --out .playbook/release-plan.json
pnpm playbook verify --phase preflight --json --out .playbook/verify-preflight.json
```

## Policy mode

`--policy` evaluates verify findings against `verify.policy.rules` in `playbook.config.json`.

- Configured policy rules are treated as enforcement gates.
- Violations return exit code `3`.
- Non-policy verify failures remain informational in policy output.
- JSON responses include a `policyViolations` array.

## Contract notes
- JSON output uses a stable response envelope (`schemaVersion`, `command`, `ok`, `exitCode`).
- Findings are deterministic and sorted for machine consumption.
- Policy failures return exit code `3`.


## Command-surface guarantees

- `--help` is side-effect free and does not run verification or write artifacts.
- Missing-input and command-surface failures emit the standard deterministic CLI result envelope in `--json` mode.
- Owned artifacts are explicit: optional `--out` findings artifact plus execution run-state attachments when run metadata is present.


## Release/version governance gate

`verify` now fails closed for release-relevant diffs when canonical version governance is missing or inconsistent.

It checks three deterministic cases from repository evidence:
- missing required version bump for release-relevant package changes
- inconsistent lockstep `versionGroups`
- stable contract expansion without the corresponding applied package/changelog release updates

In text mode, failed runs also print compact `Next actions` so CI and local shells can reuse the canonical verify output instead of custom workflow logic.

Normal Playbook CI now follows `release plan -> preflight verify -> tests -> full verify`. The reusable action materializes `.playbook/release-plan.json`, runs `verify --phase preflight --json --out .playbook/verify-preflight.json` for cheap early release-governance failures, exits before `pnpm test` when that preflight is already sufficient to block, and still keeps the later full `.playbook/verify.json` run as merge authority. The underlying `.playbook/*` artifacts remain canonical and separate; `verify` still owns merge authority.

- Rule: Diff-based release governance should fail before expensive test execution when canonical preflight evidence is already sufficient.
- Pattern: Release plan -> preflight verify -> tests -> full verify.
- Failure Mode: Late release-governance failures waste CI time and make correct policy failures look like random downstream breakage.
