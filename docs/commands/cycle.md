# cycle (`pnpm playbook cycle`)

`cycle` is a thin orchestration command that runs the hardened primitive loop in order:

1. `verify`
2. `route`
3. `orchestrate`
4. `execute`
5. `telemetry`
6. `improve`

## Contract

- `cycle` **does not** reimplement primitive command logic.
- Primitive commands remain the source of truth for behavior and artifact semantics.
- `cycle` only sequences handlers, records step status/duration, and writes a deterministic summary artifact.

## Usage

```bash
pnpm playbook cycle
pnpm playbook cycle --json
```

## Flags

- `--json` (alias for `--format json`)
- `--stop-on-error` (default behavior: stop at first failing step)

## Artifact

`cycle` writes `.playbook/cycle-state.json` with stable formatting and deterministic step ordering.

Top-level fields:

- `cycle_id`
- `started_at`
- `steps[]` (`name`, `status`, `duration_ms`)
- `artifacts_written[]`
- `status`

On failure, `cycle` records the failed step and exits using the failing primitive command result.
