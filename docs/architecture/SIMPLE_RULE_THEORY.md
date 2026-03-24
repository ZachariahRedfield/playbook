# Simple Rule Theory

Simple Rule Theory is a first-class Playbook doctrine for both governance and information refinement.

## Core Principle

"Systems that cannot be reduced to a small set of explicit, enforceable rules cannot be reliably automated or governed."

## Informational Principle

"Simple rules should refine raw or noisy inputs into minimal sufficient representations that preserve the invariants required to derive valid downstream behavior, views, and decisions."

## Compression / Refinement Principle

- Extract invariants from observations, state, or data.
- Remove redundancy and view-specific duplication.
- Persist the minimal sufficient information needed for deterministic regeneration of derived outputs.
- Prefer deriving secondary state on demand over storing redundant expansions.

## Important Precision Note

Simple Rule Theory does not claim information recovery beyond retained evidence.

- Rules should allow reconstruction of all relevant and derivable information implied by the rule set and retained inputs.
- Rules do not magically recover discarded entropy.

## Applications in Playbook

- `verify` refines raw repository/system state into invariant findings and rule violations.
- `plan` transforms findings into a minimal remediation model.
- `apply` materializes enforced changes from the remediation model.
- `contracts` expose compact governing surfaces rather than duplicated behavior descriptions.

## Rule

- Systems must be governable through explicit rules.
- Persist minimal sufficient invariants; derive redundant state on demand.

## Pattern

- Complex behavior emerges from simple rule composition.
- Minimal sufficient representation supports deterministic derivation.
- Derive, don't duplicate.

## Failure Mode

- Implicit behavior drift — system behavior exists but is not captured in rules.
- Redundant state proliferation — the system stores expanded derivatives instead of compact invariants.
- Lossy abstraction — simplification removes information required for deterministic reconstruction.

## Short Design Heuristic

- What is the invariant here?
- What is raw noise vs governing signal?
- What is the smallest rule/input set needed to regenerate required downstream behavior?
- Which stored fields are redundant and should instead be derived?
