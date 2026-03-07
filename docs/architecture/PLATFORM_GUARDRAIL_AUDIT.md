# Playbook Architecture Guardrail Audit

This audit summarizes the current guardrail status for foundational platform dependencies and identifies documentation/governance hardening work.

## 1) Repository Intelligence Layer

### Strengths

- Deterministic intelligence artifacts exist at `.playbook/repo-index.json` and `.playbook/repo-graph.json`.
- Artifacts include explicit `schemaVersion` fields.
- Downstream commands (`query`, `deps`, `explain`, `ask --repo-context`) are documented as artifact-driven.

### Gaps / risks

- Artifact evolution policy was previously documented per-artifact (graph) rather than as a single cross-artifact policy.
- Freshness/staleness behavior is partially implemented (for example doctor checks) but lacked one central policy document.

### Hardening action

- Added centralized artifact evolution policy at `docs/contracts/ARTIFACT_EVOLUTION_POLICY.md`.

## 2) Artifact Evolution Policy

### Strengths

- Schema contracts exist for command JSON outputs and enforce key required fields.
- `apply` validates plan schema version and fails on mismatch.

### Gaps / risks

- Compatibility and CI mismatch behavior were not centralized across all persisted artifacts.
- Regeneration expectations were distributed across command docs.

### Hardening action

- Added repository-wide policy for schema versioning, compatibility semantics, regeneration expectations, and CI mismatch behavior.

## 3) Git / SCM Context Layer

### Strengths

- Shared git base/diff utilities exist and are reused by several engine flows.

### Gaps / risks

- SCM context handling remains partly distributed across engine/node command paths.
- Edge-case behavior for shallow clone, detached HEAD, and rename handling is not centrally documented.

### Hardening action

- Added normalization plan in `docs/architecture/SCM_CONTEXT_LAYER.md`, including proposal for shared `packages/core/src/scm/context.ts`.

## 4) Remediation Trust Boundaries

### Strengths

- Verify/plan/apply flow is deterministic and documented as canonical remediation sequence.

### Gaps / risks

- Explicit change-level model was not previously documented as a formal architecture policy.

### Hardening action

- Added `docs/architecture/REMEDIATION_TRUST_MODEL.md` with Level 0-3 change boundaries.

## 5) AI vs Deterministic Boundary

### Strengths

- AI bootstrap commands and repository intelligence contract already exist.

### Gaps / risks

- Advisory-vs-authoritative split needed a single explicit architecture policy reference.

### Hardening action

- Added `docs/architecture/AI_DETERMINISM_BOUNDARY.md` formalizing evidence and authority boundaries.

## 6) Ecosystem Tool Dependencies

### Strengths

- Project uses deterministic local-first toolchain and documented command contracts.

### Gaps / risks

- Adapter boundary approach for external tools needed explicit architecture documentation to avoid direct coupling drift.

### Hardening action

- Added `docs/architecture/ECOSYSTEM_ADAPTERS.md`.

## 7) Documentation Synchronization

### Strengths

- Existing governance and docs audit command provide deterministic doc checks.

### Gaps / risks

- Cross-cutting architecture guardrails were not consolidated in a single auditable package.

### Hardening action

- Added this audit artifact plus linked policy docs, and updated roadmap/changelog for traceability.

## 8) Performance / Token Efficiency

### Strengths

- Index/query split already enables deterministic context reuse.
- Narrow context command options exist (`--module`, `--diff-context`, ask output modes).

### Gaps / risks

- No dedicated architecture policy doc tied these features together under explicit performance/token guardrails.

### Hardening action

- Added `docs/architecture/CONTEXT_EFFICIENCY_STRATEGY.md`.

## Optional follow-up PR suggestions

1. Implement `packages/core/src/scm/context.ts` and migrate all SCM callsites to one provider.
2. Add command-level freshness metadata (`artifactAgeMs`, `generatedAt`) with strict deterministic rules.
3. Extend schema contracts to require change-level metadata on all `plan` tasks.
4. Add contract tests asserting advisory-only AI behavior cannot trigger apply without deterministic plan.
5. Add docs index page for `docs/architecture/*` to reduce policy discoverability drift.

## Guardrail statements (copy-pastable)

- Playbook’s long-term reliability depends on deterministic repository artifacts powering higher-level intelligence commands.
- All persisted artifacts must include schema versioning and an explicit evolution policy.
- Git/SCM context must be normalized across commands to avoid environment-specific behavior.
- Remediation features require defined trust boundaries and change-scope levels.
- AI-assisted reasoning must remain advisory while deterministic artifacts remain the source of truth.
- External tooling integrations must remain isolated behind adapter layers.
- Documentation synchronization is a required part of Playbook governance.
- Performance and token efficiency must guide architecture decisions as Playbook grows.

