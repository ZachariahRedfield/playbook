# Replay, Consolidation, Salience, Pruning, and Promotion V1 (Canonical Future-State Spec)

## Purpose

Define the deterministic, artifact-first future state for how Playbook:

1. captures high-signal operational events,
2. scores salience,
3. consolidates recurring signals,
4. generates governed promotion candidates,
5. prunes or supersedes stale knowledge,
6. writes durable knowledge only after human approval.

This spec is the canonical V1 contract for replay/consolidation/promotion behavior.

## Scope

This document defines:

- high-signal event capture sources,
- deterministic salience inputs and scoring contract,
- replay flow (`capture -> score -> cluster -> candidate generation -> human review -> durable write`),
- pruning and supersession policy,
- identity split between `eventInstanceId` and semantic fingerprint identity,
- candidate note classes (Rule / Pattern / Failure Mode).

## Non-goals

- autonomous doctrine/rule mutation,
- opaque or non-deterministic scoring/clustering,
- durable writes without explicit human review,
- hidden background learning outside artifacted workflows.

## 1) High-signal event capture sources

Replay input is sourced from deterministic Playbook command surfaces and adjacent governance signals.

### 1.1 Canonical command sources

1. `verify`
   - rule findings, severities, impacted surfaces, ownership gaps.
2. `plan`
   - deterministic remediation intent, task decomposition, unresolved tasks.
3. `apply`
   - executed remediations, applied/not-applied outcomes, fix evidence.
4. `analyze-pr`
   - branch/worktree risk deltas, governance drift indicators, review signals.

### 1.2 Governance/failure intelligence sources

5. failure-intelligence signals
   - command failures, failed remediations, retries, rollback-worthy outcomes.
6. docs-audit/governance signals
   - `docs audit` findings, stale contract surfaces, documentation drift, missing governance evidence.

### 1.3 Capture contract

Each event MUST be persisted as immutable evidence with:

- `eventInstanceId` (unique per occurrence),
- source (`verify|plan|apply|analyze-pr|failure-intelligence|docs-audit`),
- command version/runtime metadata,
- timestamp,
- raw payload pointer + normalized payload,
- repository/ref context,
- actor/executor context.

Capture is append-only. No event mutation in place.

## 2) Deterministic salience inputs

Salience is derived from explicit, versioned inputs only.

### 2.1 Required inputs

- **severity**: intrinsic risk/criticality of the finding or outcome,
- **recurrence**: repeat frequency within bounded replay windows,
- **blast radius**: number/criticality of impacted files/modules/surfaces,
- **cross-module spread**: breadth across architectural boundaries,
- **unresolved ownership**: unresolved/conflicting owner assignment,
- **docs gaps**: missing/stale documentation and governance contract coverage,
- **novel successful remediation**: first-observed successful deterministic fix pattern with reusable value.

### 2.2 Scoring invariants

- deterministic: same normalized inputs + same scoring version => same score,
- auditable: component contribution vector is stored,
- versioned: scoring algorithm/version is first-class metadata,
- bounded: scoring depends only on declared inputs and bounded replay windows.

## 3) Replay and consolidation flow

Canonical flow:

`capture -> score -> cluster -> generate promotion candidates -> human review -> durable write`

### 3.1 Capture

- ingest canonical events,
- normalize to stable schema,
- persist raw + normalized forms for replay.

### 3.2 Score

- compute salience vector + aggregate score from required deterministic inputs,
- persist score and per-input contributions.

### 3.3 Cluster

- group events by semantic similarity using deterministic fingerprinting and bounded rules,
- preserve full cluster membership lineage (`eventInstanceId` list),
- support replay reconstruction of every cluster state.

### 3.4 Generate promotion candidates

- emit candidates when salience/recurrence/confidence thresholds are met,
- candidate generation is artifact-first and deterministic,
- candidates are proposals only (no automatic doctrine writes).

### 3.5 Human review

- review decisions: `approve | reject | defer | supersede`,
- require reviewer identity and rationale,
- capture decision artifacts as immutable governance evidence.

### 3.6 Durable write

- only approved candidates are materialized into durable knowledge surfaces,
- writes must reference the exact reviewed candidate and decision artifact,
- writes are reversible via explicit supersession, never silent overwrite.

## 4) Identity model: `eventInstanceId` vs semantic identity

Two identities are mandatory and distinct.

### 4.1 `eventInstanceId` (occurrence identity)

- unique per captured event occurrence,
- carries run/invocation/timestamp-specific provenance,
- used for replay exactness and forensic traceability.

### 4.2 `eventFingerprint` (semantic identity)

- deterministic fingerprint from normalized content,
- stable across repeated semantically equivalent events,
- used for recurrence counting, clustering, and supersession relationships.

### 4.3 Design constraints

- many `eventInstanceId` values may map to one `eventFingerprint`,
- semantic consolidation MUST NOT erase per-instance provenance,
- policy and analytics may operate on either layer, but must declare which layer is used.

## 5) Pruning and supersession policy

Pruning and supersession are explicit governance operations.

### 5.1 Pruning

- eligible for low-salience, low-recurrence, stale, non-promoted artifacts,
- must preserve tombstone metadata (`id`, reason, timestamp, actor/policy),
- must not break replay integrity or historical audit trails.

### 5.2 Supersession

- newer evidence-backed candidates/knowledge can supersede older ones,
- persist directed edges: `supersedes` and `supersededBy`,
- require rationale + linkage to replacement artifact,
- historical artifacts remain immutable and queryable.

### 5.3 Guardrails

- no hard delete of governance-relevant evidence,
- no silent replacement of approved knowledge,
- all lifecycle transitions are evented and replayable.

## 6) Candidate note classes

Promotion candidates are typed and evidence-backed.

### 6.1 Rule note candidate

Use when evidence indicates an enforceable governance invariant should exist or be strengthened.

Minimum fields:

- candidate id + deterministic fingerprint,
- proposed rule statement,
- supporting cluster/event evidence,
- salience/confidence,
- expected enforcement surface,
- review state.

### 6.2 Pattern note candidate

Use when evidence shows a reusable successful remediation or architecture practice.

Minimum fields:

- candidate id + deterministic fingerprint,
- pattern statement and applicability scope,
- successful remediation evidence,
- salience/confidence,
- constraints/known limits,
- review state.

### 6.3 Failure Mode note candidate

Use when evidence shows a recurring anti-pattern or systemic breakdown condition.

Minimum fields:

- candidate id + deterministic fingerprint,
- failure mode statement,
- recurrence and blast-radius evidence,
- trigger/precondition hints,
- mitigation references (if known),
- review state.

## 7) Determinism and governance guarantees

- artifact-first at every stage,
- deterministic replay for identical inputs and versions,
- explicit versioning for schemas/scoring/clustering,
- fail-closed behavior: incomplete provenance blocks promotion,
- human approval required before durable knowledge mutation.

## 8) V1 implementation posture

- prioritize reproducibility and auditability over compression,
- keep scoring/clustering logic explicit and inspectable,
- treat replay/consolidation as governance infrastructure, not autonomous learning,
- evolve by versioned contracts and explicit supersession rather than mutation in place.
