# Verify Output Contract

## Failure Derivation Contract

Playbook remediation decisions are driven exclusively by failures.

Failure count is derived using the following precedence:

1. `verify.failures[]` array (**authoritative**)
2. `verify.findings[]` entries with `level: "failure"` or `level: "error"`

Warnings never contribute to failure count.

This contract prevents rule authors from misinterpreting findings and accidentally triggering remediation from non-failure results.

## Why This Matters

Playbook depends on a stable execution invariant:

```text
analysis output
      ↓
failure extraction
      ↓
remediation planning
      ↓
deterministic apply
```

If failure derivation is fuzzy, behavior becomes unpredictable and can cause:

- remediation running when it should not
- remediation skipping when it should run
- CI false positives
- broken demo repositories

## Pattern: Failure-Driven Remediation

```text
Discovery (verify/analyze)
      ↓
Findings
      ↓
Failure Derivation
      ↓
Remediation Planning
      ↓
Remediation Apply
```

**Rule:** Remediation logic must depend only on failures, never on total findings.

**Reason:** Findings include warnings and informational results, which must not trigger repository modification.
