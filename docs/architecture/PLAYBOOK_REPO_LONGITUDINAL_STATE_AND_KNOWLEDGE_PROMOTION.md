# Playbook Repo Longitudinal State + Knowledge Promotion Architecture

## Purpose

This document defines a first-class, governed architecture for repository learning across time.

It introduces **Repo Longitudinal State** and a **Knowledge Promotion pipeline** as layers built on top of:

1. Session + Evidence (`docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`)
2. Control Plane (`docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`)
3. PR Review Loop (`docs/architecture/PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md`)

This architecture is directional and contract-oriented. It does **not** claim broad runtime implementation is complete.

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

## Evidence sources for longitudinal learning

Longitudinal learning may use deterministic evidence from:

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

Evidence should be normalized and lineage-linked before promotion decisions.

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
