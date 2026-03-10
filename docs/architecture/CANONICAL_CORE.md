# Canonical Core and Homeostasis Budgets

## Purpose

Playbook maintains a small, stable canonical core and a larger provisional frontier.

This document defines observability budgets used for governance review.

## Trust layers

- **Provisional frontier**: high-volume exploratory knowledge (artifacts, zettels, groups, drafts).
- **Canonical core**: low-volume high-trust doctrine (promoted patterns, contracts).

Trust ladder:

`artifacts -> zettels -> groups -> draft patterns -> promoted patterns -> contracts`

## Homeostasis budgets

Budgets are policy signals for review; they do not auto-mutate doctrine.

- **Canonical core size**: maximum allowed growth of promoted patterns/contracts per cycle.
- **Max unresolved draft age**: maximum age for unresolved drafts before intervention is required.
- **Max contract mutations per cycle**: cap on contract mutation frequency.
- **Duplication threshold**: upper bound for duplicate pattern pressure.
- **Entropy budget trend**: acceptable trend band for entropy delta across cycles.

## Lifecycle invariants

1. Volume decreases as authority increases.
2. Mutation cadence decreases as authority increases.
3. Review depth increases as authority increases.

## Doctrine

Rule:
No knowledge layer may grow in authority faster than it shrinks in volume.

Pattern:
A healthy reasoning system preserves a compact canonical core with explicit homeostasis budgets.

Failure Mode:
Without budgeted homeostasis, doctrine thrash and unresolved provisional sprawl accumulate simultaneously.

## Minimum Cognitive Core alignment

Rule:
The canonical core tracks promoted doctrine outcomes, while reasoning primitives remain in the domain-agnostic kernel.

Pattern:
Homeostasis budgets monitor the adapter frontier and canonical doctrine without mutating either automatically.

Failure Mode:
If core budgets are enforced by automatic doctrine edits, governance lineage and replayability are lost.
