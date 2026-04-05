# Phase 21 Autonomous Maintenance (Policy-Gated, Proposal-Only v1)

## Scope

Autonomous Maintenance begins as a deterministic, **proposal-only recurring maintenance planning** slice.

- Canonical artifact: `.playbook/maintenance-plan.json`
- Canonical evidence inputs only: verify / verify-preflight, longitudinal-state, outcome-feedback, remediation status/history
- Explicitly bounded candidate types only (docs audit maintenance, release-governance drift reconciliation, ignore/cleanup hygiene recommendations, repeated approved low-risk remediation patterns)

## Rule

Autonomous Maintenance begins as proposal-only recurring maintenance planning under explicit approval gates.

## Pattern

recurring evidence -> maintenance plan -> approval -> bounded execution

## Failure mode

Jumping directly from recurring signal detection to execution bypasses the policy-gated trust model.

## Authority boundaries (v1)

- No execution authority expansion in this slice.
- No autonomous doctrine promotion.
- No hidden mutation or uncontrolled runtime actions.
- Deterministic ordering and provenance are required for every maintenance row.
