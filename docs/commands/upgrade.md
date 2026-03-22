# `pnpm playbook upgrade`

## What it does
`pnpm playbook upgrade` is the canonical local operator surface for pulling newer Playbook versions into a repository.

It inspects the repo-local Playbook integration, compares current vs target version, reports deterministic upgrade state, and can apply a bounded dependency-version bump for supported pnpm dependency installs.

## Common usage
- `pnpm playbook upgrade`
- `pnpm playbook upgrade --json`
- `pnpm playbook upgrade --to 0.2.0 --json`
- `pnpm playbook upgrade --apply --to 0.2.0`
- `pnpm playbook upgrade --apply --dry-run --to 0.2.0 --json`

## Upgrade contract
JSON output includes a deterministic envelope with:
- `schemaVersion: "1.0"`
- `kind: "playbook-upgrade"`
- `currentVersion`
- `targetVersion`
- `status` (`up_to_date` | `upgrade_available` | `upgrade_applied` | `upgrade_blocked`)
- `actions`
- `notes`

Additional fields (`mode`, `packageManager`, `migrationsNeeded`, `applied`, `summary`) are included for operator diagnostics and deterministic migration workflow continuity.

## Real mutation behavior
`--apply` performs **bounded local mutation** only when all conditions are met:
- integration mode is dependency-based (`@fawxzzy/playbook` in `package.json`)
- package manager state is pnpm-supported and unambiguous

When the dependency version is behind target, Playbook updates only the `@fawxzzy/playbook` dependency spec in the detected dependency section and does not mutate unrelated dependencies. When the dependency is already aligned, Playbook may still apply safe repo migrations; successful migration application remains a successful command outcome rather than a warning.

If dependency-mode apply is unsupported, the command returns `upgrade_blocked` with deterministic actions/notes. If nothing changes and migrations are still needed, the command returns warnings so CI can treat that state as unresolved.

## Post-upgrade guidance
When upgrade is available/applied, output actions include deterministic local follow-up steps:
- `pnpm install`
- `pnpm playbook verify`
- `pnpm playbook index --json`

## Notable flags
- `--check`: run migration checks only.
- `--apply`: apply bounded safe upgrade + migration flow.
- `--dry-run`: preview apply behavior without mutating files.
- `--from <version>` / `--to <version>`: explicit version bounds.
- `--offline`: offline-safe migration checks (no network lookup behavior in this command).
- `--json` / `--format json`: machine-readable output.
