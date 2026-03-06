# CLI Reference

See also: [Command Contract Overview](../commands/overview.md).

Current Playbook CLI commands:

Current product-facing surface (see authoritative index: [../commands/README.md](../commands/README.md)):

- `analyze`
- `verify`
- `rules`
- `doctor`
- `diagram`
- `plan`
- `apply`
- `index`
- `query`
- `ask`
- `playbook-demo` onboarding artifact (discoverable via `playbook demo`)

Current canonical remediation workflow:

`verify -> plan -> apply -> verify`

Automation-safe variant:

`playbook verify` → `playbook plan --json > .playbook/plan.json` → review artifact → `playbook apply --from-plan .playbook/plan.json` → `playbook verify`

## Global options (all top-level commands)

- `--ci`: deterministic CI mode with minimized output (quiet unless errors).
- `--format <text|json>`: explicit output format.
- `--json`: alias for `--format=json`.
- `--quiet`: suppress success output in text mode.
- `--explain`: include rationale/remediation context in text mode where supported.


## `playbook demo [--json] [--quiet]`

Show the official Playbook demo repository and deterministic first-run workflow.

- Returns a side-effect-free onboarding contract in both text and JSON modes.
- JSON includes stable fields for automation (`schemaVersion`, `command`, `repository`, `workflow`, `expectedInitialFindings`).
- Command behavior is intentionally deterministic in v1: no auto-clone, no shell execution, no browser opening.

## `playbook init [--ci] [--json] [--quiet]`

Initialize Playbook baseline docs and configuration for a repository.

Baseline scaffold contract:

- Playbook configuration (`playbook.config.json` or `.playbook/config.json`)
- `docs/PLAYBOOK_NOTES.md`

Repository-specific governance docs (for example `docs/PROJECT_GOVERNANCE.md`) are optional and may be added by individual repositories.

## `playbook analyze [--ci] [--json] [--quiet]`

Analyze repository stack signals and output recommendations.

## `playbook index [--json] [--quiet]`

Generate deterministic repository intelligence and write `.playbook/repo-index.json`.

JSON output includes:

- `command`
- `ok`
- `indexFile`
- `framework`
- `architecture`
- `modules`


## `playbook query <field> [--json] [--quiet]`

Query repository intelligence from `.playbook/repo-index.json` without rerunning repository analysis.

Supported fields:

- `architecture`
- `framework`
- `language`
- `modules`
- `database`
- `rules`

JSON output includes:

- `command`
- `field`
- `result`

### Querying Repository Intelligence

```bash
playbook index
playbook query modules
playbook query architecture
playbook query modules --json
```


## `playbook ask <question> [--json] [--quiet]`

Answer repository guidance questions from machine-readable repository intelligence.

- Uses the engine reasoning layer and `queryRepositoryIndex` signals.
- Reads `.playbook/repo-index.json` via the query engine (no direct repository scanning).
- Deterministic response patterns exist for architecture, modules, and feature placement questions.

JSON output includes:

- `command`
- `question`
- `answer`
- `reason`
- `context` (`architecture`, `framework`, `modules`)

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

`fix` overlaps with `apply` for deterministic remediation intent, but is retained as a convenience/direct path for local workflows. For artifact-driven CI/agent execution, prefer `plan` + `apply`.

## `playbook doctor [--ci] [--json] [--quiet] [--fix] [--dry-run] [--yes]`

Check local setup (git availability, repo context, config/docs health warnings), with optional fix mode.

- Missing prerequisites return environment/prereq exit code `2`.

## `playbook status [--ci] [--json] [--quiet]`

Show overall repository governance health by combining environment and verification status.

## `playbook rules [--json] [--quiet] [--explain]`

List loaded verify and analyze rules.

## `playbook explain <target> [--json] [--quiet]`

Explain a rule, module, or architecture element from repository intelligence (no repository scan).

Examples:

```bash
playbook explain PB001
playbook explain workouts
playbook explain architecture
playbook explain workouts --json
```

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
