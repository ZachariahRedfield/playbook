# Playbook Reasoning Engine Positioning

## Positioning statement

Playbook is a deterministic reasoning engine with a thin delivery CLI.

Its architecture now separates:

1. a frozen domain-agnostic cognitive core,
2. domain adapters (engineering first), and
3. a proposal-driven meta-observation layer.

## Core + adapter + meta stack

- **Minimum Cognitive Core**: `observe -> represent -> relate -> compress -> decide`
- **Engineering Adapter**: maps repository/governance artifacts into core evidence structures
- **Meta-Playbook**: reads Playbook artifacts and emits findings/telemetry/proposals for governed review

## Governance posture

Playbook can propose process improvements from its own telemetry, but it cannot self-edit doctrine automatically.

All doctrine changes remain human-governed through standard review workflows.

## Doctrine

Rule:
The reasoning kernel remains domain-agnostic and adapter-isolated.

Pattern:
A tiny stable core plus deterministic adapters and proposal-only meta analysis yields scalable governance.

Failure Mode:
Kernel coupling to repository assumptions or automatic doctrine mutation destroys determinism and replayability.
