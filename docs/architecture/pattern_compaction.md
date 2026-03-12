# Pattern Compaction

Playbook stores engineering knowledge as canonical patterns rather than raw observations.

## Rule

Engineering knowledge should be stored as canonical patterns rather than raw observations.

## Pattern

Canonicalization reduces reasoning complexity and enables cross-repository learning.

## Deterministic flow

`verify -> pattern compaction -> candidate review queue -> explicit promotion decision -> promoted patterns`

Pattern extraction sources:

- verification failures
- remediation plan tasks
- dependency graph/module edges from repository index
- repository topology metadata (architecture)

Canonicalization normalizes similar observations into stable IDs (for example, `missing unit tests for module` and `module lacks tests` both map to `MODULE_TEST_ABSENCE`).

Buckets are deterministic and constrained to:

- architecture
- testing
- dependency
- documentation
- governance

Artifact contract:

```json
{
  "schemaVersion": "1.0",
  "command": "pattern-compaction",
  "patterns": [
    {
      "id": "MODULE_TEST_ABSENCE",
      "bucket": "testing",
      "occurrences": 3,
      "examples": ["module lacks tests"]
    }
  ]
}
```

Query surface:

- `playbook query patterns`
- `playbook query pattern-review`
- `playbook query promoted-patterns`
- `playbook patterns promote --id <pattern-id> --decision approve|reject`

Promotion boundaries:

- Compact observations are staged as candidate knowledge in `.playbook/pattern-review-queue.json`.
- Promotion requires an explicit deterministic decision record and never happens silently.
- Approved patterns are persisted to `.playbook/patterns-promoted.json`.
- Storage is local-only for this slice; cross-repo sync is intentionally out of scope.

Rule: Compacted observations are not durable knowledge until they pass through an explicit promotion boundary.

Pattern: Knowledge systems compound best when extraction and promotion are separated.

Failure Mode: If every observation becomes permanent knowledge immediately, the system accumulates noisy pseudo-patterns and degrades future reasoning.
