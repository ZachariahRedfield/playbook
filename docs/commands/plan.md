# `playbook plan`

## What it does
Generates a deterministic remediation task list from verify failures.

## Common usage
- `playbook plan`
- `playbook plan --ci`
- `playbook plan --json`

## Contract notes
- JSON output includes `schemaVersion`, `command`, `verify`, and `tasks`.
- Task objects use stable fields: `id`, `ruleId`, `file`, `action`, `autoFix`.
- `id` is deterministic for equivalent findings and safe to persist for later execution.
- Findings are sorted before task generation to keep task order deterministic.
