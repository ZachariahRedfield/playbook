# Canonical Core vs Provisional Frontier

## Purpose

This document defines Playbook's trust-layer architecture for knowledge growth.

Playbook must maintain a small, stable, high-trust **canonical core** and a larger, faster-moving **provisional frontier**.

This phase is documentation and telemetry only. It does not introduce hard runtime enforcement.

## Trust-layer definitions

### Provisional frontier

The provisional frontier is the high-volume, exploratory knowledge surface.

It includes raw and semi-processed material that is still expected to change frequently:

- runtime artifacts
- zettels
- groups
- draft patterns

### Canonical core

The canonical core is the low-volume, high-trust doctrine surface.

It contains knowledge that has passed stronger review and promotion controls:

- promoted patterns
- contracts

## Trust ladder and compression requirements

Trust increases as knowledge moves upward through the lifecycle.

`artifacts -> zettels -> groups -> draft patterns -> promoted patterns -> contracts`

Each upward transition must perform topology-aware compression and trust hardening:

- fewer entities should represent more evidence
- mutation cadence should slow
- review depth should increase

## Lifecycle pyramid invariants

Playbook lifecycle pyramid:

`artifacts -> zettels -> groups -> draft patterns -> promoted patterns -> contracts`

Required invariants:

1. Volume must decrease as trust increases.
2. Mutation frequency must decrease as trust increases.
3. Review requirements must increase as trust increases.

## Telemetry surface (docs-only in this phase)

Track the following fields as lifecycle health indicators:

- `artifactToZettelRatio`
- `zettelToPatternRatio`
- `draftToPromotedRatio`
- `promotedToContractRatio`
- `canonicalCoreSize`
- `provisionalFrontierSize`
- `unresolvedDraftAge`
- `doctrineDrift`

These metrics are intended for observability and budgeting preparation, not immediate hard-gate enforcement.

## Future enforcement budgets (backlog direction)

The following controls are intentionally deferred to future enforcement work:

- canonical core size budget
- max contract mutations per cycle
- max unresolved draft age
- forced topology compression threshold

## Governance doctrine

Rule:
No knowledge layer may grow in authority faster than it shrinks in volume.

Pattern:
A reasoning engine stays healthy by maintaining a small canonical core and a large provisional frontier.

Failure Mode:
When canonical layers expand too quickly or provisional layers never compress, the system collapses into doctrine thrash or structured clutter.
