# `pnpm playbook patterns`

Inspect pattern knowledge graph artifacts and run explicit promotion review decisions.

## Subcommands

### `patterns list`

List all pattern nodes from `.playbook/memory/knowledge/patterns.json`.

### `patterns show <id>`

Show one pattern node by knowledge id.

### `patterns related <id>`

Show patterns connected to a pattern id through deterministic relations:

- `supersedes`
- `superseded-by`
- `same-module`
- `same-rule`
- `same-failure-shape`

### `patterns layers`

Summarize graph layers (status, module, rule, and failure-shape distributions).

### `patterns score`

Compute deterministic attractor scores for `.playbook/pattern-graph.json` and append a new `AttractorScore` entry per pattern. Existing score history is preserved.

### `patterns top`

Show highest-ranked patterns by the latest attractor score (`--limit <n>` optional, default `5`).

### `patterns promote --id <pattern-id> --decision approve|reject`

Apply explicit local promotion decisions for compacted pattern candidates.

## Guarantees

- Rule: New CLI knowledge surfaces begin as inspection tools.
- Pattern: Query-first CLI design keeps the command surface understandable and reduces governance risk.
- Failure Mode: Adding write semantics too early causes unclear ownership boundaries between curated and derived artifacts.

## Examples

```bash
pnpm playbook patterns list --json
pnpm playbook patterns show <id> --json
pnpm playbook patterns related <id> --json
pnpm playbook patterns layers --json
pnpm playbook patterns score --json
pnpm playbook patterns top --limit 10 --json
pnpm playbook patterns promote --id <pattern-id> --decision approve --json
```


## Attractor scoring methodology

Pattern review candidates expose an `attractorScoreBreakdown` with deterministic, static-artifact-only components:

- `recurrence_score`
- `cross_domain_score`
- `evidence_score`
- `reuse_score`
- `governance_score`
- `attractor_score` (weighted aggregate)

The aggregate score is designed to rank **representational persistence and practical utility** for governance review. It is not a claim that a pattern is metaphysically true, complete, or ontologically privileged.

- Rule: Attractor scoring must rank persistence and usefulness, not claim ontology.
- Failure Mode: Treating attractor score as truth collapses governance and invites numerology-style misuse.
