# Topology Compression for Pattern Equivalence

## Purpose

Pattern topology analysis detects structural equivalence between promoted pattern cards so doctrine can express each structural idea exactly once.

## Deterministic topology signature

Each promoted pattern card receives a deterministic topology signature composed of:

- stage count
- dependency structure
- contract references
- invariant type
- mechanism type

Signatures intentionally exclude narrative fields (title/summary) so equivalence is based only on deterministic invariants.

## Equivalence classes

Pattern cards sharing the same deterministic topology signature are grouped into a `PatternEquivalenceClass` with:

- `canonicalPattern`
- `memberPatterns[]`
- `transformationNotes`
- preserved `variants[]` lineage to the canonical pattern

Canonical pattern selection is deterministic:

1. highest evidence count
2. highest reuse rate
3. lexical tie-breaker on pattern id

## Runtime artifact

Topology equivalence output is written to:

- `.playbook/topology/equivalence/<timestamp>@<shortsha>.json`

Telemetry emitted per artifact:

- `patternEquivalenceCount`
- `canonicalizationRate`
- `variantCollapseRate`

Variants are never deleted; they are retained and explicitly marked as variants.

## Rule / Pattern / Failure Mode

Rule:
Canonical doctrine must represent each structural idea exactly once.

Pattern:
Topology compression reduces pattern-level redundancy.

Failure Mode:
Multiple canonical patterns representing the same structure create doctrine fragmentation.
