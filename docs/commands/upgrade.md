# `pnpm playbook upgrade`

## What it does
Plans and applies deterministic local Playbook upgrade migrations for known integration modes.

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
