# Playbook Automation Synthesis Governed Knowledge Consumption Architecture

## Purpose

This document defines Automation Synthesis as a downstream architecture slice that may only consume governed, inspectable, provenance-linked knowledge.

Automation Synthesis is a future controlled expansion layered on top of deterministic repository intelligence, session/evidence contracts, control-plane policy, PR review-loop evidence, longitudinal knowledge promotion, and knowledge query/inspection surfaces.

This architecture is directional and contract-oriented. It does **not** permit broad autonomous execution, opaque memory-driven synthesis, or policy bypass.

## Docs summary labels

- Pattern: Governed Knowledge Before Automation
- Pattern: Inspectable Knowledge as Synthesis Input
- Pattern: Provenance-Linked Automation Generation
- Rule: Automation Synthesis may only consume governed/promoted knowledge
- Rule: Candidate knowledge is not automation-grade input
- Rule: Verification remains the trust boundary
- Rule: Repo-local knowledge stays local unless intentionally promoted
- Failure Mode: Automation synthesized from raw chat memory
- Failure Mode: Candidate knowledge operationalized before review
- Failure Mode: Provenance-free automation generation
- Failure Mode: Cross-repo leakage through synthesis context
- Failure Mode: Automation consumes stale or superseded knowledge

## Core rule

Automation Synthesis may only consume governed, inspectable, provenance-linked knowledge inputs.

Phase 15 contract boundary: the first implementation slice is **suggestion synthesis only**.

- allowed: deterministic generation of candidate suggestions/packages for human review
- disallowed: autonomous repository mutation, autonomous execution, autonomous deployment, or hidden background mutation loops

Automation Synthesis must not rely on:

- raw chat history
- opaque prompt memory
- unreviewed candidate knowledge
- undocumented ad-hoc repository inference

## Allowed synthesis input classes

Automation synthesis context may include only policy-allowed, inspectable inputs such as:

1. promoted governance knowledge
2. approved reusable patterns
3. approved rule/doctrine/invariant artifacts
4. validated repository intelligence artifacts
5. approved trigger taxonomy
6. policy-approved templates
7. session/evidence references where provenance is preserved and the referenced knowledge is promoted/reviewed
8. inspectable repo-local longitudinal knowledge that remains within policy boundaries and review status requirements

All inputs must preserve source lineage (artifact IDs, command lineage, session references, promotion/review status, and freshness state).

## Disallowed or restricted synthesis inputs

Disallowed by default:

- raw conversation transcripts as direct execution context
- candidate knowledge awaiting review
- stale/superseded knowledge without explicit override
- evidence-free inferred rules
- repo-local sensitive knowledge for upstream/global synthesis unless explicitly approved

Hard disallow for Phase 15:

- raw evidence artifacts as direct automation-grade synthesis input
- unreviewed candidate knowledge artifacts as direct automation-grade synthesis input
- autonomous mutation plans generated without explicit human review and existing `verify -> plan -> apply` gates

Restricted use rule:

- Any override path (for example stale-knowledge exception handling) must be explicit, policy-approved, and audit-linked to a deterministic approval record.

## Downstream governed synthesis pipeline

Canonical future synthesis flow (target state):

1. **Trigger ingestion**
2. **Governed knowledge lookup**
3. **Template/pattern family selection**
4. **Bounded context package generation**
5. **Candidate suggestion generation**
6. **Sandbox verification**
7. **Policy/approval gate**
8. **Controlled deployment/orchestration**
9. **Runtime monitoring / rollback**
10. **Outcome evidence back into longitudinal memory**

Trust boundary rules for this flow:

- Generated automations are untrusted until sandbox verification succeeds.
- Verification remains the trust boundary.
- Ambiguous or incomplete verification fails closed.
- Synthesis cannot bypass `verify -> plan -> apply` for repository mutations.
- Deployment/orchestration remains adapter-bounded and policy-controlled.

Phase 15 thin-slice execution rule:

- implement up to bounded candidate suggestion generation and policy-ready packaging only
- defer autonomous deployment/orchestration behavior to later phases

## Role of knowledge query and inspection surfaces

Automation synthesis is downstream of inspection surfaces and must only consume inspectable knowledge.

Required constraints:

- provenance must be traceable before operationalization
- candidate vs promoted knowledge must remain distinguishable
- humans must be able to inspect which knowledge informed generated automation
- synthesis context packages must expose evidence and knowledge lineage for audit/replay

Inspection surfaces are read-runtime preconditions; they do not imply automatic execution authority.

## Relationship to existing architecture layers

Automation Synthesis consumes upstream governed layers in this order:

- **Session + Evidence** provides the raw traceable substrate.
- **Control Plane** governs access, mutation, deployment, and export rules.
- **PR Review Loop** provides recurring review-derived evidence and prevention targets.
- **Repo Longitudinal State + Knowledge Promotion** governs durable learning.
- **Knowledge Query / Inspection Surfaces** make governed knowledge readable.
- **Automation Synthesis** consumes these governed artifacts downstream.

Recommended dependency ladder:

`deterministic runtime -> session/evidence -> control plane -> PR review loop -> repo longitudinal state / knowledge promotion -> knowledge query / inspection surfaces -> automation synthesis consuming governed/promoted knowledge -> later broader orchestration / interface expansion`

## Template/pattern system expectations

Template and pattern-family contracts for synthesis should enforce:

- template selection binds to approved pattern families
- templates declare required input knowledge classes
- templates require policy metadata, rollback metadata, and evidence references
- generated outputs attach knowledge/evidence lineage used during synthesis

Template contracts should fail closed when required knowledge classes are missing, stale, unapproved, or non-inspectable.

## Policy gates, provenance, rollback, and accountability hooks

All synthesis outputs must be policy-gated and traceable before any operational usage path.

Required gate/hook contracts:

- **Policy gate metadata**: actor, authority source, requested action class, and explicit allow/deny decision record.
- **Knowledge provenance envelope**: knowledge IDs, source artifact paths, promotion status, fingerprints, and freshness timestamps.
- **Suggestion accountability envelope**: synthesis run ID, template/pattern family ID, and reviewer-facing rationale.
- **Rollback/deactivation hooks**: required rollback path metadata must be attached even for suggestion-only outputs.
- **Audit replayability**: outputs must retain enough lineage to replay why a suggestion existed and who approved/denied downstream use.

Rule: no synthesis output may be treated as execution-authoritative without policy decision records and provenance completeness.
Rule: rollback/deactivation metadata is required contract surface, not an optional operational add-on.

## Locality and privacy boundaries

Automation synthesis inherits Playbook privacy and locality rules:

- repo-local knowledge remains local by default
- reusable promoted patterns may be intentionally shared/promoted upstream
- no hidden telemetry
- no automatic upstream sync
- synthesis for one repository must not implicitly leak repo-local knowledge into cross-repo automation generation

Cross-repo synthesis requires explicit governance paths over sanitized, intentionally promoted reusable patterns.

## Guardrails and non-goals

- Do not reposition Playbook as a general autonomous coding agent.
- Do not permit synthesis from unreviewed or opaque memory.
- Do not bypass Control Plane, approvals, or verification.
- Do not imply cloud-first dependency or hidden data export.
- Do not collapse candidate and promoted knowledge into one undifferentiated memory surface.

## Cross-links

- `docs/AUTOMATION_SYNTHESIS_VISION.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- `docs/CONSUMER_INTEGRATION_CONTRACT.md`
- `docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md`
- `docs/architecture/PLAYBOOK_KNOWLEDGE_QUERY_AND_INSPECTION_SURFACES.md`
- `docs/architecture/PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md`
- `docs/architecture/PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md`
