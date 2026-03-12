# Playbook Pilot / Design-Partner / Rollout Architecture

## Purpose

This document defines Playbook's canonical rollout doctrine from first local repository activation through team/workspace governance and enterprise-style deployment/governance readiness.

This is product architecture, not ad hoc GTM guidance.

Document role in the broader product story:

- Product roadmap owns strategic direction and commitment posture: `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.
- Business strategy owns GTM/commercial sequencing: `docs/PLAYBOOK_BUSINESS_STRATEGY.md`.
- Packaging architecture owns SKU boundaries by trust maturity: `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`.
- Metrics architecture owns proof-of-value measurement: `docs/architecture/PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md`.
- This document owns trust-maturity rollout sequencing and stage gates.

Rollout reference alignment:

- Consumer integration contract: `docs/CONSUMER_INTEGRATION_CONTRACT.md`
- Metrics and ROI architecture: `docs/architecture/PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md`
- Packaging and SKU architecture: `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`
- Workspace and tenant governance architecture: `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`

## Core doctrine

- Rollout follows trust maturity, not installation speed.
- Adoption begins with deterministic read/runtime proof before broad mutation workflows.
- Design partners are used to discover repeatable product truth, not to create custom one-off consulting forks.
- Rollout phases map to architecture/control-plane maturity so each expansion layer preserves CLI-first, offline-capable, private-first guarantees.

## Doctrine labels (summary)

- Pattern: Rollout Follows Trust Maturity
- Pattern: Design Partners Discover Product Truth, Not Product Forks
- Pattern: Start Read-Only, Expand by Evidence
- Rule: Mutation follows trust, not curiosity
- Rule: Pilot success requires deterministic evidence, not anecdotal excitement
- Rule: Expansion gates must be explicit
- Rule: Reusable insights from pilots should strengthen shared core
- Failure Mode: Mutation-first rollout
- Failure Mode: Consulting detours that bypass the product
- Failure Mode: Team rollout before repo-level trust exists
- Failure Mode: Pilot excitement mistaken for proof-of-value
- Failure Mode: Cloud-first rollout pressure weakening local trust

## Canonical rollout stages

### Stage 0: qualification / fit assessment

Confirm candidate fit, pain profile, and maturity lane (solo, team, governance-sensitive).

### Stage 1: local bootstrap / read-only intelligence

Use local deterministic read/intelligence commands (`context`, `ai-context`, `index`, `query`, `explain`) to prove repo understanding quality before mutation.

### Stage 2: verify-only governance baseline

Run `verify` repeatedly to establish findings quality, trust in deterministic contracts, and baseline governance drift evidence.

### Stage 3: low-risk plan/apply pilot

Enable `plan` + `apply` on low-risk branches with explicit human review and post-apply `verify` closure.

### Stage 4: PR / CI rollout

Adopt `analyze-pr` + CI gating with deterministic evidence lineage and policy-bound mutation controls.

### Stage 5: workspace/team governance rollout

Expand into shared rulesets, coordination, and cross-repo governance views while preserving per-repo local evidence boundaries.

### Stage 6: org/tenant / enterprise governance rollout

Introduce tenant/org governance controls, approvals, auditability, and optional hosted/self-hosted deployment packaging over the same deterministic runtime semantics.

## Design-partner goals

Design-partner programs must produce reusable product truth:

- validate repository-understanding quality (`index/query/explain`) on real repositories
- validate trust in the `verify -> plan -> apply -> verify` loop under bounded conditions
- measure proof-of-value from deterministic evidence, not anecdotal sentiment
- identify reusable patterns vs repository-specific exceptions
- refine onboarding and rollout trigger criteria
- avoid bespoke custom work that breaks shared-core direction

## Qualification criteria for pilot candidates

A candidate should satisfy most of the following:

- serious repository with recurring architecture/governance pain
- willingness to run deterministic workflows repeatedly (not one-time demos)
- enough complexity to prove repository-intelligence value
- openness to evidence-backed feedback and phased rollout discipline
- fit for at least one lane: solo, team, or governance-sensitive

## Canonical pilot scopes

### Single-repo solo pilot

Focus on local activation, verify trust, low-risk remediation, and operator habit formation.

### Small-team multi-repo coordination pilot

Focus on repeated per-repo trust baselines plus shared standards and cross-repo coordination outcomes.

### Governance-sensitive / high-control pilot

Focus on approval boundaries, evidence traceability, and policy-controlled mutation workflows.

### External consumer-repo pilot

Focus on downstream integration quality while preserving shared-core + project-local state semantics.

### Internal product hardening pilot

Focus on tightening contracts, reducing ambiguity, and promoting reusable improvements upstream.

## Rollout proof model

Each stage collects deterministic proof artifacts before expansion.

- Activation proof: first useful local read/intelligence + verify outcomes in bounded time.
- Trust proof: repeatable verify quality and accepted remediation proposals with post-mutation verification closure.
- Governance proof: measurable drift/finding trends and policy-compliant remediation behavior.
- Coordination proof: team/workspace-level consistency improvements without losing per-repo provenance.
- ROI/proof-of-value proof: baseline vs after deterministic outcomes with explicit attribution and evidence links.
- Enterprise deployment/governance readiness proof: tenant/org controls, approvals, and auditability readiness without cloud-required rollout assumptions.

## Stage gates and expansion triggers

### Read-only -> verify-only

Must be true:

- operators can interpret repo shape/rules via read-only outputs
- command outputs are deterministic enough for repeat runs
- baseline privacy expectations (local/private-first) are explicitly understood

### Verify-only -> low-risk plan/apply pilot

Must be true:

- verify findings quality is trusted and repeatable
- baseline findings categories and risk boundaries are understood
- low-risk branch scope and review ownership are defined
- post-apply re-verification is treated as mandatory

### Apply pilot -> PR/CI rollout

Must be true:

- low-risk apply outcomes are stable and explainable
- remediation proposals are reviewed with evidence lineage
- CI/PR policies are ready to enforce deterministic checks

### Repo pilot -> team/workspace rollout

Must be true:

- repo-level trust boundary is established on active repositories
- reusable shared rules/patterns are identified and documented
- team coordination pain/benefit is proven with deterministic evidence

### Team/workspace -> enterprise governance/deployment rollout

Must be true:

- governance controls, approvals, and auditability are required and scoped
- packaging/deployment posture (open/team/enterprise + optional hosted/self-hosted) is explicit
- rollout preserves local/private-first trust and per-repo ownership boundaries

## Required pilot artifacts and evidence

Each pilot should produce a deterministic evidence bundle:

- baseline repository state and pain profile
- deterministic command artifacts (for example `.playbook/*`, verify/plan/apply outputs)
- trust and acceptance observations tied to concrete runs
- findings trend over time
- remediation outcomes and post-verify results
- stage-gate and rollout decisions with rationale
- reusable pattern captures
- product gaps promoted upstream
- final pilot proof-of-value summary with baseline/after attribution

## Relationship to existing architecture and docs

- Consumer Integration Contract defines downstream repo rollout boundaries and shared-core + project-local state semantics.
- Metrics / ROI Architecture defines value/trust/governance measurement contracts.
- Packaging / SKU Architecture defines when value maps to Open Core, Team, and Enterprise surfaces.
- Workspace / Tenant Governance Architecture defines later-stage expansion and deployment/governance shape.
- Pilot outputs must feed roadmap/backlog prioritization and shared product evolution rather than bespoke forks.

## Anti-patterns to avoid

- mutation-first rollout without a trust baseline
- consulting detours that bypass shared-core product strengthening
- pilot success measured by excitement without deterministic evidence
- cloud-first rollout pressure that weakens local/private-first posture
- team/enterprise rollout before repository-level trust is established

## Canonical operating sequence

Rollout progression should respect deterministic operating ladders:

`read/runtime proof -> verify baseline -> low-risk plan/apply -> PR/CI -> team/workspace governance -> enterprise governance/deployment readiness`

This sequence ensures expansion follows evidence and trust boundaries rather than anecdotal momentum.
