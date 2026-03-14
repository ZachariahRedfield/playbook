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


### `patterns outcomes <patternId>`

Show outcome-oriented inspection signals for a pattern id, including:

- `attractor`
- `fitness`
- `strength`
- deterministic outcome bullets

### `patterns doctrine-candidates`

List promoted/high-strength patterns as doctrine candidates ranked by strength.

### `patterns anti-patterns`

Show anti-pattern risk signals inferred from low-strength patterns.


### `patterns cross-repo`

Compute cross-repository aggregates and write `.playbook/cross-repo-patterns.json`.

- default pilot repos: `ZachariahRedfield/playbook`, `ZachariahRedfield/fawxzzy-fitness`
- optional repeated `--repo <path-or-slug>` overrides defaults

### `patterns portability`

List `pattern_id` to `portability_score` rows from `.playbook/cross-repo-patterns.json`.

### `patterns generalized`

List patterns with portability score `> 0.85` (portable doctrine candidates).

### `patterns repo-delta <leftRepo> <rightRepo>`

Compare shared patterns between two repository ids in the cross-repo artifact and report strength/attractor/fitness deltas.



## Pattern candidate extraction overview

Automatic extraction emits `.playbook/pattern-candidates.json` from deterministic repository artifacts.

Detectors are intentionally narrow and evidence-backed:

- layering detector (repo graph dependency directionality)
- modularity detector (module/governance graph structure)
- workflow recursion detector (docs-audit workflow-loop findings)
- contract symmetry detector (runtime contract metadata symmetry)
- query-before-mutation detector (command registry + docs command-truth drift signals)

Determinism guarantees:

- stable candidate IDs from hashed detector evidence
- stable ordering by `detector`, then `id`
- normalized confidence in `[0,1]` with fixed 2-decimal precision
- deterministic missing-artifact errors for absent required sources

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
pnpm playbook patterns outcomes pattern.modularity
pnpm playbook patterns doctrine-candidates --json
pnpm playbook patterns anti-patterns --json

pnpm playbook patterns cross-repo --json
pnpm playbook patterns portability
pnpm playbook patterns generalized --json
pnpm playbook patterns repo-delta repo-a repo-b --json
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
