# CLI Reference

This page is a thin entrypoint. The authoritative command inventory and command-state snapshot lives in [docs/commands/README.md](../commands/README.md).

## Product-facing command categories

Playbook command surfaces are organized as:

- **Core runtime**: `analyze`, `verify`, `plan`, `apply`
- **Repository tools**: diagnostics, docs/architecture/governance support commands
- **Repository intelligence**: `index`, `query`, `deps`, `ask`, `explain`
- **AI bootstrap context**: `ai-context`, `ai-contract`, `context`
- **Utility flows**: onboarding, initialization, upgrades, and session utilities

For canonical serious-user operation, use:

`ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify -> plan -> apply -> verify`

`analyze` remains available as a compatibility-oriented/lightweight entrypoint.

## Query-domain note

Structured domains such as `risk`, `impact`, `docs-coverage`, `rule-owners`, and `test-hotspots` are query surfaces/subcommands (for example via `pnpm playbook query ...`), not standalone top-level commands.

## Global options (all top-level commands)

- `--ci`: deterministic CI mode with minimized output (quiet unless errors)
- `--format <text|json>`: explicit output format
- `--json`: alias for `--format=json`
- `--quiet`: suppress success output in text mode
- `--explain`: include rationale/remediation context in text mode where supported
