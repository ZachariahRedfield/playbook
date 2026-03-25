# Playbook Constraint-Driven Architecture Rubric

## Purpose

This rubric defines how Playbook records high-value architecture choices as constraint-first decisions.

It keeps architecture docs operational: structure emerges from constraints and tradeoffs, not style preferences.

Rule: Record architecture from governing constraints first, not from preferred shapes.
Pattern: Constraint -> optimization -> emergent structure.
Failure Mode: Teams cargo-cult attractive architectures without documenting the constraints that made them fit.

## Decision protocol

Use this protocol whenever a change affects architecture boundaries, ownership seams, cost profiles, or failure behavior.

1. Start with explicit constraints and non-negotiable context.
2. Name cost surfaces that will dominate outcomes.
3. Compare realistic options under those constraints.
4. Choose a shape that best fits the current environment.
5. Record tradeoffs and review triggers so the decision can be revisited safely.

Keep entries concise and evidence-linked. Avoid “ultimate shape” or one-size-fits-all framing.

## Required decision sections

Every architecture decision record should include these sections (small and operational):

- `## Constraints`
- `## Cost Surfaces`
- `## Options Considered`
- `## Chosen Shape`
- `## Why This Fits`
- `## Tradeoffs / Failure Modes`
- `## Review Triggers`

## Section guidance

### Constraints

Capture the governing forces that bound valid choices (for example: latency budgets, ownership boundaries, compliance requirements, mutation risk, reliability targets, interface pressure).

### Cost Surfaces

Identify where cost concentrates (for example: coordination cost, runtime cost, complexity cost, operability burden, delivery speed, incident recovery friction).

### Options Considered

List feasible alternatives with short notes on fit/misfit under current constraints.

### Chosen Shape

Describe the selected structural approach in plain terms (module boundaries, coupling strategy, interaction model, control points).

### Why This Fits

Connect the chosen shape directly to constraints and cost surfaces; make optimization intent explicit.

### Tradeoffs / Failure Modes

State what gets worse, likely failure modes, and mitigation expectations.

### Review Triggers

Define concrete triggers for re-evaluation (constraint changes, scale shifts, incident patterns, ownership changes, cost spikes).

Use a compact, machine-extractable line format:

- `- [trigger_id] when <observable condition> -> <required review action>`

Example:

- `[p95_latency_budget_breach] when p95 latency exceeds 250ms for 7 consecutive days -> run architecture decision review`

## Operating guardrails

- Do not justify structure with taste language alone.
- Do not copy external architecture patterns without local constraint mapping.
- Do not treat today’s chosen shape as a permanent endpoint.
- Keep updates deterministic and reviewable through existing docs/governance flows.
- Write review triggers as structured signals, not narrative prose.

Rule: Review-trigger sections should be structured enough for deterministic extraction.
Pattern: Human-readable, machine-extractable trigger design.
Failure Mode: “Review triggers” written as narrative prose never become usable operational signals.

## Template

Use `PLAYBOOK_ARCHITECTURE_DECISION_TEMPLATE.md` as the canonical decision record skeleton.
