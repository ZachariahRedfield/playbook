# CLI Reference

Current Playbook CLI commands:

## Global options (all top-level commands)

- `--ci`: deterministic CI mode with minimized output (quiet unless errors).
- `--format <text|json>`: explicit output format.
- `--json`: alias for `--format=json`.
- `--quiet`: suppress success output in text mode.

## `playbook init [--ci] [--json] [--quiet]`

Initialize Playbook docs and configuration for a repository.

## `playbook analyze [--ci] [--json] [--quiet]`

Analyze repository stack signals and output recommendations.

## `playbook verify [--ci] [--json] [--quiet]`

Run deterministic governance checks.

- In JSON mode, failures return policy exit code `3`.

## `playbook doctor [--ci] [--json] [--quiet]`

Check local setup (git availability, repo context, config/docs health warnings).

- Missing prerequisites return environment/prereq exit code `2`.

## `playbook diagram [--repo] [--out] [--deps] [--structure] [--ci] [--json] [--quiet]`

Generate deterministic Mermaid architecture diagrams.

- `--repo <path>`: repository to scan (default `.`)
- `--out <path>`: output markdown file (default `docs/ARCHITECTURE_DIAGRAMS.md`)
- `--deps`: include dependency diagram
- `--structure`: include repo structure diagram

If neither `--deps` nor `--structure` is provided, both diagrams are generated.

## `playbook session <import|merge|cleanup> [--ci] [--json] [--quiet]`

Import, merge, and cleanup session snapshots.
