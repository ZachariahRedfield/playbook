# Repository Memory Events (Phase 9)

Repository Memory Events provide deterministic, append-only operational evidence for core orchestration workflows.

## Rule

- **Record events, not interpretations.**

## Pattern

- **Append-only event stores preserve deterministic system history.**

## Failure Mode

- **Conflating raw events with derived insights corrupts evidence lineage.**

## Artifact locations

- `.playbook/memory/events/` — append-only event files
- `.playbook/memory/index.json` — deterministic index containing event counts and latest timestamps by `event_type`

## Event types (v1)

- `route_decision`
- `lane_transition`
- `worker_assignment`
- `lane_outcome`
- `improvement_candidate`

## Event shape

```json
{
  "event_type": "route_decision",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "task_text": "add deterministic memory event recording",
  "task_family": "implementation",
  "route_id": "minimal-safe-change",
  "confidence": 0.9
}
```

All event records additionally include:

- `schemaVersion`
- `event_id`

## Determinism guarantees

- Stable JSON formatting (2-space indentation + trailing newline).
- Canonical object key ordering before writes.
- Event IDs derived from timestamp + event type + canonical payload hash with deterministic collision suffixing.
- Index updates are monotonic and append-safe.

## Recording helpers

The engine exposes deterministic helpers for v1 event capture:

- `recordRouteDecision()`
- `recordLaneTransition()`
- `recordWorkerAssignment()`
- `recordLaneOutcome()`
- `recordImprovementCandidate()`

Use `safeRecordRepositoryEvent()` around calls where event recording should remain best-effort and non-blocking.
