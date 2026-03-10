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
