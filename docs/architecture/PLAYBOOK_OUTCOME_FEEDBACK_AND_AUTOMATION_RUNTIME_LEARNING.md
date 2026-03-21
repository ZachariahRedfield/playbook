# Playbook Outcome Feedback and Automation Runtime Learning Architecture

## Purpose

This document defines the canonical **Outcome Feedback + Automation Runtime Learning** architecture slice for Playbook.

This layer captures outcomes from synthesized and approved automation runs, converts those outcomes into evidence-linked learning signals, updates repo-local longitudinal state, and improves future synthesis/template selection **without bypassing verification, policy, provenance, or human-reviewed promotion**.

This architecture is explicitly governance-preserving. It does **not** permit broad autonomous self-modification, silent policy mutation, hidden telemetry, or automatic promotion of runtime outcomes into enforced governance.

## Docs summary labels

- Pattern: Runtime Outcomes Become Evidence
- Pattern: Closed Learning Loop With Human-Reviewed Promotion
- Pattern: Rollback Events Are Learning Signals
- Rule: Verification remains the trust boundary
- Rule: Outcome feedback may refine candidate knowledge, not auto-promote governance
- Rule: Repo-local runtime learning stays local unless intentionally promoted
- Failure Mode: Self-modifying automation without review
- Failure Mode: Runtime feedback without provenance
- Failure Mode: Success metrics mistaken for governance truth
- Failure Mode: Hidden telemetry disguised as learning
- Failure Mode: Template/policy mutation driven by opaque outcome signals

## Canonical purpose of this layer

Outcome Feedback + Automation Runtime Learning should:

- capture outcomes from synthesized/approved automation runs
- convert outcomes into evidence-linked learning signals
- update repo-local longitudinal state and candidate knowledge
- improve future synthesis template/pattern selection safely
- preserve human review for any promotion into enforced governance or upstream reusable knowledge

## Canonical outcome classes

Playbook should model at least these canonical outcome classes:

1. successful execution with verified intended result
2. successful execution with partial result
3. verification failure
4. policy rejection
5. rollback / deactivation event
6. runtime regression detected later
7. false positive trigger
8. false negative / missed opportunity
9. stale template or stale knowledge input
10. operator override / human correction

## Canonical feedback pipeline

Canonical governed pipeline:

1. automation run / orchestration event
2. verification result capture
3. runtime monitoring observation
4. rollback/deactivation if needed
5. outcome classification
6. evidence bundle creation
7. repo-local longitudinal state update
8. candidate knowledge / confidence update
9. template-quality / pattern-quality feedback
10. optional human review for promotion, demotion, or supersession

Trust requirements for this pipeline:

- verification remains the trust boundary
- rollback/deactivation events become first-class evidence
- each feedback record keeps provenance to automation run, knowledge inputs, template version, and approval context
- candidate learning outputs remain explicitly distinguishable from promoted governance knowledge

## Allowed learning outputs

Allowed outputs from runtime learning are **candidate/governed-by-review** artifacts, including:

- updated repo-local confidence signals
- candidate pattern refinements
- candidate template suitability signals
- candidate trigger-quality signals
- candidate rollback heuristics
- candidate stale-knowledge flags
- candidate documentation/runbook updates
- repo health trend updates

## Disallowed or restricted learning behaviors

Disallowed by default:

- automatic promotion into enforced rules/doctrines/invariants
- automatic upstream sharing of repo-local outcomes
- opaque self-modification of templates or policies
- silent mutation of approval thresholds
- treating raw runtime data as trusted without verification/provenance
- broad cross-repo learning without an explicit governance path

Restricted behavior rule:

- any promotion/demotion/supersession action that affects enforced governance requires explicit human review and policy-compliant approval records.

## Relationship to existing architecture layers

Outcome Feedback closes the loop downstream of current governed layers:

- **Session + Evidence** supplies traceable execution/session artifacts.
- **Control Plane** governs which runtime signals may be captured, retained, exported, or acted upon.
- **PR Review Loop** remains a major source of recurring evidence.
- **Repo Longitudinal State + Knowledge Promotion** stores governed learning over time.
- **Knowledge Query / Inspection Surfaces** make runtime-learning outputs inspectable.
- **Automation Synthesis** consumes governed/promoted knowledge.
- **Outcome Feedback** feeds verified automation results back into candidate learning artifacts.

Recommended dependency ladder:

`deterministic runtime -> session/evidence -> control plane -> PR review loop -> repo longitudinal state / knowledge promotion -> knowledge query / inspection surfaces -> automation synthesis consuming governed/promoted knowledge -> outcome feedback / automation runtime learning -> later broader orchestration or interface expansion`

## Trust and evidence rules

- Verification remains the trust boundary.
- Runtime observations without evidence lineage are insufficient for promotion.
- Rollback/deactivation events are first-class trust signals, not operational footnotes.
- Feedback artifacts must preserve provenance links to:
  - automation run/session
  - consumed knowledge inputs
  - template/pattern version
  - approval/policy context
  - verification outputs and rollback actions
- Candidate learning outputs must remain clearly separate from promoted governance artifacts.

## Locality and privacy boundaries

- Outcome feedback is repo-local by default.
- No hidden telemetry.
- Export/sync is explicit opt-in only.
- Reusable patterns may be intentionally promoted upstream only after review.
- Sensitive runtime outcomes must remain bounded by control-plane capture/retention/export policy.

## Inspection and query expectations

Inspection/query surfaces for runtime learning should answer:

- what automations have succeeded or failed repeatedly?
- which template families are high-confidence vs low-confidence?
- what rollback patterns are recurring?
- which promoted knowledge inputs are producing poor outcomes?
- what candidate improvements are awaiting review?
- which outcomes changed repo health or confidence trends over time?

## Artifact and storage direction under `.playbook/`

Directionally, runtime-learning artifacts should remain structured, versioned, and class-separated.

Illustrative repository-local layout:

```text
.playbook/
  runtime-feedback/
    events/
      <run-id>.json
    outcome-reports/
      v1/
        <date-or-cycle>.json
    candidate-learning/
      templates/
      patterns/
      triggers/
      rollback-heuristics/
      stale-knowledge-flags/
    promoted-knowledge/
      ... (human-reviewed promoted artifacts)
    demo-artifacts/
      ... (committed snapshots/contracts only)
```

Separation requirements:

- runtime event traces remain distinct from candidate learning artifacts
- candidate learning remains distinct from promoted knowledge
- committed demo/contract snapshots remain explicitly curated

## Guardrails and non-goals

- Do not reposition Playbook as a self-governing autonomous coding agent.
- Do not bypass Control Plane, approvals, or verification.
- Do not allow runtime outcomes to directly rewrite enforced governance.
- Do not imply cloud-first dependency or silent cross-repo learning.
- Do not collapse candidate learning outputs and promoted knowledge into one undifferentiated memory surface.

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
- `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md`
- `docs/architecture/PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md`


## Lifecycle review candidate artifact

- Runtime receipts, drift projections, rollback/deactivation notes, promotion history, and later portability outcomes should converge into `.playbook/memory/lifecycle-candidates.json`.
- Each recommendation must remain candidate-only until explicit human promotion/demotion/retirement.
- Every recommendation must preserve exact source evidence references and target pattern ids so freshness, demotion, and supersession suggestions remain explainable.
- Rule: Runtime outcomes may suggest knowledge changes, but may not mutate promoted knowledge automatically.
- Pattern: Outcome feedback should produce reviewable lifecycle candidates, not hidden doctrine edits.
- Failure Mode: Freshness logic without provenance becomes numerology.

## Unified Doctrine Loop feedback closure

Outcome feedback is the return path of the Unified Doctrine Loop.

Closed-loop rule set:

- outcomes may emit freshness, demotion, retirement, and supersession recommendations
- recommendations remain candidate-only artifacts with provenance
- lifecycle feedback must not mutate promoted doctrine automatically
- the next learning cycle consumes these recommendation artifacts as evidence, not as already-applied truth

Rule: Playbook improves itself through governed transforms, not direct self-mutation.
Failure Mode: Treating outcome feedback as permission to rewrite doctrine collapses governance and replayability.
