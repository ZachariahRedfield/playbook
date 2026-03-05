# CLI Reference

Current Playbook CLI commands:

## `playbook init`

Initialize Playbook docs and configuration for a repository.

## `playbook analyze [--ci] [--json]`

Analyze repository stack signals and output recommendations.

- `--json`: machine-readable JSON output.
- `--ci`: CI-oriented output and CI-sensitive exit behavior.

## `playbook verify [--ci] [--json]`

Run deterministic governance checks.

- `--json`: machine-readable JSON report.
- `--ci`: prints JSON plus a final `playbook verify: PASS|FAIL` line.

## `playbook doctor`

Check local setup (git availability, repo context, config/docs health warnings).

## `playbook diagram [--repo] [--out] [--deps] [--structure]`

Generate deterministic Mermaid architecture diagrams.

- `--repo <path>`: repository to scan (default `.`)
- `--out <path>`: output markdown file (default `docs/ARCHITECTURE_DIAGRAMS.md`)
- `--deps`: include dependency diagram
- `--structure`: include repo structure diagram

If neither `--deps` nor `--structure` is provided, both diagrams are generated.
