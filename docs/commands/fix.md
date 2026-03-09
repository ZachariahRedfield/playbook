# `playbook fix`

## What it does
Applies safe, deterministic autofixes for eligible verify findings.

## Common usage
- `playbook fix --dry-run`
- `playbook fix --yes`
- `playbook fix --json --yes`
- `playbook fix --only notes.missing --yes`

## Notable flags
- `--dry-run`: preview changes without writing files.
- `--yes`: apply changes without interactive confirmation.
- `--only <ruleId>`: apply fixes for a specific finding/rule ID.
- `--json` / `--format json`: machine-readable output.

## Relationship to `plan` / `apply`
`fix` remains a convenience remediation path for local/manual operation.

`fix` is not the primary serious-user onboarding path.

- Use `fix` when you want direct command-driven remediation with operator flags such as `--dry-run`, `--yes`, or `--only`.
- Use `plan` + `apply` when you need explicit, reviewable remediation intent and artifact-driven execution for CI/agent automation.

Both paths target deterministic safe autofixes, but `plan`/`apply` is the canonical automation contract surface.
