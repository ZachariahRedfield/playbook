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


## Rule: Deterministic Execution

All repository mutations must occur through the `verify -> plan -> apply` execution pipeline.

Direct mutation outside the execution engine is considered unsafe.

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


## Cosign Signing Requirements in CI

- Playbook CI uses Sigstore keyless signing for SBOM artifacts.
- Verification requires `--certificate-identity` or `--certificate-identity-regexp`.
- GitHub OIDC issuer for Cosign verification is `https://token.actions.githubusercontent.com`.
- CI verifies SBOM bundles using `cosign verify-blob`.
- Playbook uses identity-based verification:
  - `--certificate-identity-regexp "https://github.com/.+"`
  - `--certificate-oidc-issuer https://token.actions.githubusercontent.com`

- Cosign GitHub Action references should use full version tags (for example, `sigstore/cosign-installer@v4.0.0`) rather than floating `@v4`.
- Playbook CI installs Cosign using `sigstore/cosign-installer@v4.0.0`.
- SBOM artifacts are signed with Sigstore keyless signing using GitHub OIDC.
- Cosign is a standalone CLI, not an npm package.
- CI must install cosign using `sigstore/cosign-installer`.
- Cosign v3 uses the `--bundle` format for artifact signing.
- `--output-signature` and `--output-certificate` are deprecated in Cosign v3 bundle workflows.
- Playbook CI signs SBOM artifacts with `cosign sign-blob --bundle`.
- Playbook CI verifies SBOM artifacts with `cosign verify-blob --bundle`.
- GitHub Actions keyless signing requires `permissions: id-token: write`.


## Security Contracts

Playbook formalizes runtime safety guarantees as machine-readable contracts in `docs/contracts/security/` and verifies them using deterministic tests in `test/contracts/security/`.

Contract coverage includes repository boundary enforcement, apply scope enforcement, plan determinism, secret redaction, and policy gating.

- Pattern: Security Contracts — machine-readable definitions of runtime safety guarantees.
- Pattern: Contract-Driven Security Tests — CI verifies engine security behavior through contract definitions.
- Rule: Apply Scope Enforcement — apply may only modify files declared in the plan.
- Rule: Repository Boundary — file operations must resolve within repo root.
- Rule: Secret Redaction — sensitive values must never appear in logs.
- Failure Mode: Boundary Escape — path traversal or symlink attacks attempting to escape repo root.
