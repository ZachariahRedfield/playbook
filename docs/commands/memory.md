# `pnpm playbook memory`

Inspect and review repository memory artifacts using thin, deterministic CLI surfaces.

## Subcommands

### `memory events`

List episodic events from `.playbook/memory/events` with optional filters (`--module`, `--rule`, `--fingerprint`, `--limit`, `--order`).

### `memory query`

Query normalized operational repository events from `.playbook/memory/events` using deterministic filters:

- `--event-type`
- `--subsystem`
- `--run-id`
- `--subject`
- `--related-artifact`
- `--order` and `--limit`

Summary views are available with `--summary`:

- `recent-route-decisions`
- `lane-transitions` (requires `--run-id`)
- `worker-assignments` (requires `--run-id`)
- `improvement-signals` (requires `--related-artifact`)

### `memory candidates`

List replay candidates from `.playbook/memory/candidates.json` for operator review.

### `memory knowledge`

List promoted knowledge artifacts from `.playbook/memory/knowledge/*.json`.

### `memory show <id>`

Show one memory candidate or promoted knowledge entry by id.

- Candidate responses include expanded event provenance when available.
- Knowledge responses preserve retirement/supersession state.

### `memory promote <candidate-id>`

Promote a reviewed replay candidate into local semantic memory artifacts:

- `.playbook/memory/knowledge/decisions.json`
- `.playbook/memory/knowledge/patterns.json`
- `.playbook/memory/knowledge/failure-modes.json`
- `.playbook/memory/knowledge/invariants.json`

### `memory retire <knowledge-id>`

Retire an existing promoted knowledge record without deleting provenance.

## Guarantees

- Pattern: **Fast Episodic Store, Slow Doctrine Store**.
- Rule: **Working Memory Is Not Doctrine**.
- Rule: **Retrieval Must Return Provenance**.
- Failure Mode: **Memory Hoarding**.

## Examples

```bash
pnpm playbook memory events --json
pnpm playbook memory query --event-type lane_transition --run-id run-123 --json
pnpm playbook memory query --summary recent-route-decisions --json
pnpm playbook memory candidates --json
pnpm playbook memory knowledge --json
pnpm playbook memory show <id> --json
pnpm playbook memory promote <candidate-id> --json
pnpm playbook memory retire <knowledge-id> --json
```
