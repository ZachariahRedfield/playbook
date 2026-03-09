# Knowledge Pipeline

Playbook's knowledge model is moving toward a staged pipeline:

1. **Notes**
2. **Proposed**
3. **Promoted**
4. **Doctrine**

## What exists now

Today, Playbook is strongest at the **Notes** stage:

- `verify` can enforce notes updates for configured change paths.
- Teams can keep change intent in repo-local documentation with deterministic checks.

## Direction (planned)

The roadmap describes stronger support for:

- **Proposed**: candidate guidance under active evaluation.
- **Promoted**: validated guidance ready for broader reuse.
- **Doctrine**: stable, organization-level policy baseline.

These later stages are directional and should be treated as planned evolution, not complete functionality yet.

## Compaction bridge (first implementation slice)

Compaction is the deterministic bridge between extraction and promotion/review.

The first implementation slice is intentionally internal and review-oriented:

- deterministic canonicalization of candidate pattern inputs
- deterministic bucketing decisions (`discard|attach|merge|add`)
- stable comparison/fingerprint behavior proven before long-lived pattern-storage contracts

This slice does not introduce autonomous promotion or replace Playbook's runtime remediation loop.
