# CLI Reference

See also: [Command Contract Overview](../commands/overview.md).

Current Playbook CLI commands:

## Global options (all top-level commands)

- `--ci`: deterministic CI mode with minimized output (quiet unless errors).
- `--format <text|json>`: explicit output format.
- `--json`: alias for `--format=json`.
- `--quiet`: suppress success output in text mode.
- `--explain`: include rationale/remediation context in text mode where supported.

## `playbook init [--ci] [--json] [--quiet]`

Initialize Playbook baseline docs and configuration for a repository.

Baseline scaffold contract:

- Playbook configuration (`playbook.config.json` or `.playbook/config.json`)
- `docs/PLAYBOOK_NOTES.md`

Repository-specific governance docs (for example `docs/PROJECT_GOVERNANCE.md`) are optional and may be added by individual repositories.

## `playbook analyze [--ci] [--json] [--quiet]`

Analyze repository stack signals and output recommendations.

## `playbook verify [--ci] [--json] [--quiet]`

Run deterministic governance checks.

- In JSON mode, failures return policy exit code `3`.

## `playbook plan [--ci] [--json] [--quiet]`

Generate deterministic remediation tasks from verify findings.

## `playbook apply [--ci] [--json] [--quiet] [--from-plan <path>]`

Execute deterministic `plan` tasks using bounded auto-fix handlers.

- `--from-plan <path>` executes a previously generated `playbook plan --json` artifact directly (without recomputing plan intent).

## `playbook fix [--dry-run] [--yes] [--only <ruleId>] [--ci] [--json] [--quiet]`

Apply safe deterministic fixes (or preview with `--dry-run`).

## `playbook doctor [--ci] [--json] [--quiet] [--fix] [--dry-run] [--yes]`

Check local setup (git availability, repo context, config/docs health warnings), with optional fix mode.

- Missing prerequisites return environment/prereq exit code `2`.

## `playbook status [--ci] [--json] [--quiet]`

Show overall repository governance health by combining environment and verification status.

## `playbook rules [--json] [--quiet] [--explain]`

List loaded verify and analyze rules.

## `playbook explain <rule-id> [--json] [--quiet]`

Show detailed rule metadata by ID.

## `playbook diagram [--repo] [--out] [--deps] [--structure] [--ci] [--json] [--quiet]`

Generate deterministic Mermaid architecture diagrams.

- `--repo <path>`: repository to scan (default `.`)
- `--out <path>`: output markdown file (default `docs/ARCHITECTURE_DIAGRAMS.md`)
- `--deps`: include dependency diagram
- `--structure`: include repo structure diagram

If neither `--deps` nor `--structure` is provided, both diagrams are generated.

## `playbook upgrade [--check] [--apply] [--dry-run] [--offline] [--from <version>] [--to <version>] [--json]`

Plan and apply deterministic local upgrade migrations.

## `playbook session <import|merge|cleanup> [--ci] [--json] [--quiet]`

Import, merge, and cleanup session snapshots.
