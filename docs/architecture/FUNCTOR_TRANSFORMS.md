# Functor-Based Knowledge Transforms

Playbook functors map pattern knowledge into executable domains while preserving structural invariants.

## Reasoning-engine role

Functor transforms are a defining reasoning-engine capability: they move validated knowledge across operational domains without breaking structural meaning.

## Rule / Pattern / Failure Mode

Rule:
Functor transforms must preserve structural invariants of the source knowledge.

Pattern:
Knowledge becomes executable when mapped across domains through structure-preserving transforms.

Failure Mode:
Transforms that break structural invariants produce invalid doctrine.

## Minimal-version boundary

In the minimal reasoning engine, transform scope is intentionally narrow:

- support contract proposal generation from validated pattern knowledge
- keep mappings deterministic and lineage-complete
- defer broad functor ecosystem expansion until phased proof is complete

Out-of-scope during minimal proof:

- broad functor ecosystem rollout
- autonomous doctrine mutation through transform outputs
- cross-repo pattern propagation by default

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


## Novelty boundary

Playbook is not claiming invention of new raw mathematics through functors. The product novelty is deterministic operationalization: stable contracts, replayable mappings, and lineage-complete transform outputs integrated into governance workflows.

## Doctrine Transform contract

Within Phase 9, functor transforms are instantiated as **Doctrine Transforms**: promoted knowledge -> proposal artifact.

Initial governed examples:

- pattern -> story seed proposal
- pattern -> rule suggestion proposal
- pattern -> docs proposal

Eligibility requirements:

- source knowledge must be promoted
- source knowledge must be active (not stale, superseded, retired, or demoted)
- source knowledge must remain provenance-linked

Rejection requirements:

- candidate knowledge is ineligible
- stale or superseded doctrine is ineligible
- transforms may emit proposals only; they may not execute changes directly

Transform outputs must be reviewable, explicit, and provenance-linked so downstream systems can consume them without hidden mutation.
