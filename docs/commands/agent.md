# `pnpm playbook agent`

Read-only runtime control-plane surfaces for inspecting agent lifecycle records.

## Subcommands

### `agent runs`

List run records from `.playbook/runtime/runs/*.json`.

### `agent show <run-id>`

Show one run record by id.

### `agent tasks --run-id <id>`

List task records from `.playbook/runtime/tasks/<run-id>/*.json`.

### `agent logs --run-id <id>`

List runtime log envelopes from `.playbook/runtime/logs/<run-id>.jsonl`.

### `agent status`

Return deterministic control-plane status counts (runs, tasks, logs) and latest run metadata.

## Scope

- Read-only visibility only.
- No `agent run` execution command.
- No autonomous/background runtime execution.

## Examples

```bash
pnpm playbook agent runs --json
pnpm playbook agent show <run-id> --json
pnpm playbook agent tasks --run-id <run-id> --json
pnpm playbook agent logs --run-id <run-id> --json
pnpm playbook agent status --json
```
