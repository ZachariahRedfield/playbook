# Playbook UI Guidelines

This document defines human-facing presentation doctrine for Playbook command surfaces, docs, and future interfaces.

Rule: UI surfaces must improve comprehension without becoming a second source of truth.

## Core presentation principles

### System -> Interpretation Gap

Every UI surface should assume that raw governed outputs may be correct yet still difficult for a new operator to use.

- Lead with meaning before density.
- Explain what changed, why it matters, and what the operator should do next.
- Avoid requiring prior system knowledge to decode default views.

Failure Mode: Correct-but-dense outputs that require system knowledge reduce actionability and adoption.

### Interpretation Layer

Human-facing views are an interpretation layer over deterministic system truth.

- The interpretation layer is representational only.
- It does not modify source-of-truth artifacts.
- It does not introduce nondeterministic state.
- It derives human-facing summaries from deterministic system truth.

Rule: UI summaries must always be traceable back to canonical artifacts.

### Progressive Disclosure

Use layered disclosure for complex state:

1. summary
2. recommended next action
3. explanation
4. artifact/evidence detail

Default views should stay compact, while advanced details remain one interaction away.

### Single Next Action

When evidence is sufficient, present one primary recommendation.

- Show the next action prominently.
- Include the reason and any blocking condition.
- Present secondary options only when they are materially different paths.

### State -> Narrative Compression

Compress dense system state into stable narratives.

- Prefer “what happened / why it matters / what to do next” framing.
- Preserve exact artifact references for auditability.
- Keep status labels and summaries deterministic wherever possible.

## Architecture boundary for UI work

UI surfaces may summarize, group, and order governed truth, but they must not become mutation owners.

- Read from canonical artifacts.
- Render interpretation, not independent state.
- Never hide whether data is derived, stale, missing, or blocked.

Rule: If a UI needs state that does not exist in canonical artifacts, the artifact model should be fixed first.

## Pilot-informed product guidance

The external fitness pilot suggests these priorities for user-facing work:

- make bootstrap and runtime health legible before deeper product workflows
- make next-best-improvement selection obvious instead of leaving operators with dense candidate lists
- make post-merge doctrine extraction visible so learning feels cumulative
- translate dense system truth into readable narratives for humans without weakening governance
