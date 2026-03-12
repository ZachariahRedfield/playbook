# Pattern Compaction

Playbook stores engineering knowledge as canonical patterns rather than raw observations.

## Rule

Engineering knowledge should be stored as canonical patterns rather than raw observations.

## Pattern

Canonicalization reduces reasoning complexity and enables cross-repository learning.

## Deterministic flow

`verify -> pattern compaction -> .playbook/patterns.json`

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

## Future work

Pattern promotion system for cross-repository knowledge sharing.
