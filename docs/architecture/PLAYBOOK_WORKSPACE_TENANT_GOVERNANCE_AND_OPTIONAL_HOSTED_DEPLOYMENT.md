# Playbook Workspace / Tenant Governance + Optional Hosted Deployment Model

## Purpose

This document defines how Playbook coordinates multiple repositories under workspace/tenant governance boundaries while preserving the core product identity:

- CLI-first
- offline-capable
- private-first
- deterministic

It establishes a packaging/deployment model where hosted or self-hosted control planes are optional coordination layers over the same local deterministic runtime.

Pattern: Optional Hosted Layer Over Deterministic Local Core.
Pattern: Workspace Aggregation With Per-Repo Accountability.
Pattern: Policy Inheritance With Local Adoption Authority.
Rule: Deployment model must not change governance semantics.
Rule: Cloud must remain optional.
Rule: Repo-local facts stay local unless explicitly governed for export/aggregation.
Rule: Workspace and tenant views must preserve per-repo evidence drill-down.
Failure Mode: SaaS-first drift that weakens local trust.
Failure Mode: Hosted aggregation without provenance.
Failure Mode: Tenant policy silently overriding repo-local governance without visibility.
Failure Mode: Self-hosted tier receiving weaker guarantees than hosted.
Failure Mode: Cloud control plane becoming the only real product.

## Core doctrine: runtime truth vs coordination packaging

### What remains canonical

- **Playbook Core** remains the deterministic shared runtime.
- **Repositories** remain owners of project-local Playbook state (`.playbook/*`) and local evidence lineage.
- **Session + Evidence** remain the traceable unit-of-work foundation.
- **Control Plane** remains the authority for permissions, mutation scopes, export boundaries, and approvals.

### What is optional

- Governance and coordination capabilities may be provided through:
  - optional hosted control plane deployments, or
  - self-hosted / boundary-controlled deployments.

Hosted deployment is an optional interface/control-plane layer and is **not** the source of truth for core engine semantics.

## Scope hierarchy

Policy and governance reasoning should evaluate scope in this order:

1. user / actor
2. session
3. repository
4. workspace / project group
5. tenant / organization
6. optional upstream/core promotion scope

Each higher scope can constrain lower scopes, but must preserve inspectable provenance and explicit override visibility.

## Workspace model

A workspace is a governed collection of repositories under shared visibility and policy coordination.

Workspace expectations:

- shared dashboards, visibility, and policy views are allowed
- per-repo evidence drill-down remains intact
- workspace summaries are derived views, not replacements for per-repo truth
- aggregated signals must remain provenance-linked to repository/session evidence

A workspace should coordinate repositories; it must not flatten them into an opaque global memory surface.

## Tenant / organization model

Tenant (organization) scope defines shared governance ownership and enterprise control boundaries.

Tenant expectations:

- tenant-level policy ownership and defaults
- org-level permission and RBAC direction
- audit and approval governance surfaces
- clear separation between tenant defaults and repo-local overrides
- compatibility with self-hosted/boundary-controlled operating environments

Tenant governance must be explicit, inspectable, and auditable at repository execution boundaries.

## Policy inheritance and conflict model

Policy should compose through explicit inheritance layers:

1. **core/global defaults**
2. **tenant-level defaults**
3. **workspace-scoped policy**
4. **repo-local policy and local adoption authority**

### Inheritance rules

- Higher scopes may define defaults and restrictions.
- Repo-local scope retains explicit adoption/review authority for local enforcement decisions unless an explicit higher-level restriction contract exists.
- Overrides must be visible with source attribution (which scope set which value).
- Restrictive policy should win over permissive policy when scopes conflict.
- Escalation and exception paths must be explicit and auditable.
- Ambiguous policy scope resolution must fail closed.

### Fail-closed behavior

Execution must fail closed when:

- policy origin is ambiguous
- scope conflict cannot be deterministically resolved
- required approvals for scope/mutation level are missing
- provenance links for policy source or evidence are missing

## Deployment models

### 1) Local-only (no hosted control plane)

- repositories run Playbook locally/CI with no hosted control-plane dependency
- governance and evidence remain repo-local
- optional promotion/export remains explicit opt-in

### 2) Optional hosted Playbook control plane

- hosted layer provides coordination/visibility across repos
- local runtimes still execute deterministic core semantics
- hosted services do not redefine verify/plan/apply trust boundaries

### 3) Self-hosted / boundary-controlled deployment

- same control-plane semantics as hosted model
- deployable in self-hosted, VPC, or boundary-controlled topologies
- no governance-quality downgrade compared to hosted

### 4) Hybrid model

- repo-local runtimes remain local source-of-truth for execution/evidence
- optional control-plane layer provides multi-repo coordination, visibility, and approvals
- sync/export remains explicit and governed

## Invariants across all deployment models

The following must remain constant regardless of packaging model:

- deterministic runtime semantics
- session/evidence contracts
- control-plane approval semantics
- provenance requirements
- repo-local/private-first defaults
- explicit opt-in export/sync only

## Directional hosted/control-plane capabilities

When present, hosted or self-hosted control planes may provide:

- shared repository intelligence views
- multi-repo dashboards
- approval and audit workflows
- policy distribution and inheritance management
- hosted indexing coordination
- optional governance analytics
- control-plane API surfaces
- org/workspace administration

These capabilities are coordination surfaces over one deterministic runtime, not alternate runtime semantics.

## Prohibited hosted behaviors

Hosted/control-plane layers must not:

- silently upload source code by default
- bypass local repo evidence/provenance
- bypass verify/plan/apply trust boundaries
- collapse repo-local knowledge into opaque global memory
- make cloud connectivity mandatory for baseline Playbook usage

## Self-hosted / boundary-controlled requirements

Self-hosted/boundary-controlled deployments require:

- semantic parity with hosted governance behavior
- deployment topology flexibility (self-hosted, VPC, local network)
- no product-logic split where hosted gets stronger governance guarantees
- explicit operational boundaries for:
  - secrets
  - storage
  - indexing
  - policy control

## Layer relationship to existing architecture

This layer extends existing architecture contracts; it does not replace them:

1. Session + Evidence remains the traceable unit-of-work foundation.
2. Control Plane governs permissions, mutation scopes, export, and approval semantics.
3. Multi-Repo Interface/API Surfaces expose governed actions.
4. Cross-Repo Pattern Promotion / Transfer governs reusable knowledge movement.
5. Workspace/Tenant Governance defines multi-repo authority and policy coordination.
6. Optional Hosted Deployment defines operational packaging, not different core semantics.

## Actor and permission direction

Governance should cover these actor classes consistently across CLI/CI/API/UI surfaces:

- individual developer/operator
- reviewer/approver
- workspace maintainer
- tenant/org admin
- automation service account / CI actor
- future AI assistant/agent actor under the same control-plane boundaries

## Audit and observability expectations

Workspace/tenant observability must preserve trust invariants:

- tenant/workspace views preserve per-repo drill-down
- approvals remain auditable
- policy sources and overrides are inspectable
- deployment model does not remove evidence lineage
- hosted analytics remain provenance-linked and policy-aware

## Privacy and locality rules

Default locality posture:

- repo-local facts remain local by default
- export/sync/cloud behavior remains explicit and opt-in
- hosted aggregation should consume governed summaries/artifacts by default, not unrestricted raw repo state
- self-hosted/boundary-controlled deployments retain the same explicit data-flow model

## Architecture alignment references

- `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_GOVERNED_INTERFACE_API_SURFACES_FOR_MULTI_REPO_CONTROL_PLANES.md`
- `docs/architecture/PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md`
- `docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`
- `docs/CONSUMER_INTEGRATION_CONTRACT.md`
