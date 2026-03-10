# Graph Memory Architecture

## Purpose

Playbook memory should be modeled as a deterministic heterogeneous graph.

Durable memory is not a bag of notes; it is a typed graph with preserved lineage and controlled contraction.

This document defines the structure layer only. It introduces graph-memory scaffolding without changing runtime behavior.

## Memory model

### Vertices

Vertices are memory-bearing entities:

- `RunCycle`
- `Artifact`
- `Zettel`
- `PatternCard`
- `Contract`
- `Subject`
- `Decision`

### Edges

Edges are typed relations between vertices:

- `PRODUCED`
- `CITES`
- `SUPPORTS`
- `DERIVES`
- `SIMILAR_TO`
- `MEMBER_OF`
- `PROMOTES_TO`
- `VIOLATES`
- `SUPERSEDES`
- `APPLIES_TO`

### Hypergraph-style relation modeling

Playbook uses a simple graph as the base representation.

When one relation needs more than two participants, model it as a relation vertex (hyperedge-style node) with:

- `relationKind`
- `participantIds[]`
- `evidenceRefs[]`
- `originCycleId`

This preserves deterministic storage while allowing multi-entity evidence/event relations.

## Contraction and attractors

- Contraction is memory compaction from many evidence vertices into fewer stable attractor vertices.
- Pattern cards are soft attractors.
- Contracts are hard attractors.

Why this matters:

- Accumulation is not compression. More notes can increase retrieval burden and entropy.
- Contraction must preserve lineage so every promoted claim remains traceable to evidence.
- Contracts are hard attractors because they carry governance invariants and policy force.

## Deterministic critical path vs exploratory analysis

Deterministic production grouping should be favored in the critical path:

- deterministic grouping: typed edges, reproducible thresholds, stable outputs
- deterministic WCC-style grouping: production-safe component formation

Stochastic clustering is exploratory only:

- offline Louvain/Leiden may be used for research and diagnostics
- exploratory clustering must not gate production promotion/contract decisions

## Current maturity stage

Shipped scaffolding currently covers:

- RunCycle lineage capture
- zettelkasten extraction (`zettels.jsonl`, `links.jsonl`)
- graph snapshots
- deterministic grouping

The next phase is implementation of deterministic candidate-pattern synthesis into draft pattern cards, plus promotion-readiness scoring.

Current scope stops before auto-promotion.

## Pipeline model

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

## Temperature model

```text
hot graph -> warm graph -> cold graph
```

- hot graph = current cycle working set
- warm graph = unresolved/converging memory
- cold graph = promoted doctrine/contracts

## Rule / Pattern / Failure Mode

Rule:
Do not promote grouped knowledge until it is rendered into reviewable draft pattern cards.

Pattern:
Playbook memory matures through explicit compression boundaries, not hidden jumps.

Failure Mode:
A system that can group memory but not review it will either stall or over-promote.


Rule:
Durable knowledge must pass through an explicit promotion decision.

Pattern:
Pattern-card promotion forms the durable attractors of Playbook memory.

Failure Mode:
Unreviewed pattern promotion creates unstable doctrine and architecture drift.

## Runtime artifacts

Current runtime graph-memory artifacts are emitted per run cycle:

- `.playbook/graph/groups/<timestamp>@<shortsha>.json`
- `.playbook/compaction/candidate-patterns/<timestamp>@<shortsha>.json`

Next-phase artifacts (not auto-promotion):

- `.playbook/pattern-cards/drafts/<timestamp>@<shortsha>.json`
- `.playbook/promotion/review-queue/<timestamp>@<shortsha>.json`
- `.playbook/promotion/decisions/<timestamp>@<shortsha>.json`
- `.playbook/pattern-cards/promoted/<timestamp>@<shortsha>.json`

Grouping metrics include:

- `componentCount`
- `singletonComponentCount`
- `largestComponentSize`
- `avgComponentSize`
- `groupableZettelCount`
- `candidatePatternCount`
- `contractionRatio`
- `orphanRate`
- `boundaryConflictCount`
- `crossContractConflictCount`


Rule:
Do not promote compressed knowledge until deterministic grouping and lineage-preserving contraction exist.

Pattern:
Playbook memory matures in stages: atomic capture, structural linkage, deterministic grouping, then controlled compression.

Failure Mode:
Skipping grouping and jumping straight from notes to doctrine causes brittle, non-reproducible promotion.

## Next-phase acceptance criteria

- Candidate patterns are deterministically synthesized from grouped evidence.
- Each draft pattern card preserves lineage to source zettels and origin run cycles.
- Promotion-readiness scoring is reproducible and emitted with draft artifacts.
- Promotion remains review-gated; no automatic promotion to contracts.

## Decision morphisms

- **Rule:** No knowledge state may be mutated in place; durable state changes must be explicit decision morphisms.
- **Pattern:** Promotion decisions are graph morphisms from input pattern-state objects to resulting pattern-state objects.
- **Failure Mode:** Without append-only morphism journals, graph memory cannot be replayed or rolled back deterministically.

Rule:
Contracts evolve only through verified mutation proposals.

Pattern:
Pattern promotion feeds contract proposals, not direct contract mutation.

Failure Mode:
Direct mutation of contracts breaks deterministic governance.
