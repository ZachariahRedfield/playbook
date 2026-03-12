# Playbook Packaging and SKU Architecture: Open Core to Team to Enterprise

## Purpose

This document defines the canonical Packaging / SKU Architecture for Playbook.

It ensures packaging follows the existing deterministic architecture and governance model so Open Core, Team, and Enterprise remain one product with one runtime truth.

Pattern: Packaging Follows Architecture.
Pattern: Open Core for Trust, Paid Layers for Coordination and Governance.
Pattern: Same Runtime, Different Operational Surfaces.
Rule: SKU boundaries must not change core runtime semantics.
Rule: Cloud must remain optional.
Rule: Paid packaging monetizes coordination and governance scale, not basic deterministic trust.
Rule: Enterprise deployment choice must preserve the same governance semantics.
Failure Mode: Cloud-first fork of the product.
Failure Mode: Free tier too weak to prove deterministic value.
Failure Mode: SKU-specific truth models.
Failure Mode: Monetizing trust primitives instead of monetizing coordination pain.
Failure Mode: Hosted product becoming the only real product.

## Core doctrine

Playbook packaging must follow architecture, not redefine it.

- **Playbook Core** remains the deterministic shared runtime across all SKUs.
- **Repo-local/project-local Playbook state** (`.playbook/*`) remains foundational.
- **Paid layers** package coordination, governance, deployment, and operational trust surfaces around the same runtime.
- **Deployment model and SKU** must never redefine engine semantics.

Canonical runtime doctrine:

`same runtime -> same verify trust boundary -> same session/evidence provenance -> different coordination/operations packaging by SKU`

## Canonical SKU ladder

1. **Open Core / Free**
2. **Team**
3. **Enterprise**

## Open Core / Free

Open Core is the trust and activation surface that proves deterministic value locally.

Includes:

- local deterministic CLI workflows (`context/query/explain/verify/plan/apply`)
- core repository intelligence + governance + safe remediation loop
- core docs/governance scaffolding and alignment workflows
- single-repo or local-first adoption surface
- no cloud requirement; local/offline usage remains first-class

Open Core is optimized for habit formation, trust, and activation. It must remain strong enough to demonstrate real deterministic value without requiring hosted coordination layers.

## Team

Team packages shared coordination over multiple repositories and collaborators while preserving per-repo ownership and deterministic runtime truth.

Includes directional team surfaces:

- hosted/shared coordination layer over multiple repos and collaborators
- shared repository intelligence views
- team policies and shared rulesets
- pull request annotations/checks
- remediation history and change tracking
- multi-repo visibility and dashboards
- team reporting and governance analytics direction
- per-repo evidence drill-down and local ownership boundary preservation

Team is where monetization begins by reducing coordination pain and increasing governance reliability at team scale.

## Enterprise

Enterprise packages organization-grade governance, deployment controls, and operational trust guarantees over the same deterministic runtime.

Includes directional enterprise surfaces:

- org/tenant governance
- SSO/RBAC direction
- audit logs and approval controls
- compliance/policy packs
- self-hosted / VPC / boundary-controlled deployment options
- rollout/governance onboarding/support packaging
- stronger operational guarantees without changing engine truth

Enterprise value is governance depth, auditability, and boundary-controlled operations, not alternate runtime semantics.

## SKU-to-architecture mapping

- **Open Core** maps primarily to Playbook CLI + deterministic local runtime.
- **Team** maps to governance/control-plane coordination and optional hosted surfaces.
- **Enterprise** maps to tenant governance, deployment choice, auditability, and enterprise trust requirements.
- **All SKUs** route through the same session/evidence/control-plane semantics.

Architecture dependency references:

- `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_GOVERNED_INTERFACE_API_SURFACES_FOR_MULTI_REPO_CONTROL_PLANES.md`
- `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`

## Cross-SKU invariants (must stay consistent)

The following are non-negotiable across Open Core, Team, and Enterprise:

- deterministic reasoning/runtime semantics
- `verify` as canonical trust boundary
- session/evidence provenance expectations
- private-first and explicit opt-in export principles
- per-repo local ownership and project-local state
- thin interfaces over one canonical runtime

If a packaging decision violates these invariants, packaging is wrong.

## What remains core vs what is monetized

### Core (must remain shared and usable locally)

- deterministic local CLI/runtime
- core repository intelligence
- core governance verification
- core safe remediation workflow

### Team/Enterprise monetization surfaces

- coordination
- shared visibility
- governance workflows
- approvals/auditability
- hosted control-plane packaging
- enterprise deployment and trust controls

Monetization should scale with organizational coordination and governance complexity, not by degrading baseline deterministic trust.

## Anti-patterns to avoid

- Crippling the free/open product so it no longer proves deterministic value.
- Making cloud the real product and CLI a thin teaser.
- Introducing SKU-specific engine semantics.
- Hiding provenance/auditability behind enterprise-only “truth”.
- Monetizing basic trust primitives instead of monetizing coordination/governance scale.
- Forcing source upload or hidden telemetry for paid packaging.

## Packaging boundaries and deployment models

- Local-only operation remains valid regardless of SKU strategy.
- Team may use hosted coordination surfaces.
- Enterprise may use hosted or self-hosted/boundary-controlled deployment.
- Deployment choice affects operational packaging, not core governance semantics.

Deployment references:

- `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`
- `docs/CONSUMER_INTEGRATION_CONTRACT.md`

## Expected upgrade path

1. **Solo/Open adoption** proves local deterministic value.
2. **Team upgrade** occurs when coordination pain and multi-repo governance emerge.
3. **Enterprise upgrade** occurs when auditability, approvals, RBAC, compliance, and deployment boundaries matter.

Services can support early discovery and onboarding but must not become the primary product moat.

## Product identity guardrails

- Do not reposition Playbook as a generic AI coding assistant product.
- Do not weaken CLI-first, offline-capable, or private-first principles.
- Do not introduce hidden telemetry, automatic source upload, or cloud-required behavior.
- Do not present Team/Enterprise as different core engines.
- Do not collapse per-repo boundaries in the name of packaging simplicity.
