# `pnpm playbook memory`

Inspect and review repository memory artifacts using thin, deterministic CLI surfaces.

## Subcommands

### `memory events`

List episodic events from `.playbook/memory/events` with optional filters (`--module`, `--rule`, `--fingerprint`, `--limit`, `--order`).

### `memory query`

Query normalized repository memory events with deterministic filtering and ordering.

Supported normalized filters:

- `--event-type`
- `--subsystem`
- `--run-id`
- `--subject`
- `--related-artifact`
- `--order`
- `--limit`

Summary views:

- `--view recent-routes`
- `--view lane-transitions --run-id <id>`
- `--view worker-assignments --run-id <id>`
- `--view artifact-improvements --related-artifact <path>`

### `memory candidates`

List replay candidates from `.playbook/memory/replay-candidates.json` (compat-written to `.playbook/memory/candidates.json`) for operator review.

Replay output remains candidate-only and is derived from memory evidence in `.playbook/memory/index.json` plus append-only event records under `.playbook/memory/events/*.json`; it does not read opaque raw logs directly.

### `memory knowledge`

List promoted knowledge artifacts from `.playbook/memory/knowledge/*.json`.

Consolidation lives alongside this surface as `.playbook/memory/consolidation-candidates.json`: it summarizes replay candidates, preserves event/replay provenance, and keeps promotion explicit with `reviewRequired: true` instead of auto-promoting doctrine.

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

Promotion remains explicit and reviewed: replay/consolidation artifacts never mutate knowledge automatically.

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
pnpm playbook memory query --view recent-routes --limit 5 --json
pnpm playbook memory candidates --json
pnpm playbook memory knowledge --json
pnpm playbook memory show <id> --json
pnpm playbook memory promote <candidate-id> --json
pnpm playbook memory retire <knowledge-id> --json
```
