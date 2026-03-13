# `pnpm playbook agent`

Read-only runtime control-plane surfaces for inspecting agent lifecycle records.

## Subcommands

### `agent runs`

List run records from `.playbook/runtime/runs/*.json`.

### `agent run --from-plan <path> --dry-run`

Compile a plan artifact into runtime tasks and return a deterministic dry-run control-plane preview.

This surface is intentionally read-only in this PR:

- `--dry-run` is required.
- Live/background execution is rejected.
- No mutation execution is performed.

The output includes:

- run metadata
- compiled task count
- ready/blocked summary
- approval-required summary
- denied-task summary
- scheduling preview
- `nextTaskId` when at least one task is ready
- provenance to the source plan artifact

Deterministic error behavior:

- missing or malformed `--from-plan` path returns nonzero error.
- policy-denied or approval-required tasks still return zero exit in dry-run mode with structured summaries.

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
- `agent run` supports dry-run preview only.
- No autonomous/background runtime execution.

## Examples

```bash
pnpm playbook agent runs --json
pnpm playbook agent run --from-plan .playbook/plan.json --dry-run --json
pnpm playbook agent show <run-id> --json
pnpm playbook agent tasks --run-id <run-id> --json
pnpm playbook agent logs --run-id <run-id> --json
pnpm playbook agent status --json
```
