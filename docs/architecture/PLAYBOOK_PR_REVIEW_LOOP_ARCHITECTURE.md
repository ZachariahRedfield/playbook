# PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE

## Purpose

The PR Review Loop is now a single canonical runtime contract captured in `.playbook/pr-review-loop.json`.

This artifact makes PR review behavior deterministic and auditable across trigger normalization, evidence hydration, policy gating, bounded remediation eligibility, re-verification, and escalation.

## Canonical runtime loop

Pattern: **trigger -> hydrate evidence -> analyze -> gate -> bounded action -> re-verify -> escalate**.

1. **Trigger normalization**
   - Source trigger is normalized from canonical analyze-pr/session surfaces.
2. **Evidence hydration**
   - Runtime records deterministic refs to canonical artifacts (`analyze-pr`, session/evidence, policy/apply, verify/preflight, remediation-status, plan/receipt refs where present).
3. **Policy gate**
   - Policy decision is derived from canonical PR review gate state.
4. **Bounded action eligibility**
   - Autofix/remediation eligibility is read from canonical remediation status surfaces when present.
5. **Re-verification**
   - Verify + verify-preflight presence/outcomes are attached as explicit loop state.
6. **Escalation**
   - Next action and escalation state are deterministic (`none`, `requires_review`, `blocked`).

## Runtime contract

- Artifact path: `.playbook/pr-review-loop.json`
- Schema: `packages/contracts/src/pr-review-loop.schema.json`
- Producer surface: `review-pr` (read-first additive output)
- Operator read surfaces:
  - `review-pr` (writes loop artifact alongside `.playbook/pr-review.json`)
  - `status proof` continuity summary (reads loop ref + escalation state)

## Governance constraints

- **Rule:** PR review should resolve through one canonical session/evidence/policy loop, not adjacent tools.
- **Pattern:** Trigger-normalized, evidence-attached policy loops should remain deterministic across identical source artifacts.
- **Failure Mode:** If PR review logic is split across comments and command seams, operators get fragmented state instead of one governed loop contract.
