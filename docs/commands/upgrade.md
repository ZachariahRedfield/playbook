# `pnpm playbook upgrade`

## What it does
Plans and applies deterministic local Playbook upgrade migrations for known integration modes, with explicit operator-facing next actions in both text and JSON output.

## Common usage
- `pnpm playbook upgrade --check`
- `pnpm playbook upgrade --apply --dry-run`
- `pnpm playbook upgrade --check --from 0.1.0 --to 0.1.1`

## Notable flags
- `--check`: run migration checks only.
- `--apply`: run safe migration apply flow.
- `--dry-run`: preview migration changes.
- `--from <version>` / `--to <version>`: explicit version bounds for checks.
- `--offline`: force offline-safe mode.
- `--json` / `--format json`: machine-readable output.


## Operator surface
- Text mode prints **Recommended operator actions** and a migration check summary.
- JSON mode returns a stable envelope: `recommendedCommands`, `migrationsNeeded`, optional `applied`, and `summary`.
- If integration mode cannot be detected, `--check`/`--apply` require `--from <version>` for safe deterministic checks.
