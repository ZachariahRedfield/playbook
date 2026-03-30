# Architecture Tightening Overview

This document formalizes current architecture boundaries so ownership is explicit and architectural drift is less likely over time. It preserves the existing system design and clarifies canonical seams and contracts.

## Architecture Layers and Ownership

### Playbook (control plane)

Owns:

- planning
- governance
- memory
- pattern recognition
- contract interpretation

Does **not** own:

- runtime execution

### Lifeline (runtime/operator)

Owns:

- process execution
- supervision
- environment orchestration

Does **not** own:

- planning logic
- decision-making logic

### Subapps (for example, Fitness)

Owns:

- domain logic
- signal emission
- local data truth

Does **not** own:

- global orchestration
- cross-repo reasoning

> No layer should implement behavior owned by another layer.

## Playbook ↔ Lifeline Seam Contract

The inter-system boundary is declarative intent from Playbook and execution evidence from Lifeline.

- **Playbook → Lifeline:** execution plans/actions (declarative intent)
- **Lifeline → Playbook:** receipts, execution results, runtime state

Constraints:

- Lifeline must not reinterpret intent.
- Playbook must not perform execution.

## Subapp Integration Standard

Any integrated app is expected to:

- produce signals/events
- expose repo truth (truth-pack or equivalent)
- define a runtime manifest for Lifeline
- accept execution triggered via Lifeline

> Fitness is the reference implementation for this pattern.

## Closed-Loop Architecture

Canonical closed-loop behavior:

1. app emits signals
2. Playbook interprets signals into state and planned actions
3. Lifeline executes actions
4. execution produces receipts/results
5. Playbook updates memory/patterns/state
6. next actions are derived

> The system is designed as a continuous feedback loop, not a one-time execution pipeline.

## Failure Domains

Failures are classified by layer responsibility:

- contract validation failures
- runtime execution failures
- CI/bootstrap failures
- sync/drift failures
- governance/planning failures

> Failures must be classified at the correct layer to avoid misdirected fixes.

## Architectural Constraints

To preserve system shape and prevent drift:

- do not expand system layers
- do not introduce new control planes
- do not move execution logic into Playbook
- do not move planning logic into Lifeline

## Pattern and Failure Mode

Pattern:

- Strong architecture requires explicit seam ownership, not implicit understanding.

Failure Mode:

- Architectural drift occurs when multiple layers can plausibly own the same behavior.
