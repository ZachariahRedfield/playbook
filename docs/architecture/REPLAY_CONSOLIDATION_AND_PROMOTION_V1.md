# Replay Consolidation and Promotion V1 (Future-State Architecture)

## Purpose

This document defines a future-state, **artifact-first and deterministic** architecture for converting operational events into governed knowledge candidates.

The architecture is explicitly designed to:

- preserve replayable evidence,
- avoid autonomous doctrine mutation,
- require human review before durable governance changes,
- maintain deterministic behavior across repeated runs.

## Scope

This V1 slice covers:

- event capture surfaces,
- deterministic salience scoring,
- replay/consolidation flow,
- promotion candidate generation,
- pruning/forgetting/supersession policies,
- identity and provenance contracts,
- candidate note classes (Rule, Pattern, Failure Mode).

## Non-goals

- autonomous mutation of rules, doctrine, or governance state,
- hidden background learning,
- non-deterministic score or clustering outcomes,
- doctrine writes without explicit human approval.

## Event capture sources

The replay bus ingests normalized, append-only events from canonical command/runtime surfaces:

1. `verify` findings and summaries,
2. `plan` outputs (planned remediation intent),
3. `apply` outputs (executed deterministic changes),
4. `analyze-pr` results (deterministic PR intelligence),
5. failures (command failures, validation failures, remediation failures, rollback-worthy outcomes).

Each source emits structured artifacts suitable for replay and deterministic post-processing.

## Deterministic salience scoring inputs

Each captured event (or consolidated cluster) receives a deterministic salience score derived from stable inputs:

- **severity**: governance/risk seriousness,
- **recurrence**: frequency over bounded replay windows,
- **blast radius**: affected files/modules/surfaces,
- **cross-module spread**: breadth across module boundaries,
- **ownership ambiguity**: uncertainty/conflict in ownership attribution,
- **docs gaps**: missing/stale governance or documentation contracts,
- **novel successful remediation**: first-observed successful deterministic fix pattern.

Scoring invariants:

- same inputs produce the same score,
- scoring versions are explicit and persisted,
- no opaque model-only weighting in the critical path.

## Replay and consolidation flow

Canonical flow:

`event capture -> salience scoring -> clustering -> promotion candidates -> human review -> durable knowledge write`

### 1) Event capture

- Persist immutable event artifacts with timestamp, source command, and execution context.
- Preserve raw and normalized forms for deterministic replay.

### 2) Salience scoring

- Compute deterministic score vectors from the canonical inputs.
- Persist component contributions for auditability.

### 3) Clustering

- Group semantically similar events using deterministic fingerprinting + bounded similarity rules.
- Preserve membership lineage so each cluster can be reconstructed from source events.

### 4) Promotion candidates

- Produce candidate notes only when cluster salience and confidence thresholds are met.
- Emit candidates as artifacts; do not auto-apply doctrine or rule changes.

### 5) Human review

- Require explicit reviewer approval/rejection/defer/supersede decisions.
- Record reviewer identity, rationale, and decision timestamp.

### 6) Durable knowledge write

- Only approved candidates can be written into durable governed knowledge stores.
- Writes are explicit, auditable, and linked to decision provenance.

## Identity model: event instance vs semantic/fingerprint identity

Two identity layers are required:

1. **Event instance identity**
   - unique per occurrence,
   - used for exact replay lineage,
   - includes execution-bound context (run ID, command invocation, timestamp).

2. **Semantic/fingerprint identity**
   - stable across repeated similar occurrences,
   - used for clustering, recurrence, and supersession,
   - derived from normalized content and deterministic fingerprint rules.

Design rule:

- many event instances may map to one semantic identity;
- semantic identity must not erase per-instance provenance.

## Provenance requirements

Every stage (capture, scoring, clustering, promotion, review, durable write) must retain traceable provenance:

- source command and artifact pointers,
- command/version metadata,
- scoring version and input vector,
- clustering version and cluster membership,
- candidate generation thresholds and gating decisions,
- reviewer decision records,
- durable write target and resulting artifact ID.

Fail-closed behavior:

- if provenance is incomplete or inconsistent, promotion is blocked.

## Pruning, forgetting, and supersession policy

### Pruning

- prune low-salience, low-recurrence candidate artifacts after bounded retention windows,
- preserve minimal audit tombstones (identity + reason + timestamp).

### Forgetting

- support policy-driven forgetting for stale, non-actionable, or invalidated candidates,
- forgetting must be explicit, logged, and replay-safe (no history corruption).

### Supersession

- allow newer, better-supported candidates/doctrine to supersede older items,
- maintain explicit supersession edges (`supersedes`, `superseded-by`) and rationale,
- never silently rewrite historical artifacts.

## Candidate note classes

Promotion candidates are emitted as typed notes:

- **Rule** candidate: governance invariant or enforceable constraint suggestion,
- **Pattern** candidate: reusable successful remediation or architecture practice,
- **Failure Mode** candidate: recurring anti-pattern, breakdown condition, or risk signature.

Each note class must include:

- deterministic fingerprint,
- supporting evidence set,
- confidence/salience metadata,
- review status,
- provenance chain.

## Governance guardrails

- Behavior remains artifact-first and deterministic end-to-end.
- No autonomous mutation of doctrine, rules, or governance contracts.
- Human review is mandatory before any durable doctrine change.
- Replays of identical artifact sets under the same versions must produce identical candidate outputs.

## Suggested implementation posture (V1)

- start append-only and replay-centric,
- keep scoring/clustering heuristics explicit and versioned,
- optimize for auditability before optimization for compression,
- treat promotion as a governance workflow, not an autonomous learning loop.
