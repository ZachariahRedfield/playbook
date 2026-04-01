# Playbook Patterns

This document captures repo-level product and experience patterns that should govern future Playbook work.

Rule: Promote repeated pilot learnings into explicit doctrine before they become tribal knowledge.

## System -> Interpretation Gap

A deterministic system can be correct and still be hard to use when its outputs require too much internal system knowledge to interpret.

- **Pattern**: System -> Interpretation Gap.
- **Definition**: The gap between governed system truth and the human ability to understand what matters next.
- **Why it matters**: The external fitness pilot showed that correct outputs alone do not guarantee actionability or adoption.
- **Design implication**: Treat interpretation as a first-class product layer, not as optional polish.

Failure Mode: Correct-but-dense outputs that require system knowledge reduce actionability and adoption.

## Interpretation Layer

Playbook should provide a representational layer that converts deterministic system truth into human-readable guidance.

- **Pattern**: Interpretation Layer.
- **Job**: Derive summaries, priorities, and explanations from governed artifacts.
- **Non-goal**: This layer must not mutate source-of-truth artifacts or introduce hidden system state.
- **Output shape**: concise summaries, next-step framing, confidence/exceptions, and links back to canonical artifacts.

Rule: Interpretation must be derived from deterministic system truth rather than replacing it.

## Progressive Disclosure

Operators should be able to start with the smallest useful answer and reveal deeper system detail only when needed.

- **Pattern**: Progressive Disclosure.
- Start with a short answer, health summary, or decision recommendation.
- Reveal evidence, related artifacts, and lower-level diagnostics on demand.
- Keep dense system truth accessible, but do not force it into the default view.

Pattern: Human-facing outputs should widen from summary -> explanation -> artifact detail.

## Single Next Action

When Playbook knows the most useful next operator move, it should say so clearly.

- **Pattern**: Single Next Action.
- Prefer one recommended action over a flat list of equally weighted possibilities.
- Use alternatives only when the primary action is blocked or depends on human review.
- Pair the action with a short reason and the governing evidence.

Rule: Default operator guidance should converge on one recommended next step whenever evidence is sufficient.

## State -> Narrative Compression

Playbook often has more state than a human needs to read. Product surfaces should compress state into a narrative that preserves truth while lowering cognitive load.

- **Pattern**: State -> Narrative Compression.
- Compress deterministic state into a short explanation of what happened, why it matters, and what comes next.
- Keep provenance intact by linking every narrative back to its underlying artifacts.
- Prefer stable summaries over ad hoc prose.

Pattern: Deterministic state should be compressible into deterministic narrative.

## Pilot-derived engineering patterns

The first external pilot also exposed concrete product-engineering patterns that should govern future system work.

### Shared aggregation boundary for reads, targeted invalidation boundary for writes

- **Pattern**: Shared aggregation boundary for reads, targeted invalidation boundary for writes.
- Read models should compose through one shared aggregation boundary so interpretation and diagnostics read the same truth.
- Write paths should invalidate only the affected recomputation boundaries rather than rebuilding unrelated state.
- This keeps correctness and operator trust aligned while reducing unnecessary churn.

Rule: Read composition should converge through shared aggregation, while writes should invalidate only the affected canonical boundaries.

### Mutation path -> affected canonical IDs -> centralized recompute

- **Pattern**: Mutation path -> affected canonical IDs -> centralized recompute.
- Mutations should first identify which canonical IDs changed.
- Recompute should then run through one centralized path rather than scattered local refresh logic.
- This keeps repeated logic, correctness seams, and invalidation behavior auditable.

Rule: Mutation handling should flow through canonical IDs and centralized recompute rather than distributed bespoke refresh logic.

## Pilot doctrine capture

The external fitness pilot promoted the following doctrine into repository-level guidance:

- stabilize tooling surface before governed product work
- first governed improvements should target correctness/performance seams with repeated logic and clear invariants
- tooling migration incomplete until runtime + governance bootstrap proof passes

Failure Mode: A repo can look integrated while still failing real governed consumption due to missing bootstrap/runtime/artifact guarantees.

## Cognitive Dynamics Framework v0.1 (research link)

This repo also maintains a doctrine-level cognitive model in [Cognitive Dynamics Framework v0.1](./research/COGNITIVE_DYNAMICS_FRAMEWORK_V0_1.md).

### When to use this framework

Use it when reviewing interpretation drift, pattern/rule transferability, or recalibration needs across changing repository evidence.

Non-goal: it does not replace command truth or the canonical remediation flow.

