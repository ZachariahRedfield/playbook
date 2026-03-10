# Meta-Playbook

## Purpose

Meta-Playbook is a deterministic proposal engine that analyzes Playbook artifacts and emits process-improvement recommendations.

Meta-Playbook is proposal-driven, not self-editing.

```mermaid
flowchart LR
  A[playbook artifacts] --> B[meta findings]
  B --> C[meta proposals]
  C --> D[governed review]
```

## Allowed outputs

Meta-Playbook may emit only:

- findings
- telemetry
- proposals

It must not auto-mutate contracts, pattern cards, thresholds, or schemas.

## Governance route

Any self-improvement must flow through normal governance and versioning workflows.
Meta artifacts are input to review, not direct doctrine mutation.

## Homeostasis budgets

Meta telemetry tracks policy budgets for governed review:

- canonical core size
- max unresolved draft age
- max contract mutations per cycle
- duplication threshold
- entropy budget trend

## Rule / Pattern / Failure Mode

Rule:
Meta-Playbook may observe and propose improvements but cannot mutate doctrine automatically.

Pattern:
Proposal-driven self-observation improves process quality without violating deterministic governance replayability.

Failure Mode:
If meta-analysis directly edits doctrine, governance becomes brittle and non-replayable.
