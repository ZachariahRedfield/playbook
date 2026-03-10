# Zettelkasten Contract

## Purpose

This contract defines deterministic lifecycle semantics for Playbook zettels and link artifacts.

Zettelkasten artifacts are working-memory evidence structures used by RunCycle consolidation.
They are not durable memory by default.

## Current maturity

Current shipped scaffolding includes zettels, typed links, graph snapshots, and deterministic grouping.

Next phase is deterministic candidate-pattern synthesis into draft pattern cards and promotion-readiness scoring.

This phase stops before automatic promotion.

## Artifact paths

Runtime output paths:

- `.playbook/zettelkasten/zettels.jsonl`
- `.playbook/zettelkasten/links.jsonl`

Committed examples may be stored under `.playbook/demo-artifacts/` as static snapshots.

Graph-memory runtime snapshots are emitted to:

- `.playbook/graph/snapshots/<timestamp>@<shortsha>.json`
- `.playbook/graph/groups/<timestamp>@<shortsha>.json`
- `.playbook/compaction/candidate-patterns/<timestamp>@<shortsha>.json`

## Zettel minimum shape

Each zettel record should include:

- `zettelId`
- `originCycleId`
- `kind`
- `sourceArtifactPath`
- `evidenceRef`
- `links` (typed relation list or references into `links.jsonl`)
- `promotedPatternId` (nullable)
- `status`

## Status lifecycle

Allowed status progression:

1. `draft|observed` — captured evidence, not yet integrated
2. `linked` — connected through typed associations
3. `converged` — repeatedly linked into a stable cluster
4. `compacted` — incorporated into a pattern-level compressed representation
5. `promoted` — upstream stabilization reached contract-level invariant via pattern promotion
6. `retired` — no longer active due to supersession/merge/deprecation

Lifecycle intent:

- accumulation is permitted at `draft|observed` and `linked`
- durable memory starts at stabilized `converged/compacted` pattern behavior
- contract durability is explicit only after promotion gates

## Link semantics

Links represent typed retrieval edges between zettels and may include:

- `supports`
- `refines`
- `contrasts`
- `duplicates`
- `derived-from`
- `elevates-to-pattern`

Typed links must preserve provenance and allow deterministic replay of convergence decisions.

## RunCycle alignment

Each zettel must retain `originCycleId` so memory consolidation remains traceable to one RunCycle iteration.

RunCycle outputs should reference zettelkasten artifact digests and downstream pattern/contract promotion metrics when available.


## State-space interpretation bridge

Zettelkasten evidence quality directly affects state-space coherence:

- coherent linked evidence tends toward lower-noise, higher-confidence cycle states
- contradictory or stale zettels increase mixed-state behavior (ambiguity/noise)
- compaction acts as projection toward lower-entropy representations while preserving required distinctions
- promotion marks governance-approved stabilization from soft attractor patterns to hard attractor contracts

Use this bridge with `docs/architecture/BLOCH_SPHERE_STATE_SPACE.md` and `docs/contracts/STATE_SPACE.md` for deterministic diagnostics framing.


## Graph-memory structure alignment

Zettelkasten is the evidence layer feeding Playbook graph-memory structure.

- zettels are evidence-bearing vertices
- typed links are graph edges with deterministic relation kinds
- relation vertices can represent hyperedge-style multi-entity evidence/events

Long-term memory structure path:

```text
raw artifacts
-> zettels
-> graph snapshot
-> deterministic groups
-> candidate patterns
-> draft pattern cards
-> review queue
-> promoted patterns
-> contracts
```

Temperature path:

```text
hot graph -> warm graph -> cold graph
```

- hot = current cycle working set
- warm = unresolved/converging memory
- cold = promoted doctrine/contracts

Deterministic grouping should be favored in the critical path.
Stochastic clustering (for example Louvain/Leiden) is exploratory/offline only and must not determine production promotion gates.

## Rule / Pattern / Failure Mode

Rule:
Grouping is allowed only when connectivity and boundary compatibility both hold.

Pattern:
Deterministic grouping is the bridge between linked memory and compressed reusable knowledge.

Failure Mode:
Over-merging connected but incompatible zettels creates false patterns and doctrine drift.


Rule:
Do not promote compressed knowledge until deterministic grouping and lineage-preserving contraction exist.

Pattern:
Playbook memory matures in stages: atomic capture, structural linkage, deterministic grouping, then controlled compression.

Failure Mode:
Skipping grouping and jumping straight from notes to doctrine causes brittle, non-reproducible promotion.


Rule:
Durable knowledge must pass through an explicit promotion decision.

Pattern:
Pattern-card promotion forms the durable attractors of Playbook memory.

Failure Mode:
Unreviewed pattern promotion creates unstable doctrine and architecture drift.

## Promotion coupling rule

- **Rule:** No zettel-derived promoted state is updated in place; transitions flow through append-only promotion decisions.
- **Pattern:** Zettel lineage feeds promotion-decision morphisms that preserve ancestry into pattern versions.
- **Failure Mode:** Direct zettel-to-pattern mutation breaks replay and loses evidence ancestry.

Rule:
Contracts evolve only through verified mutation proposals.

Pattern:
Pattern promotion feeds contract proposals, not direct contract mutation.

Failure Mode:
Direct mutation of contracts breaks deterministic governance.

## Minimum Cognitive Core object alignment

Rule:
Zettelkasten artifacts map to domain-agnostic `Evidence`, `Zettel`, and `Edge` primitives before any domain adapter logic.

Pattern:
Deterministic linking and compaction produce reusable `Pattern` and auditable `Decision` outputs through governed promotion.

Failure Mode:
If zettelkasten promotion bypasses governed decisions, lineage from evidence to doctrine breaks.
