# Playbook Governed Cross-Repo Pattern Promotion and Transfer Architecture

## Purpose

This document defines the canonical **Governed Cross-Repo Pattern Promotion / Transfer** architecture slice for Playbook.

It specifies how reusable engineering knowledge may move across repositories through explicit, reviewable, provenance-preserving, privacy-safe governance paths without turning Playbook into a hidden global-memory system.

This layer is downstream of:

1. Session + Evidence
2. Control Plane
3. PR Review Loop
4. Repo Longitudinal State + Knowledge Promotion
5. Knowledge Query / Inspection Surfaces
6. Automation Synthesis (Governed Knowledge Consumption)
7. Outcome Feedback + Automation Runtime Learning

## Docs summary labels

- Pattern: Local Learning, Governed Promotion, Scoped Transfer
- Pattern: Transferable Pattern Packages
- Pattern: Compatibility-Gated Cross-Repo Reuse
- Rule: Repo-local facts never transfer directly
- Rule: Imported reusable patterns are candidate inputs until locally reviewed
- Rule: Transfer must preserve provenance and sanitization status
- Rule: Bad transferred patterns must be recallable/demotable
- Failure Mode: Global memory blob disguised as product intelligence
- Failure Mode: Repo-local workaround promoted as universal doctrine
- Failure Mode: Cross-repo transfer without sanitization
- Failure Mode: Imported pattern treated as enforced governance by default
- Failure Mode: Hidden telemetry disguised as learning

## Core model

Playbook cross-repo architecture follows these rules:

- Repo-local learning remains local by default.
- Reusable patterns may be intentionally promoted from local evidence.
- Promoted patterns may be transferred through governed paths.
- Transferred patterns arrive as scoped reusable knowledge inputs, not auto-enforced truth.

No architecture path here implies automatic upstream sync, automatic global pooling, or implicit cross-repository memory sharing.

## Knowledge classes for cross-repo transfer

1. **Repo-local knowledge (never transferred directly)**
   - Repo-specific facts, context, topology, operations, and sensitive local evidence.
2. **Candidate local knowledge awaiting review**
   - Local candidate patterns/rules/doctrines before promotion.
3. **Promoted local governance knowledge**
   - Locally reviewed/policy-valid governance artifacts in one repository.
4. **Transferable reusable patterns**
   - Generalized and sanitized pattern packages approved for cross-repo reuse.
5. **Upstream product gaps**
   - Capability gaps promoted as roadmap/core improvement proposals.
6. **Upstream core rules/templates/contracts**
   - Shared-core improvements adopted upstream after explicit review.
7. **Imported reusable patterns in a receiving repo**
   - Received transfer packages treated as local candidate inputs.
8. **Adopted/promoted receiving-repo governance after local review**
   - Receiving-repo governance promoted only after local compatibility and policy review.

## Transfer eligibility

Eligible for governed transfer:

- approved reusable governance patterns
- approved architecture patterns
- approved template/pattern families
- approved rule/doctrine/invariant candidates that have been generalized and sanitized
- product-gap intelligence suitable for upstream roadmap/core work

Not eligible for direct transfer:

- raw source code
- raw session transcripts
- raw runtime outcomes
- repo-specific secrets or operational details
- unreviewed candidate memory
- sensitive repo-local topology or ownership details unless explicitly sanitized/approved
- stale/superseded knowledge without explicit override/review

## Canonical promotion and transfer pipeline

1. **Local evidence accumulation**
2. **Local candidate pattern extraction**
3. **Human review**
4. **Sanitization / generalization**
5. **Transferable-pattern packaging**
6. **Provenance bundle creation**
7. **Transfer target selection**
8. **Receiving-side policy/compatibility review**
9. **Local adoption as candidate knowledge**
10. **Optional promotion into receiving-repo governance**
11. **Optional upstream core product/rule/template changes**

Pipeline invariants:

- Fail closed when provenance, sanitization status, scope metadata, or approval state is incomplete.
- Preserve distinction between transfer as input and governance as enforcement.
- Keep repository-local authority on whether to adopt, reject, demote, or supersede imported patterns.

## Canonical transfer package concept

A transferable pattern package should include:

- pattern identity
- source provenance
- evidence summary
- sanitization status
- scope/compatibility metadata
- risk class
- template/rule family references
- required preconditions
- known failure modes
- demotion/supersession metadata
- local/private fields excluded from transfer payloads

Transfer payload rule:

- private/repo-local fields remain outside the transferable payload by default.

## Compatibility and scoping rules

- Transfer should be topology-aware / scope-aware, not broadcast blindly.
- Imported patterns should declare intended repo types, architecture constraints, or applicable contexts.
- Mismatched pattern import should fail closed or remain advisory-only.
- Receiving repositories retain full local review authority.
- Imported patterns should carry compatibility metadata and risk class to support deterministic local decisions.

## Transfer targets

Governed transfer targets include:

- upstream core rules/contracts/templates
- architecture pattern docs
- roadmap proposals / product-gap proposals
- reusable pattern libraries
- downstream candidate imports into other repositories

## Governance rules

- Repo-local facts stay local unless intentionally promoted.
- Transferable patterns must preserve provenance.
- Imported patterns are candidate inputs until locally reviewed.
- No hidden telemetry or automatic global sync.
- Promotion to upstream/core remains explicit and auditable.
- Demotion/recall of bad transferred patterns must be possible.

## Relationship to existing architecture layers

- **Session + Evidence** creates traceable local evidence and lineage foundations.
- **Control Plane** governs export, access, and approval boundaries.
- **PR Review Loop** supplies recurring review-derived pattern candidates.
- **Repo Longitudinal State + Knowledge Promotion** governs local learning/promotion.
- **Knowledge Query / Inspection Surfaces** make promoted knowledge inspectable.
- **Automation Synthesis** consumes governed/promoted knowledge downstream.
- **Outcome Feedback** refines local candidate knowledge from runtime outcomes.
- **Cross-Repo Promotion / Transfer** governs when a locally proven reusable pattern can move beyond one repository.

Recommended architecture ordering:

`deterministic runtime -> session/evidence -> control plane -> PR review loop -> repo longitudinal state/knowledge promotion -> knowledge query/inspection surfaces -> automation synthesis consuming governed/promoted knowledge -> outcome feedback/automation runtime learning -> governed cross-repo pattern promotion/transfer -> later broader interface/platform expansion`

## Privacy and locality boundaries

- Playbook remains private-first and offline-capable.
- Export/sync is explicit opt-in.
- Transfer packages must exclude raw repo-local sensitive details by default.
- Receiving repositories should consume reusable abstractions, not source-repo internals.
- Cross-repo promotion/transfer must not become hidden telemetry, implicit global memory, or automatic cloud synchronization.

## Guardrails and non-goals

- Not a repositioning of Playbook into a cloud-first global-memory platform.
- Not automatic upstream sync or cross-repo data pooling.
- Not direct sharing of raw local memory or raw runtime traces.
- Not bypassing Control Plane, approval, provenance, or local adoption review.
- Not automatic enforcement of imported patterns as governance truth.
- Not weakening the shared core + project-local state architecture.

## Cross-links

- `docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md`
- `docs/architecture/PLAYBOOK_KNOWLEDGE_QUERY_AND_INSPECTION_SURFACES.md`
- `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md`
- `docs/architecture/PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- `docs/CONSUMER_INTEGRATION_CONTRACT.md`
- `docs/AUTOMATION_SYNTHESIS_VISION.md`

## Lifecycle completion update

- Promoted reusable patterns now carry explicit states: `active`, `superseded`, `retired`, and `demoted`.
- Retirement, demotion, and recall are deterministic receipt-emitting operations, not ad hoc file edits.
- Transfer package imports land in receiving repos as candidate-only pattern input. They do not become governance truth or auto-promoted doctrine.
- Compatibility mismatch must fail closed. Recalled or demoted transferred patterns remain inspectable through the same lifecycle record.
