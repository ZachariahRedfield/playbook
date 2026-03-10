# Functor-Based Knowledge Transforms

Playbook functors map pattern knowledge into executable domains while preserving structural invariants.

## Rule / Pattern / Failure Mode

Rule:
Functor transforms must preserve structural invariants of the source knowledge.

Pattern:
Knowledge becomes executable when mapped across domains through structure-preserving transforms.

Failure Mode:
Transforms that break structural invariants produce invalid doctrine.

## Canonical transform domains

Current deterministic mappings:

- pattern -> contract proposal
- pattern -> documentation template
- pattern -> CI rule

Registry path:

- `.playbook/functors/registry.json`

Runtime output path:

- `.playbook/functor-output/<runCycleId>.json`

## Structural invariants

Each functor application carries forward these source fields:

- `mechanism`
- `invariant`
- `dependencies`

Dependencies are deterministically derived from linked contracts and lineage references.

## Determinism and replay

Functor applications are replayable because they:

- compute deterministic digest seeds from source pattern + mapping + output
- sort references and dependencies before serialization
- record stable lineage linking generated output back to source pattern IDs and evidence refs

## Lineage contract

Each generated artifact must include:

- source pattern id/canonical key
- source artifact path (when available)
- source evidence refs
- generation timestamp

This guarantees that transformed doctrine remains auditable and reversible.
