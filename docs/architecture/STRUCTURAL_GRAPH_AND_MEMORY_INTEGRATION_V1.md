# STRUCTURAL_GRAPH_AND_MEMORY_INTEGRATION_V1

- feature_id: `PB-V08-GRAPH-MEMORY-001`
- status: Canonical future-state specification
- scope: Structural repository graph + memory substrate integration (federated join model)

## Purpose

This document defines the canonical future-state contract for how structural repository graph and memory systems integrate **without collapsing into one artifact**.

The design intent is explicit substrate separation:

- Structural truth remains in `.playbook/repo-graph.json`
- Temporal/evidentiary memory remains in `.playbook/memory/*`
- Join behavior is its own contract boundary

## 1) Substrate separation (authoritative model)

### 1.1 Structural graph substrate

**Artifact:** `.playbook/repo-graph.json`

**Role:** Deterministic structural topology for repository architecture and traversal.

**Contains:**

- structural entities (modules, files, ownership anchors, rule anchors)
- structural relationships (containment, dependency, import, ownership)
- stable structural identifiers used by repository-intelligence commands

**Must not contain:**

- session transcripts
- promoted doctrine history
- narrative investigations
- memory-native decision/pattern/failure artifacts

### 1.2 Memory substrate

**Artifacts:** `.playbook/memory/*`

**Role:** Temporal and evidentiary repository memory for decisions, promotion, investigations, and longitudinal continuity.

**Contains:**

- memory-native entities and edge lineage
- supersession and promotion history
- claim evidence and synthesis lineage
- session continuity and inquiry lifecycle artifacts

**Must not redefine:**

- structural topology as primary truth
- canonical module/file dependency structure

### 1.3 Separation rule (normative)

**Rule: Structural Truth and Temporal Memory Are Separate Substrates**

Any command combining structural and memory outputs must preserve distinct substrate provenance and must not encode memory history as structural topology.

## 2) Memory-native entities

The memory subsystem defines the following first-class entities:

- `decision`
- `pattern`
- `failure_mode`
- `investigation`
- `session`
- `question`

### 2.1 Entity semantics

- `decision`: Governance or architecture doctrine with lifecycle state and supersession lineage.
- `pattern`: Reusable, validated approach grounded by evidence across one or more scopes.
- `failure_mode`: Recurring breakage class with trigger, impact, and prevention/remediation cues.
- `investigation`: Bounded inquiry connecting symptoms, hypotheses, findings, and outcomes.
- `session`: Runtime/workflow envelope linking command execution and resulting artifacts.
- `question`: Explicit unresolved or resolved inquiry, often feeding investigations and doctrine updates.

### 2.2 Minimal entity contract

Every memory-native entity should expose, at minimum:

- `id`
- `kind`
- `title`
- `status`
- `scope`
- `created_at`
- `updated_at`
- `provenance`
- `evidence_refs[]`

## 3) Memory-native edges

The memory subsystem defines the following first-class edge types:

- `promoted_from`
- `supersedes`
- `evidenced_by`
- `derived_from`
- `related_to`

### 3.1 Edge semantics

- `promoted_from`: Doctrine lineage from precursor/candidate artifacts to promoted artifacts.
- `supersedes`: Historical replacement preserving continuity and conflict interpretation.
- `evidenced_by`: Claim-bearing node references supporting artifacts.
- `derived_from`: Synthesis lineage from source artifacts/nodes into compacted or inferred artifacts.
- `related_to`: Non-causal contextual association for retrieval and navigation.

### 3.2 Edge invariants

- All edges are directional and typed.
- All edges carry provenance metadata.
- `supersedes` preserves historical nodes; it does not delete historical truth.
- `evidenced_by` must resolve to durable artifact identity (path ID and/or content-addressed ID).

## 4) Join semantics for command surfaces

All joins are **federated joins**, not substrate merges. Join composition may enrich outputs but may not mutate either substrate’s source-of-truth contract.

### 4.1 `query`

- Structural `query` outputs remain deterministic and structurally authoritative.
- Memory-aware enrichment must be explicit (namespace/flag/subcommand/contract version).
- Joined output must preserve separated sections:
  - `structural_facts`
  - `memory_context`
  - `provenance`

### 4.2 `explain`

- Resolve architecture/module/rule basis from structural intelligence first.
- Attach memory context second (decision/pattern/failure_mode/investigation/question).
- On doctrinal conflict, prefer the latest promoted non-superseded node and include supersession lineage.

### 4.3 `ask --repo-context`

- Ground answer context in structural graph/index first.
- Enrich via memory traversal across `promoted_from`, `supersedes`, `evidenced_by`, `derived_from`, `related_to`.
- Separate claim classes in output:
  - topology fact
  - memory interpretation
  - confidence/provenance annotation

### 4.4 `analyze-pr`

- Identify impacted structural entities from diff-scoped analysis.
- Join relevant memory entities through structural scope links and memory edge traversal.
- Emit deterministic PR intelligence including:
  - relevant decisions
  - applicable patterns
  - known failure modes
  - active investigations
  - unresolved/high-value questions
- Preserve explicit separation between structural impact and memory interpretation.

## 5) Provenance and contract-boundary rules

### 5.1 Provenance requirements

Every memory-derived claim must include machine-readable provenance.

Required provenance fields:

- `source_artifact`
- `source_kind`
- `captured_at`
- `captured_by`
- `lineage`
- `integrity`

### 5.2 Provenance policy

- No promoted claim without `evidenced_by` lineage.
- No supersession without explicit `supersedes` edge and timestamp.
- No synthesized memory claim without `derived_from` lineage.

### 5.3 Contract boundaries

1. Structural schema versioning remains independent from memory schema versioning.
2. Memory schema evolution must not alter structural semantics.
3. Join behavior has its own explicit versioned contract.
4. Structural-only consumers remain backward compatible unless an explicit major boundary is introduced.
5. No silent widening: memory payloads are never injected into structural response contracts without explicit signaling.

Recommended compatibility envelope fields:

- `repo_graph_schema_version`
- `memory_schema_version`
- `join_contract_version`

## 6) Rule / Pattern / Failure Mode note candidates

- **Pattern: Structural Graph + Memory Graph/Index**
  - Keep structural graph and memory graph/index independently authoritative, then compose through typed, provenance-preserving joins at command boundaries.

- **Rule: Structural Truth and Temporal Memory Are Separate Substrates**
  - Structural topology and temporal memory must remain separate artifacts and separate contracts in all command implementations.

- **Failure Mode: Collapsing Repo Graph Into Event Log**
  - When memory/event history is written into structural graph payloads, deterministic architecture truth degrades into ambiguous temporal data and command contracts drift.

## 7) Non-goals and anti-collapse guardrail

This spec does **not** define a single unified graph artifact. It defines coordinated contracts.

Anti-collapse guardrail:

- Structural graph remains the canonical topology substrate.
- Memory remains the canonical temporal/evidentiary substrate.
- Join is explicit, typed, versioned, and provenance-bound.

This guardrail is mandatory for `PB-V08-GRAPH-MEMORY-001`.
