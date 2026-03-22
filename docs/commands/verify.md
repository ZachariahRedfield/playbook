# `pnpm playbook verify`

## What it does
Runs deterministic governance rule checks and reports policy findings.

## Common usage
- `pnpm playbook verify`
- `pnpm playbook verify --ci`
- `pnpm playbook verify --json`
- `pnpm playbook verify --json --explain`
- `pnpm playbook verify --policy --json`

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
