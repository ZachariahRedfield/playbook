# Playbook Final Architecture Map and Canonical Dependency Index

## Purpose

This document is the single high-signal map for Playbook architecture slices. It is a dependency index and navigation layer, not a second roadmap.

## Docs summary labels

- Pattern: One Canonical Architecture Map
- Pattern: Dependency-Ordered Architecture
- Pattern: Trust Chain Before Automation Scale
- Rule: Architecture slices must map back to one dependency index
- Rule: Product overlays do not redefine runtime truth
- Rule: Learning and transfer layers depend on session evidence, review, and provenance
- Failure Mode: Architecture slice sprawl without a dependency index
- Failure Mode: Product/packaging layers mistaken for runtime layers
- Failure Mode: Hosted/control-plane expansion obscuring the local trust model

## Status legend

- **implemented baseline**: exists in the current deterministic runtime path
- **architecture-defined**: defined contract and dependency role, still hardening/expanding
- **future-facing**: planned layer after prior trust and governance dependencies are proven
- **roadmap/planned**: rollout, deployment, and product overlays built on prior layers

## Canonical dependency-ordered layer stack

| # | Layer | Depends on | Status |
| --- | --- | --- | --- |
| 1 | Deterministic Core Runtime | None | implemented baseline |
| 2 | Repository Intelligence Substrate | Deterministic Core Runtime | implemented baseline |
| 3 | Repository Knowledge Graph | Repository Intelligence Substrate | implemented baseline |
| 4 | Context Compression Layer | Repository Intelligence Substrate, Repository Knowledge Graph | architecture-defined |
| 5 | Read Runtime (`index/query/explain/ask`) | Repository Intelligence Substrate, Context Compression Layer | implemented baseline |
| 6 | Change Runtime (`verify/plan/apply`) | Deterministic Core Runtime, Read Runtime | implemented baseline |
| 7 | Risk-Aware Execution | Change Runtime | implemented baseline |
| 8 | AI Repository Contract (`ai-context/ai-contract`) | Read Runtime, Change Runtime | implemented baseline |
| 9 | Session + Evidence | Read Runtime, Change Runtime, Risk-Aware Execution | architecture-defined |
| 10 | Control Plane | Session + Evidence, Risk-Aware Execution | architecture-defined |
| 11 | PR Review Loop | Change Runtime, Session + Evidence, Control Plane | architecture-defined |
| 12 | Repo Longitudinal State + Knowledge Promotion | Session + Evidence, PR Review Loop | architecture-defined |
| 13 | Knowledge Query / Inspection Surfaces | Repo Longitudinal State + Knowledge Promotion | architecture-defined |
| 14 | Automation Synthesis (governed knowledge consumption) | Knowledge Query / Inspection Surfaces, Risk-Aware Execution | future-facing |
| 15 | Outcome Feedback + Automation Runtime Learning | Automation Synthesis, Session + Evidence, PR Review Loop | future-facing |
| 16 | Governed Cross-Repo Pattern Promotion / Transfer | Repo Longitudinal State + Knowledge Promotion, Outcome Feedback + Automation Runtime Learning | roadmap/planned |
| 17 | Governed Interface / API Surfaces | Control Plane, Governed Cross-Repo Pattern Promotion / Transfer | roadmap/planned |
| 18 | Workspace / Tenant Governance + Optional Hosted Deployment | Governed Interface / API Surfaces, Control Plane | roadmap/planned |
| 19 | Packaging / Product Overlays (Open Core -> Team -> Enterprise) | Workspace / Tenant Governance + Optional Hosted Deployment | roadmap/planned |
| 20 | Metrics / ROI / Proof-of-Value | Packaging / Product Overlays, Session + Evidence | roadmap/planned |
| 21 | Pilot / Design-Partner / Rollout | Metrics / ROI / Proof-of-Value, Packaging / Product Overlays, Workspace / Tenant Governance + Optional Hosted Deployment | roadmap/planned |

## Canonical trust chain

`observe -> session evidence -> policy -> review -> knowledge promotion -> automation -> outcomes -> runtime learning -> governed transfer`

Trust rule: each layer may consume only governed outputs from upstream dependencies.

## Canonical scope chain

`local repo -> workspace -> tenant/org -> optional upstream/core promotion`

Scope rule: repository-local evidence is the runtime source of truth; workspace/tenant/hosted layers coordinate but do not replace repo truth.

## Roadmap alignment

- Dependency order is defined in this architecture map.
- Commitment posture and sequencing language are defined in `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.
- Rollout maturity language must remain aligned with `read-only -> verify-only -> low-risk plan/apply -> PR/CI -> workspace/team governance -> org/tenant governance`.

## Canonical architecture navigation index (linked once per major slice)

### Foundations and runtime trust

- [Playbook Platform Architecture (Long-Term)](./PLAYBOOK_PLATFORM_ARCHITECTURE.md)
- [Playbook Session + Evidence Architecture](./PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md)
- [Playbook Control Plane Architecture](./PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md)
- [Playbook PR Review Loop Architecture](./PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md)

### Knowledge and learning pipeline

- [Playbook Repo Longitudinal State + Knowledge Promotion Architecture](./PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md)
- [Playbook Knowledge Query and Inspection Surfaces Architecture](./PLAYBOOK_KNOWLEDGE_QUERY_AND_INSPECTION_SURFACES.md)
- [Playbook Automation Synthesis Governed Knowledge Consumption Architecture](./PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md)
- [Playbook Outcome Feedback and Automation Runtime Learning Architecture](./PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md)
- [Playbook Governed Cross-Repo Pattern Promotion and Transfer Architecture](./PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md)

### Control-plane interfaces and deployment scope

- [Playbook Governed Interface / API Surfaces for Multi-Repo Control Planes](./PLAYBOOK_GOVERNED_INTERFACE_API_SURFACES_FOR_MULTI_REPO_CONTROL_PLANES.md)
- [Playbook Workspace / Tenant Governance + Optional Hosted Deployment Model](./PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md)

### Product overlays and rollout

- [Playbook Packaging and SKU Architecture: Open Core to Team to Enterprise](./PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md)
- [Playbook Metrics / ROI / Proof-of-Value Architecture](./PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md)
- [Playbook Pilot / Design-Partner / Rollout Architecture](./PLAYBOOK_PILOT_DESIGN_PARTNER_AND_ROLLOUT_ARCHITECTURE.md)

## Governance note

This document is the canonical architecture dependency index. Architecture slices remain the semantic source for their domain details.
