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


## Runtime observability contract

Every top-level Playbook command now emits deterministic runtime observability artifacts under the target repository:

- `.playbook/runtime/current/coverage.json`
- `.playbook/runtime/current/telemetry.json`
- `.playbook/runtime/cycles/<cycle_id>/manifest.json`
- `.playbook/runtime/history/command-stats.json`
- `.playbook/runtime/history/coverage-trend.json`
- `.playbook/runtime/history/analyzer-version-history.json`

This contract intentionally optimizes for measurable coverage accounting (analyzable, scanned, skipped, unsupported, unknown) rather than implied completeness claims. Coverage artifacts separate **observations** (measured facts) from **interpretations** (derived inferences) so analyzer upgrades can be distinguished from repository changes.
