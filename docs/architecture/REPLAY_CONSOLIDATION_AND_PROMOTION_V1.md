# Replay, Consolidation, Salience Scoring, Pruning, and Promotion V1 (Canonical Future-State Spec)

- feature_id: `PB-V08-REPLAY-PROMOTION-001`
- status: Canonical future-state specification
- scope: Replay, consolidation, salience scoring, pruning, and governed promotion workflows

## Purpose

Define the deterministic, artifact-first future state for how Playbook:

1. captures high-signal operational events,
2. scores salience deterministically,
3. consolidates recurring/related signals,
4. generates governed promotion candidates,
5. prunes or supersedes stale artifacts without losing lineage,
6. writes durable knowledge only after explicit human approval.

This document is the canonical V1 contract for replay/consolidation/promotion behavior under `PB-V08-REPLAY-PROMOTION-001`.

## Scope

This document defines:

- high-signal event capture sources,
- deterministic salience inputs and scoring invariants,
- replay flow (`capture -> score -> cluster -> generate promotion candidates -> human review -> durable write`),
- pruning and supersession policy,
- identity split between `eventInstanceId` and `eventFingerprint` (semantic identity),
- Rule / Pattern / Failure Mode note candidates.

## Non-goals

- autonomous doctrine/rule mutation,
- opaque or non-deterministic scoring/clustering,
- durable writes without explicit human review,
- hidden background learning outside artifacted workflows.

## 1) High-signal event capture sources

Replay input is sourced from deterministic command surfaces and adjacent governance evidence.

### 1.1 Canonical command sources

1. `verify`
   - Rule findings, severities, impacted surfaces, ownership gaps.
2. `plan`
   - Deterministic remediation intent, task decomposition, unresolved tasks.
3. `apply`
   - Executed remediations, applied/not-applied outcomes, fix evidence.
4. `analyze-pr`
   - Branch/worktree risk deltas, governance drift indicators, review signals.

### 1.2 Failure-intelligence and governance evidence

5. `failure-intelligence` sources (where available)
   - Command failures, failed remediations, retries, rollback-worthy outcomes, repeated execution breakdowns.
6. Governance evidence surfaces
   - Documentation/governance audit findings, stale contract surfaces, missing governance evidence, unresolved policy mismatches.

### 1.3 Capture contract

Each captured event MUST be persisted as immutable evidence with:

- `eventInstanceId` (unique per occurrence),
- source (`verify|plan|apply|analyze-pr|failure-intelligence|governance-evidence`),
- command/runtime/version metadata,
- timestamp,
- raw payload pointer plus normalized payload,
- repository/ref/worktree context,
- actor/executor context.

Capture is append-only. In-place mutation is disallowed.

## 2) Deterministic salience inputs

Salience is derived from explicit, versioned inputs only.

### 2.1 Required deterministic inputs

- **severity**: intrinsic risk/criticality of finding or outcome,
- **recurrence**: repeat frequency within bounded replay windows,
- **blast radius**: number/criticality of impacted files/modules/surfaces,
- **cross-module spread**: breadth across architecture boundaries,
- **unresolved ownership**: unresolved or conflicting owner assignment,
- **docs gaps**: missing/stale documentation and governance contract coverage,
- **novel successful remediation**: first-observed successful deterministic fix pattern with reusable value.

### 2.2 Scoring invariants

- deterministic: same normalized inputs + same scorer version => same salience score,
- auditable: component contribution vector is stored,
- versioned: scoring algorithm/version is first-class metadata,
- bounded: scoring depends only on declared inputs and bounded replay windows.

## 3) Replay flow

Canonical flow:

`capture -> score -> cluster -> generate promotion candidates -> human review -> durable write`

### 3.1 Capture

- ingest canonical events,
- normalize to stable schema,
- persist raw and normalized forms for replay.

### 3.2 Score

- compute salience vector + aggregate score from deterministic inputs,
- persist score and per-input contributions.

### 3.3 Cluster

- group events by deterministic semantic fingerprinting + bounded clustering rules,
- preserve full cluster membership lineage (`eventInstanceId` list),
- enable replay reconstruction of every cluster state.

### 3.4 Generate promotion candidates

- emit candidates only when salience/recurrence/confidence thresholds are met,
- candidate generation is deterministic and artifact-first,
- generated candidates are proposals only (never autonomous doctrine writes).

### 3.5 Human review

- review decisions: `approve | reject | defer | supersede`,
- require reviewer identity plus rationale,
- persist decision artifacts as immutable governance evidence.

### 3.6 Durable write

- only approved candidates are materialized into durable knowledge surfaces,
- writes MUST reference the exact reviewed candidate and decision artifact,
- durable memory mutation happens via explicit supersession; never silent overwrite.

## 4) Identity model: `eventInstanceId` vs `eventFingerprint`

Two identities are mandatory and intentionally distinct.

### 4.1 `eventInstanceId` (occurrence identity)

- unique per captured event occurrence,
- carries run/invocation/timestamp-specific provenance,
- used for replay exactness and forensic traceability.

### 4.2 `eventFingerprint` (semantic identity)

- deterministic fingerprint from normalized content,
- stable across semantically equivalent repeated events,
- used for recurrence counting, clustering, and supersession relationships.

### 4.3 Constraints

- many `eventInstanceId` values MAY map to one `eventFingerprint`,
- semantic consolidation MUST NOT erase per-instance provenance,
- policy/analytics logic MUST declare whether it operates at instance or semantic layer.

## 5) Pruning and supersession policy

Pruning and supersession are explicit governance operations.

### 5.1 Pruning

- eligible for low-salience, low-recurrence, stale, non-promoted artifacts,
- MUST preserve tombstone metadata (`id`, reason, timestamp, actor/policy),
- MUST NOT break replay integrity or historical audit trails.

### 5.2 Supersession

- newer evidence-backed candidates/knowledge MAY supersede older artifacts,
- persist directed lineage edges: `supersedes` and `supersededBy`,
- require rationale plus linkage to replacement artifact,
- superseded artifacts remain immutable and queryable.

### 5.3 Guardrails

- no hard-delete of governance-relevant evidence,
- no silent replacement of approved knowledge,
- all lifecycle transitions are evented and replayable.

## 6) Rule / Pattern / Failure Mode note candidates

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

## 7) Playbook Notes candidates

The following candidates are explicitly in-scope for downstream Playbook Notes promotion workflows:

- Pattern: Replay Before Promotion
- Pattern: Supersession Over Deletion
- Rule: Salience Gates Promotion
- Failure Mode: Candidate Flood From Low-Signal Events
- Failure Mode: Rebuilding Durable Memory From Current Repo State Only

## 8) Determinism and governance guarantees

- artifact-first at every stage,
- deterministic replay for identical inputs and versions,
- explicit versioning for schemas/scoring/clustering,
- fail-closed behavior: incomplete provenance blocks promotion,
- human approval required before durable knowledge mutation.

## 9) V1 implementation posture

- prioritize reproducibility and auditability over compression,
- keep scoring/clustering logic explicit and inspectable,
- treat replay/consolidation as governance infrastructure, not autonomous learning,
- evolve through versioned contracts and explicit supersession rather than in-place mutation.

## Unified Doctrine Loop downstream contract

Promotion is a reusable contract boundary, not an endpoint.

After approval, promotion outputs must remain machine-readable and downstream-consumable for:

- doctrine retrieval (`active` promoted patterns only),
- governed doctrine transforms,
- story-seeding proposals,
- planning-context enrichment,
- rule/docs suggestion surfaces.

Promotion receipts and promoted artifacts must never directly trigger execution. Their role is to change proposal and planning behavior through explicit governed outputs.

Rule: Only promoted, active, provenance-linked knowledge may influence planning or proposal surfaces.
Pattern: Promotion is only valuable if it changes downstream behavior.
Failure Mode: Promotion receipts that cannot be consumed downstream turn doctrine into inert archive state.
