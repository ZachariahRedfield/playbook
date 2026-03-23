# `pnpm playbook upgrade`

## What it does
`pnpm playbook upgrade` is the canonical local operator surface for pulling newer Playbook versions into a repository.

It inspects the repo-local Playbook integration, compares current vs target version, reports deterministic upgrade state, and can apply a bounded dependency-version bump for supported pnpm dependency installs. Repo-surface mutations are now additionally constrained by `.playbook/managed-surfaces.json`, the managed-surface manifest that distinguishes Playbook-owned artifacts from repo-local protected truth.

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

Additional fields (`mode`, `packageManager`, `migrationsNeeded`, `applied`, `summary`) are included for operator diagnostics and deterministic migration workflow continuity. Each migration finding also carries target-path and boundary metadata so mixed repos fail closed with review-required output instead of mutating ambiguous files.

## Real mutation behavior
`--apply` performs **bounded local mutation** only when all conditions are met:
- integration mode is dependency-based (`@fawxzzy/playbook` in `package.json`)
- package manager state is pnpm-supported and unambiguous

When the dependency version is behind target, Playbook updates only the `@fawxzzy/playbook` dependency spec in the detected dependency section and does not mutate unrelated dependencies. When the dependency is already aligned, Playbook may still apply safe repo migrations, but only for paths explicitly categorized as `managed_by_playbook` in `.playbook/managed-surfaces.json`. Protected repo-local files remain immutable by default, and managed-block targets such as `docs/CHANGELOG.md` require the expected Playbook markers before `upgrade --apply` will edit them.

If dependency-mode apply is unsupported, the command returns `upgrade_blocked` with deterministic actions/notes. If a needed migration resolves to `repo_local_protected`, `explicit_migration_required`, or any unclassified path, the command also fails closed with explicit review-required output. If nothing changes and migrations are still needed, the command returns warnings so CI can treat that state as unresolved.

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

## Managed-surface boundary contract
- `pnpm playbook init` now seeds `.playbook/managed-surfaces.json` for installable repos.
- Deterministic categories are `managed_by_playbook`, `repo_local_protected`, and `explicit_migration_required`.
- `upgrade --apply` may mutate only `.playbook/**` plus explicitly managed Playbook-owned templates/workflows/docs/contracts already covered by the manifest.
- Repo-local product truth such as `AGENTS.md`, app source, product docs, styling/UI conventions, and repo-specific architecture/domain docs must be reviewed or migrated manually rather than auto-mutated.
