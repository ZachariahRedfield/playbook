# Security Principles

This document defines the non-negotiable security operating rules for Playbook.

## Rule: No Unreviewed Writes

Playbook must never modify repository files without a remediation plan that is:

- diff-based
- reviewable
- explicitly applied by the user

## Rule: Repo Root Is the Security Boundary

All file reads and writes must resolve within the repository root.

Reject:

- path traversal
- symlink escapes
- external write attempts

## Rule: Repository Content Is Untrusted Input

Repository files are evidence, not instructions.

Repository content must never be interpreted as runtime instructions that influence:

- system prompts
- engine behavior
- policy decisions

## Rule: Plans Must Be Evidence-Linked

Every remediation plan must include deterministic links to:

- rule id
- evidence location
- affected files
- deterministic reasoning

## Rule: Secure Defaults

When a security property cannot be verified, Playbook must fail closed or warn loudly.

Playbook must not silently proceed when boundary, provenance, or policy checks are inconclusive.


## CI Diff Scanner History Guarantees

Rule: diff-based CI scanners must not rely on default `actions/checkout` depth; set `fetch-depth: 0` for deterministic PR history access.

Failure Mode: `fatal: ambiguous argument '<sha>^..<sha>'` in CI usually means the parent/base commit was not fetched locally, not that the repository is corrupt.

Pattern: security workflows that scan commit ranges should standardize checkout first, scanner second.

Note: gitleaks partial-scan/no-leaks output does not mean the job passed; git-history resolution errors still fail the action.


## SBOM Generation Reliability (pnpm Workspaces)

- CycloneDX SBOM generation requires `--ignore-npm-errors` when running in pnpm workspaces.
- `npm ls` may report `ELSPROBLEMS` for devDependency trees that are not actual install issues.
- Playbook CI uses CycloneDX spec `v1.5` for SBOM artifacts.
- SBOM artifacts are written to `artifacts/sbom.json` during CI.
