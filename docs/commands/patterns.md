# `pnpm playbook patterns`

Inspect pattern knowledge graph artifacts and run explicit promotion review decisions. This surface now distinguishes repo-local backlog promotion from global reusable pattern promotion.

Lifecycle note:

- Observer and `knowledge` read surfaces normalize global reusable pattern lifecycle state so `active`, `superseded`, `retired`, and `demoted` patterns remain inspectable without introducing any new mutation route.

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

Status: supported **legacy review surface**. Prefer [`patterns proposals promote`](promote.md) for new cross-repo promotion doctrine because it makes the source proposal, target scope, and destination artifact explicit.

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

### `patterns candidates`

List extraction candidates derived from deterministic artifacts (`verify`, `plan`, `apply`, `analyze-pr`, and `docs-audit`).

### `patterns candidates show <id>`

Show one extracted candidate by candidate id, including deterministic link/bucket details.

### `patterns candidates unmatched`

List extracted candidates without a deterministic link target.

### `patterns candidates link`

List extracted candidates with deterministic link targets.

### `patterns candidates cross-repo`

List candidate families aggregated across repositories from `.playbook/cross-repo-patterns.json`.

### `patterns candidates generalized`

List candidate families that appear in more than one repository.

### `patterns candidates portability`

Compute and show candidate portability scores with signal breakdowns.

### `patterns proposals`

Build governance-safe enrichment proposals from `.playbook/cross-repo-candidates.json` and write `.playbook/pattern-proposals.json`. Each proposal now carries normalized evidence lineage (`repo_id`, `artifact_kind`, semantics), a portability rationale, and explicit promotion targets for memory and story surfaces.

### `patterns proposals promote --proposal <proposal-id> --target memory|story [--repo <repo-id>]`

Explicitly promote one cross-repo proposal into a governed target:

- `--target memory` promotes a portable pattern candidate into **global reusable pattern memory** at `.playbook/patterns.json` under `PLAYBOOK_HOME`, with deterministic compat-read support for legacy `patterns.json`.
- `--target story --repo <repo-id>` promotes a repo-scoped adoption candidate into the **repo-local story backlog** at `.playbook/stories.json`.

Status: **preferred** cross-repo promotion surface.

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

## Candidate linking workflow

`patterns candidates link` should be treated as a **proposal surface**, not an automatic doctrine merge.

Linking evaluates deterministic compatibility across:

- pattern family
- mechanism overlap
- relation compatibility
- evidence compatibility

Expected behavior:

- matched candidates produce **proposal-only** append operations (instance/evidence suggestions)
- unmatched or low-confidence candidates remain in `observed` state
- canonical pattern graph artifacts are never silently rewritten by linking

Governance rule:

- Linking may propose graph enrichment, never silently rewrite canonical knowledge.
- Failure Mode: Implicit graph mutation makes it impossible to audit how patterns entered doctrine.

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
pnpm playbook patterns candidates --json
pnpm playbook patterns candidates show <id> --json
pnpm playbook patterns candidates unmatched --json
pnpm playbook patterns candidates link --json
pnpm playbook patterns candidates cross-repo --json
pnpm playbook patterns candidates generalized --json
pnpm playbook patterns candidates portability --json

pnpm playbook patterns proposals --json
pnpm playbook patterns cross-repo --json
pnpm playbook patterns portability
pnpm playbook patterns generalized --json
pnpm playbook patterns repo-delta repo-a repo-b --json
pnpm playbook patterns promote --id <pattern-id> --decision approve --json
```

## Proposal lifecycle governance

`patterns proposals` is an explicit bridge between automated cross-repo discovery and governed doctrine updates.

Lifecycle:

1. Extraction and aggregation produce candidate-family observations (`.playbook/cross-repo-candidates.json`).
2. Proposal bridge emits deterministic grouped promotion candidates (`.playbook/pattern-proposals.json`) with evidence lineage and portable/story promotion targets.
3. Human/governance review explicitly promotes a candidate into memory knowledge or a repo story/backlog item.

Hard guarantees:

- Automatic extraction may suggest promotion but must never mutate canonical pattern knowledge or backlog state automatically.
- Proposals require `repo_count >= 2` and `portability_score >= 0.65` before they can be emitted.
- Deterministic sorting ensures stable proposal ordering for review and audit.

- Pattern: Use proposal artifacts to bridge automated discovery and governed doctrine.
- Pattern: Read-only inspection should reveal lifecycle truth without mutating it.
- Failure Mode: Operators cannot govern what they cannot inspect.
- Failure Mode: Direct pattern graph mutation from extraction logic causes irreversible architecture drift.

## Cross-repo candidate portability scoring

`patterns candidates portability` computes deterministic scores using:

```text
portability =
0.35 * repo_count_signal
0.25 * outcome_consistency_signal
0.20 * instance_diversity_signal
0.20 * governance_stability_signal
```

Signals are normalized and rows are deterministically sorted by descending portability score, then `pattern_id`.

- Pattern: Inspection-first CLI surfaces allow safe experimentation before automated promotion.
- Failure Mode: Mutation-capable commands too early collapse observation and governance layers.

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

- Pattern: Cross-repo comparison becomes useful when it yields promotable pattern/story candidates with evidence.
- Rule: Cross-repo intelligence may suggest promotion, but promotion must remain explicit.
- Failure Mode: Raw comparison output without grouping/promotion semantics becomes noisy and underused.

## Promotion doctrine

Use these terms consistently when documenting or operating pattern promotion:

- **Global reusable pattern memory**: promoted cross-repo doctrine in `.playbook/patterns.json` under `PLAYBOOK_HOME` (compat-read legacy `patterns.json`).
- **Pattern proposals**: bridge artifacts in `.playbook/pattern-proposals.json` reviewed before promotion.
- Canonical reusable pattern storage contract: repo-local memory -> `.playbook/memory/knowledge/patterns.json`, global reusable pattern memory -> `.playbook/patterns.json` under `PLAYBOOK_HOME` (compat-read legacy `patterns.json`), cross-repo proposal bridge -> `.playbook/pattern-proposals.json`.
- **Repo-local story backlog**: canonical repo execution-planning input in `.playbook/stories.json`.

Rule: Cross-repo pattern knowledge may suggest local work, but only repo-local stories may enter execution planning.

## `patterns transfer export --pattern <id> --target-repo <repo-id>`

Export a governed cross-repo transfer package from a promoted global reusable pattern.

Guarantees:

- export reads promoted global reusable patterns only
- package includes pattern payload, provenance, sanitization status, compatibility metadata, risk class, known failure modes, and recall/demotion lifecycle hooks
- transfer package is deterministic for the same source pattern, export timestamp, and target repo inputs
- package governance boundary explicitly records candidate-only import mode and zero execution-planning effect

## `patterns transfer import --file <path> --repo <repo-id>`

Import a transfer package into a receiving repo as candidate input only.

Guarantees:

- incompatible packages fail closed before candidate mutation
- imported packages land only in `.playbook/pattern-candidates.json`
- imports do not update `.playbook/patterns.json` or auto-enter execution planning
- imported candidate metadata preserves provenance, sanitization/risk details, and lifecycle hooks for later recall or demotion review

Rule: Cross-repo transfer moves governed packages, not auto-enforced truth.
Pattern: Transfer should preserve provenance and local review boundaries.
Failure Mode: Importing foreign doctrine directly into execution context breaks private-first governance.
