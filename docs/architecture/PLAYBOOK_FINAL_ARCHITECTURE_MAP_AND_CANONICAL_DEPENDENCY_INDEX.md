# Playbook Final Architecture Map and Canonical Dependency Index

## Purpose

This document is the canonical system map for how Playbook fits together across architecture slices, roadmap layers, trust boundaries, and product/deployment surfaces.

It provides:

- one canonical map of the full system view,
- one dependency-ordered architecture index,
- one navigation surface across existing architecture docs,
- one explicit distinction between foundational runtime truth, dependent layers, and future-facing layers.

## Docs summary labels

- Pattern: One Canonical Architecture Map
- Pattern: Dependency-Ordered Architecture
- Pattern: Trust Chain Before Automation Scale
- Pattern: Product Layers Over One Runtime
- Rule: Architecture slices must map back to one dependency index
- Rule: Product overlays must not redefine runtime truth
- Rule: Learning and transfer layers depend on evidence, review, and provenance
- Failure Mode: Architecture slice sprawl without a canonical map
- Failure Mode: Different docs implying different dependency order
- Failure Mode: Product/packaging layers being mistaken for runtime layers
- Failure Mode: Hosted/control-plane expansion obscuring the local trust model

## Canonical dependency-ordered architecture stack

| # | Layer | Purpose | Depends on | Enables | Trust boundary / governance role | Scope | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Deterministic Core Runtime | Canonical runtime semantics for deterministic repo operations. | None | All higher layers. | Root runtime truth and deterministic command contracts. | Local (repo) | implemented baseline |
| 2 | Repository Intelligence Substrate | Deterministic repo indexing and structured intelligence artifacts. | Deterministic Core Runtime | Query/explain/read and dependency reasoning. | Evidence generation boundary for repository facts. | Local (repo) | implemented baseline |
| 3 | Repository Knowledge Graph | Graph representation of modules, relations, and architectural edges. | Repository Intelligence Substrate | Explain/query impact and architecture reasoning surfaces. | Structured provenance for relationships. | Local (repo) with governed promotion potential | implemented baseline |
| 4 | Context Compression Layer | Deterministic context shaping for agent/operator consumption. | Repository Intelligence Substrate, Repository Knowledge Graph | High-signal read and planning context. | Prevents noisy/ungoverned context expansion. | Local (repo) | architecture-defined |
| 5 | Read Runtime | Deterministic inspect/query/explain path before mutation. | Repository Intelligence Substrate, Context Compression Layer | Safe operator and AI understanding loop. | Read-first trust gate. | Local (repo) | implemented baseline |
| 6 | Change Runtime | Deterministic verify/plan/apply mutation flow. | Deterministic Core Runtime, Read Runtime | Governed remediation and bounded changes. | Mutation boundary and contract enforcement. | Local (repo) | implemented baseline |
| 7 | Risk-Aware Execution | Risk classification, guardrails, and fail-closed behavior around changes. | Change Runtime | Safe automation eligibility and escalation paths. | Risk policy boundary before mutation execution. | Local (repo) | implemented baseline |
| 8 | AI Repository Contract | Canonical AI bootstrap/contract surface for deterministic operation. | Read Runtime, Change Runtime | Playbook-aware AI workflows with explicit contracts. | Prevents agent drift and ad-hoc inference. | Local (repo) | implemented baseline |
| 9 | Session + Evidence | Session envelope and evidence/provenance model for actions and outcomes. | Read Runtime, Change Runtime, Risk-Aware Execution | Review, learning, and control-plane readiness. | Evidence-before-memory trust boundary. | Local first, promotable | architecture-defined |
| 10 | Control Plane | Policy orchestration over deterministic runtime/evidence contracts. | Session + Evidence, Risk-Aware Execution | Multi-surface governance and coordination. | Policy enforcement over evidence. | Shared/workspace-oriented over local runtime truth | architecture-defined |
| 11 | PR Review Loop | Deterministic PR review and re-verification loop over evidence artifacts. | Change Runtime, Session + Evidence, Control Plane | Human-in-loop governance and merge confidence. | Review gate before merge/promotion. | Local + shared review surfaces | architecture-defined |
| 12 | Repo Longitudinal State + Knowledge Promotion | Governed repository memory over time with promotion/retirement lifecycle. | Session + Evidence, PR Review Loop | Reusable promoted knowledge and longitudinal learning. | Promotion and provenance governance. | Local first | architecture-defined |
| 13 | Knowledge Query / Inspection Surfaces | Deterministic inspection of memory/promoted knowledge with provenance. | Repo Longitudinal State + Knowledge Promotion | Trusted consumption by humans/agents/automation. | Inspectability boundary before synthesis. | Local first, optionally shared views | architecture-defined |
| 14 | Automation Synthesis (governed/promoted knowledge consumption) | Build automation from governed, inspectable knowledge only. | Knowledge Query / Inspection Surfaces, Risk-Aware Execution | Higher-scale deterministic automation. | Blocks opaque/unreviewed memory consumption. | Local first, policy-governed | future-facing |
| 15 | Outcome Feedback + Automation Runtime Learning | Feed execution outcomes back into governed learning loops. | Automation Synthesis, Session + Evidence, PR Review Loop | Better automation quality and safer iteration. | Outcome evidence required for learning claims. | Local first, promotable | future-facing |
| 16 | Governed Cross-Repo Pattern Promotion / Transfer | Promote proven patterns across repos under governance. | Repo Longitudinal State + Knowledge Promotion, Outcome Feedback + Automation Runtime Learning | Multi-repo reuse without losing trust. | Local promotion precedes cross-repo transfer. | Shared (cross-repo) via governed export | roadmap/planned |
| 17 | Governed Interface / API Surfaces for Multi-Repo Control Planes | Explicit APIs/interfaces for governed multi-repo orchestration. | Control Plane, Governed Cross-Repo Pattern Promotion / Transfer | External orchestration and integrations. | Interface policy/provenance contracts. | Shared (workspace/org) | roadmap/planned |
| 18 | Workspace / Tenant Governance + Optional Hosted Deployment Model | Workspace/tenant coordination and optional hosted operation over same runtime truth. | Governed Interface / API Surfaces for Multi-Repo Control Planes, Control Plane | Org-scale governance and deployment choices. | Deployment cannot alter governance semantics. | Shared workspace/tenant; optional hosted | roadmap/planned |
| 19 | Packaging / SKU Architecture | Open Core -> Team -> Enterprise product packaging over one runtime. | Workspace / Tenant Governance + Optional Hosted Deployment Model | Commercial packaging and adoption ladder. | Product boundary (not runtime truth boundary). | Product/commercial overlay | roadmap/planned |
| 20 | Metrics / ROI / Proof-of-Value Architecture | Deterministic value measurement across trust/governance/adoption outcomes. | Packaging / SKU Architecture, Session + Evidence | Evidence-backed product and rollout decisions. | Evidence-linked claims boundary. | Cross-scope reporting overlay | roadmap/planned |
| 21 | Pilot / Design-Partner / Rollout Architecture | Staged rollout doctrine from local trust to org-scale readiness. | Metrics / ROI / Proof-of-Value Architecture, Packaging / SKU Architecture, Workspace / Tenant Governance + Optional Hosted Deployment Model | Controlled adoption sequencing. | Trust-maturity gates for expansion. | Cross-scope rollout overlay | roadmap/planned |

## Roadmap sequencing cross-link

For implementation sequencing posture (`implemented baseline`, `active hardening`, `build now`, `build later`, `product overlays`), see `docs/PLAYBOOK_PRODUCT_ROADMAP.md` (Final roadmap contract alignment section).

Rule: This architecture map defines dependency order; strategic roadmap + ROADMAP contract define commitment and execution posture.

## Canonical dependency assertions

- Read runtime depends on repository intelligence + context compression.
- Change runtime depends on deterministic contracts, risk boundaries, and explicit mutation scope.
- Agentic/automation layers depend on session/evidence and control-plane policy boundaries.
- Learning layers depend on evidence, review outcomes, and provenance-preserving promotion.
- Cross-repo transfer depends on governed local promotion first.
- Workspace/hosted layers depend on the same local-core semantics rather than alternate runtime behavior.
- Packaging and metrics are product overlays, not alternate runtime truths.

## Canonical trust chain

`observe -> evidence -> policy -> review -> knowledge -> automation -> outcomes -> learning -> governed transfer`

Trust rule: each step may consume only governed outputs from the previous step, never bypassing evidence/provenance boundaries.

## Canonical scope chain

`local repo -> workspace -> tenant/org -> optional upstream/core promotion`

Boundary rules:

- Local repo boundary: source-of-truth evidence, rules, and mutation history originate here.
- Workspace boundary: aggregates views/policies while preserving per-repo evidence drill-down.
- Tenant/org boundary: coordinates policy and governance posture across workspaces.
- Optional upstream/core promotion boundary: only promoted, provenance-linked, governance-approved patterns/contracts may cross.

## Canonical surface model

- Core runtime: deterministic engine semantics and command contracts.
- CLI surfaces: local/offline operator and AI invocation path.
- CI surfaces: deterministic validation, policy gating, and regression checks.
- Review surfaces: PR intelligence and evidence-attached review loops.
- API/control-plane surfaces: governed orchestration for multi-repo and integrations.
- Hosted/self-hosted operational surfaces: optional deployment/coordination packaging over the same runtime semantics.
- Product/packaging/commercial overlays: SKU, GTM, and value framing layers over one runtime truth.

## What Playbook is not

- Not a generic autonomous coding bot.
- Not a cloud-required shell around repositories.
- Not an opaque global-memory platform.
- Not a fork-per-repo architecture.
- Not a chat-memory-first system.

## Canonical architecture navigation index

### Runtime foundations

- [Playbook Platform Architecture (Long-Term)](./PLAYBOOK_PLATFORM_ARCHITECTURE.md)
- [Playbook Session + Evidence Architecture](./PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md)
- [Playbook Control Plane Architecture](./PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md)
- [Playbook PR Review Loop Architecture](./PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md)

### Trust / governance

- [Playbook Workspace / Tenant Governance + Optional Hosted Deployment Model](./PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md)
- [Playbook Governed Interface / API Surfaces for Multi-Repo Control Planes](./PLAYBOOK_GOVERNED_INTERFACE_API_SURFACES_FOR_MULTI_REPO_CONTROL_PLANES.md)

### Learning / knowledge

- [Playbook Repo Longitudinal State + Knowledge Promotion Architecture](./PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md)
- [Playbook Knowledge Query and Inspection Surfaces Architecture](./PLAYBOOK_KNOWLEDGE_QUERY_AND_INSPECTION_SURFACES.md)
- [Playbook Automation Synthesis Governed Knowledge Consumption Architecture](./PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md)
- [Playbook Outcome Feedback and Automation Runtime Learning Architecture](./PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md)
- [Playbook Governed Cross-Repo Pattern Promotion and Transfer Architecture](./PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md)

### Cross-repo / platform rollout

- [Playbook Pilot / Design-Partner / Rollout Architecture](./PLAYBOOK_PILOT_DESIGN_PARTNER_AND_ROLLOUT_ARCHITECTURE.md)

### Product / business architecture

- [Playbook Packaging and SKU Architecture: Open Core to Team to Enterprise](./PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md)
- [Playbook Metrics / ROI / Proof-of-Value Architecture](./PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md)

## Governance notes

- This document is the single canonical dependency index and navigation layer; architecture slices remain the semantic source for their own domain.
- New architecture slices must be dependency-mapped here in the same change (or immediately after) to prevent architecture-map drift.
