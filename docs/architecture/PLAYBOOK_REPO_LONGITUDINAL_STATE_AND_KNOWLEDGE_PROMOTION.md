# Playbook Repo Longitudinal State + Knowledge Promotion Architecture

## Purpose

This document defines a first-class, governed architecture for repository learning across time.

It introduces **Repo Longitudinal State** and a **Knowledge Promotion pipeline** as layers built on top of:

1. Session + Evidence (`docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`)
2. Control Plane (`docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`)
3. PR Review Loop (`docs/architecture/PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md`)

This architecture is canonical and contract-oriented. Runtime adoption can be incremental, but this document defines the truth surface that runtime artifacts, command outputs, and roadmap status must align to.

## Docs summary labels

- Pattern: Evidence Before Memory
- Pattern: Repository Learning Is Longitudinal, Not Session-Isolated
- Pattern: Human-Reviewed Knowledge Promotion
- Pattern: Compaction With Provenance
- Rule: Repo-local facts stay local unless intentionally promoted
- Rule: Candidate knowledge is not enforced governance
- Rule: Promotion must preserve evidence lineage
- Rule: Knowledge must be demotable when contradicted or stale
- Failure Mode: Memory blob without structure
- Failure Mode: Promotion without provenance
- Failure Mode: Premature canonicalization
- Failure Mode: Longitudinal state treated as hidden telemetry
- Failure Mode: Accumulating logs instead of compacting knowledge


## Canonical runtime truth stance

Repo Longitudinal State is a first-class runtime truth surface, not an implied aggregation hidden across adjacent artifacts.

- It is **deterministic**: same evidence inputs and policies must yield the same longitudinal state projection.
- It is **provenance-preserving**: promoted or candidate knowledge must retain links back to source evidence bundles.
- It is **governance-aware**: candidate knowledge, promoted doctrine, and enforced policy state remain distinct and queryable.
- It is **review-compatible**: operators should be able to inspect, challenge, and evolve state without bypassing existing review and approval boundaries.

## Canonical model: Repo Longitudinal State

Repo Longitudinal State is the canonical model for repository learning over time.

It should include deterministic, queryable fields for:

- repo identity
- session timeline
- PR/review timeline
- recurring findings
- remediation history
- verification outcomes
- approval history
- recurring failure clusters
- open questions / unresolved risks
- promoted vs candidate knowledge
- stale / superseded knowledge state

Longitudinal state is repository-scoped and compacted; it is not a free-form transcript store.

## Memory classes

Playbook longitudinal memory should be modeled as explicit classes:

1. **Transient session evidence**
   - Session-scoped observations and deterministic artifact links.
2. **Repo-local longitudinal memory**
   - Cross-session repository state retained locally by default.
3. **Candidate promoted knowledge**
   - Candidate patterns/doctrines/invariants/failure modes awaiting review.
4. **Enforced governance knowledge**
   - Human-reviewed and policy-valid knowledge promoted into enforceable surfaces.
5. **Upstream-promotable reusable patterns**
   - Explicitly selected reusable patterns that may be promoted beyond a single repository.

## Artifact feeds for longitudinal state

Longitudinal state is fed by deterministic runtime and repository artifacts, including:

- source code
- repository structure
- dependency graphs
- documentation
- pull request diffs
- verify findings
- plan/apply histories
- CI failures
- rule violations
- ownership metadata
- architecture metadata

Evidence should be normalized, lineage-linked, and retained as replayable references before any candidate extraction or promotion decision.


## Relationship to review, remediation, verification, and promotion

Repo Longitudinal State is downstream of existing deterministic seams and must not create a parallel governance path.

1. **Review loop relationship**
   - PR review-loop outputs are longitudinal evidence inputs, not separate memory systems.
   - Review findings should project into recurring-finding and unresolved-risk longitudinal fields with provenance refs.
2. **Remediation relationship**
   - `verify -> plan -> apply -> verify` receipts and outcomes are canonical longitudinal timeline events.
   - Remediation history should remain replayable as structured state transitions, not inferred from commit narratives.
3. **Verification relationship**
   - Verification outcomes and policy results are longitudinal trust-state updates.
   - Contradictions or stale evidence must be represented as explicit longitudinal-state flags, not silently overwritten.
4. **Promotion relationship**
   - Promotion consumes candidate knowledge derived from longitudinal evidence bundles.
   - Promotion decisions write audited receipts and update promoted/superseded state without destroying candidate lineage.

## Knowledge Promotion pipeline

Canonical promotion flow:

1. **Observe repeated evidence**
2. **Cluster / detect repetition**
3. **Extract candidate patterns**
4. **Build evidence bundle**
5. **Classify candidate** as one of:
   - rule
   - doctrine
   - invariant
   - failure mode
   - pattern
   - open question
6. **Human review**
7. **Promote locally or upstream** (intentional decision)
8. **Retain provenance**
9. **Allow demotion / supersession / expiration**

Candidate artifacts remain non-governing until reviewed and promoted.

## Longitudinal-state rules

- Repo-local facts remain local by default.
- Reusable patterns may be intentionally promoted upstream.
- Promotion must preserve provenance and evidence lineage.
- Promotion is an audited write boundary: every attempted canonical story/pattern promotion must emit a deterministic receipt at `.playbook/promotion-receipts.json` capturing source lineage, target fingerprints, and outcome (`promoted`, `noop`, or `conflict`).
- Rule: Promotion must emit a deterministic receipt whenever canonical knowledge is mutated or mutation is attempted.
- Pattern: Promotion should be inspectable with the same rigor as execution.
- Failure Mode: Knowledge writes without receipts create invisible drift and undermine trust in promotion history.
- Candidate knowledge is not enforced governance until reviewed.
- Stale or contradicted knowledge must be demotable.
- Memory should be compacted, not accumulated as an undifferentiated log.

## Architecture layer relationships

- **Session + Evidence** provides the raw substrate and provenance contracts.
- **Control Plane** governs access, mutation, export, and approval boundaries.
- **PR Review Loop** is a major recurring evidence source for longitudinal learning.
- **Future Automation Synthesis** may consume promoted knowledge artifacts, but cannot bypass verification/policy gates.

Recommended dependency ladder:

`deterministic runtime -> session/evidence -> control plane -> PR review loop -> repo longitudinal state/knowledge promotion -> later automation surfaces`


## Canonical longitudinal truth fields (minimum contract shape)

The longitudinal truth surface should expose deterministic fields covering:

- identity and scope (`repoId`, scope boundaries, schema version)
- timeline (`sessionTimeline`, `reviewTimeline`, `remediationTimeline`)
- trust outcomes (`verificationOutcomes`, policy/approval decisions, receipt references)
- recurring signals (`recurringFindings`, `failureClusters`, unresolved risks/questions)
- knowledge lifecycle (`candidate`, `promoted`, `demoted`, `superseded`, `stale`)
- provenance (`evidenceRefs`, fingerprints, source artifacts, timestamps)

Field names may evolve, but these categories are canonical and required for contract-aligned runtime truth.

## Artifact and storage direction under `.playbook/`

Longitudinal artifacts should be:

- repo-local by default
- versioned and schema-governed
- suitable for deterministic query and compaction
- distinct from committed demo/contract snapshots

Directional examples (non-final schema names):

- `.playbook/runtime/longitudinal-state.json`
- `.playbook/runtime/knowledge-candidates.json`
- `.playbook/runtime/knowledge-promotions.json`
- `.playbook/runtime/knowledge-compaction-log.json`

## Three-layer promotion model

Playbook promotion should keep three storage layers explicit and non-overlapping:

1. **Repo truth**
   - Canonical repository-local source artifacts such as `.playbook/stories.json`.
2. **Derived candidates**
   - Read-only, derived review inputs such as `.playbook/story-candidates.json` and `PLAYBOOK_HOME/pattern-candidates.json`.
3. **Promoted knowledge**
   - Canonical promoted reusable knowledge such as `PLAYBOOK_HOME/patterns.json`.

This preserves the boundary between local truth, derived promotion inputs, and globally reusable promoted knowledge without changing control-loop behavior.

## Guardrails and non-goals

- Not a repositioning of Playbook into a broad autonomous coding agent.
- Not hidden telemetry, automatic upstream sync, or implicit cross-repo sharing.
- Not bypassing verification, approvals, or control-plane policy.
- Not free-form chat transcript persistence as memory.
- Not optional human review for governance promotion.

## Cross-links

- `docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/roadmap/ROADMAP.json`
- `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- `docs/CONSUMER_INTEGRATION_CONTRACT.md`
- `docs/AUTOMATION_SYNTHESIS_VISION.md`
- `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md`
- `docs/architecture/PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md`
- `docs/architecture/PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md`
