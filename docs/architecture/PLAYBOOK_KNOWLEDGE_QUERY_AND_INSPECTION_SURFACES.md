# Playbook Knowledge Query and Inspection Surfaces Architecture

## Purpose

This document defines the canonical read-runtime architecture for inspecting repository memory and promoted knowledge in deterministic, provenance-preserving ways before broader automation consumption.

Knowledge Query / Inspection Surfaces exist to:

- make repo-local longitudinal memory queryable
- make candidate/promoted knowledge inspectable
- preserve evidence lineage and provenance
- support humans, CI, and future validated server/API surfaces
- remain read-only and deterministic

This architecture is directional and contract-oriented. It does **not** add broad automation execution, hidden sync/export behavior, or free-form transcript memory storage.

## Docs summary labels

- Pattern: Inspectable Memory Before Automated Memory Consumption
- Pattern: Queryable Repository Knowledge
- Pattern: Provenance-Preserving Inspection
- Rule: Candidate knowledge must remain distinguishable from promoted governance
- Rule: Memory query surfaces are read-only intelligence surfaces
- Rule: Repo-local knowledge remains private-first unless intentionally promoted/exported
- Failure Mode: Memory exists but cannot be trusted or inspected
- Failure Mode: Free-form memory blob without deterministic inspection contracts
- Failure Mode: Automation consumes knowledge before humans can inspect provenance
- Failure Mode: Query surfaces imply enforcement

## Core memory classes exposed by inspection surfaces

Inspection surfaces should expose structured views over these explicit classes:

1. **Transient session evidence**
   - Session-scoped evidence bundles and deterministic command/artifact lineage.
2. **Repo-local longitudinal memory**
   - Cross-session repository memory retained locally by default.
3. **Candidate promoted knowledge**
   - Candidate patterns/rules/doctrines awaiting review.
4. **Enforced/promoted governance knowledge**
   - Reviewed and promoted governance artifacts that may inform enforcement layers.
5. **Upstream-promotable reusable patterns**
   - Sanitized, intentionally promotable reusable patterns with explicit ownership/scope metadata.

## Canonical inspection modes

Knowledge inspection surfaces should provide deterministic read modes for:

- list
- query/filter
- inspect one item
- timeline/history
- provenance trace
- candidate vs promoted comparison
- stale/superseded view

Each mode should return structured machine-readable output with stable type separation across candidate, promoted, superseded, and evidence-linked records.

## Core inspection questions

Playbook should be able to answer:

- what knowledge exists for this repo?
- what was learned recently?
- what findings keep recurring?
- which candidate patterns are awaiting review?
- what promoted rules/patterns came from what evidence?
- what knowledge is stale, contradicted, or superseded?
- what is repo-local only vs promotable upstream?

## Deterministic contract expectations

Knowledge query and inspection outputs must satisfy these constraints:

- outputs must be structured and machine-readable
- inspection must preserve evidence linkage
- memory query surfaces must not imply enforcement by themselves
- candidate knowledge must remain distinguishable from promoted governance
- repo-local/private-first behavior must remain explicit

Inspection contracts are intelligence surfaces, not mutation or promotion actions.

## Interface layering

Knowledge query/inspection should be layered as:

1. **CLI inspection surfaces are primary**
   - Canonical source for deterministic local/private-first read-runtime inspection.
2. **CI may consume structured read-only outputs**
   - CI can validate/report on memory state without mutating promotion state.
3. **Future server/API surfaces may expose validated query endpoints**
   - Server surfaces must preserve deterministic contracts and control-plane boundaries.
4. **Browser clients should not bypass validated server-side governance**
   - Browser/UI clients should consume validated read endpoints, not arbitrary local execution.

## Boundaries with adjacent architecture layers

- **Session + Evidence** (`docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`) supplies raw traceable events and provenance anchors.
- **Control Plane** (`docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`) governs access/export/promotion boundaries.
- **PR Review Loop** (`docs/architecture/PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md`) supplies high-value evidence and recurring pattern signals.
- **Repo Longitudinal State + Knowledge Promotion** (`docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md`) defines what memory exists and how knowledge is promoted.
- **Knowledge Query / Inspection Surfaces** define how that memory is safely read with deterministic contracts and provenance-preserving views.

Recommended dependency ladder:

`deterministic runtime -> session/evidence -> control plane -> PR review loop -> repo longitudinal state/knowledge promotion -> knowledge query/inspection surfaces -> later automation synthesis and broader agent surfaces`

## Guardrails and non-goals

- Do not reposition Playbook as a generic memory chatbot.
- Do not add automatic promotion, demotion, or cross-repo sync.
- Do not bypass control-plane policy or evidence/provenance requirements.
- Do not weaken the `analyzes but does not author` product stance.
- Do not treat memory as a free-form chat transcript store.

## Cross-links

- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/roadmap/ROADMAP.json`
- `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- `docs/CONSUMER_INTEGRATION_CONTRACT.md`
- `docs/AUTOMATION_SYNTHESIS_VISION.md`
- `docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md`
