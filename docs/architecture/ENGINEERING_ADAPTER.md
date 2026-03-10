# Engineering Adapter Boundary

## Purpose

This document defines how engineering-domain artifacts map onto the domain-agnostic Playbook core.

## Boundary contract

Engineering adapters are responsible for translating engineering artifacts into core objects.

### Required mappings

- Repository artifacts -> `Evidence`
- `verify` / `plan` / `apply` outputs -> `Evidence`
- Promotion and contract surfaces -> adapter outputs consumed by governance doctrine

The adapter may enrich evidence metadata (module, path, commit, rule id, severity) but must not change kernel semantics.

## Adapter responsibilities

1. Ingest engineering artifacts deterministically.
2. Normalize artifacts into `Evidence`.
3. Build `Zettel` and `Edge` structures using core APIs.
4. Feed compaction and decision phases without embedding engineering assumptions into kernel internals.
5. Emit governance-facing outputs (for example contracts) outside the kernel boundary.

## Non-responsibilities

The engineering adapter must not:

- rewrite kernel object definitions
- bypass the core API stages
- auto-mutate doctrine based on meta-analysis

## Doctrine

Rule:
Engineering-specific semantics must stay inside adapter translation layers.

Pattern:
Adapters localize domain complexity while preserving a stable reasoning kernel.

Failure Mode:
When adapters leak domain fields directly into kernel invariants, core portability and replayability degrade.
