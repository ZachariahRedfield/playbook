# Architecture Decision: <title>

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD
- Owners: <team/person>
- Scope: <subsystem/repo area>

## Constraints

- <governing constraints that bound valid choices>

## Cost Surfaces

- <where cost/pressure concentrates: coordination, runtime, complexity, reliability, etc.>

## Options Considered

1. **Option A** — <short description>
   - Fit: <why it fits or does not fit current constraints>
2. **Option B** — <short description>
   - Fit: <why it fits or does not fit current constraints>

## Chosen Shape

- <selected structure and key boundaries>

## Why This Fits

- <explicit mapping from constraints/cost surfaces to selected shape>

## Tradeoffs / Failure Modes

- Tradeoffs:
  - <what becomes harder or more expensive>
- Failure modes:
  - <likely failure mode>
  - Mitigation: <how to detect/respond>

## Review Triggers

Use one trigger per line with this compact shape:

- `- [trigger_id] when <observable condition> -> <required review action>`
- `- [trigger_id] when <observable condition> -> <required review action>`

Notes:
- Keep `trigger_id` stable and snake_case for deterministic extraction.
- Keep `when` clause observable and specific (metric/threshold/event), not narrative.
- Keep action explicit (for example: `run architecture decision review`).

---

Rule: Record architecture from governing constraints first, not from preferred shapes.
Pattern: Constraint -> optimization -> emergent structure.
Failure Mode: Teams cargo-cult attractive architectures without documenting the constraints that made them fit.
Rule: Review-trigger sections should be structured enough for deterministic extraction.
Pattern: Human-readable, machine-extractable trigger design.
Failure Mode: “Review triggers” written as narrative prose never become usable operational signals.
