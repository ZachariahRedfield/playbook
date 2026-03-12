# STRUCTURAL_GRAPH_AND_MEMORY_INTEGRATION_V1

## Purpose

Define the canonical future-state contract for integrating:

- the **structural repository graph** (`.playbook/repo-graph.json`), and
- the **repository memory substrate** (`.playbook/memory/*`)

without collapsing them into a single artifact.

This specification is intentionally contract-first: structural truth and memory truth remain separate, independently versioned, and joined only through explicit semantics.

## Canonical substrate separation

### Structural substrate

**Artifact:** `.playbook/repo-graph.json`

**Role:** Deterministic topology and architecture structure.

**Contains:**

- structural entities (modules, files, ownership anchors, rule anchors)
- structural edges (imports, dependencies, ownership, containment)
- stable identifiers for structural traversal

**Must not contain:**

- session transcripts
- longitudinal promotion history
- investigative narratives
- memory-native doctrine entities

### Memory substrate

**Artifacts:** `.playbook/memory/*`

**Role:** Temporal, evidentiary, and interpretive repository memory.

**Contains:**

- promoted and non-promoted memory entities
- supersession/promotion lineage
- evidence links and synthesis lineage
- session-level and cross-session continuity artifacts

**Must not redefine:**

- structural topology as primary source of truth
- canonical module/file dependency truth

## Memory-native entities (first-class)

The memory system defines the following canonical entities:

- `decision`
  - Governance or architecture decisions with accepted/rejected/superseded lifecycle.
- `pattern`
  - Reusable solution shape validated across one or more contexts.
- `failure_mode`
  - Recurring breakdown class with trigger and impact profile.
- `investigation`
  - Bounded inquiry artifact connecting symptoms, hypotheses, and findings.
- `session`
  - Execution/session context envelope for command chains and artifacts.
- `question`
  - Explicit unresolved/resolved inquiry item, often upstream of investigation.

### Minimal memory entity envelope

Each memory-native entity should expose at least:

- `id`
- `kind`
- `title`
- `status`
- `created_at`
- `updated_at`
- `scope`
- `provenance`
- `evidence_refs[]`

## Memory-native edges (first-class)

The memory system defines the following canonical edge types:

- `promoted_from`
  - Promotion lineage from precursor artifacts into promoted doctrine.
- `supersedes`
  - Successor relationship indicating replacement while preserving history.
- `evidenced_by`
  - Evidence attachment from a claim-bearing node to source artifacts.
- `derived_from`
  - Synthesis lineage from source nodes into inferred or compacted artifacts.
- `related_to`
  - Non-causal, contextual relationship for adjacency and retrieval support.

### Edge invariants

- Edges are directional and typed.
- Edges carry provenance metadata.
- `supersedes` never erases prior nodes; it preserves continuity.
- `evidenced_by` points to durable artifact identifiers (path or content-addressed ID).

## Join semantics (federated, not merged)

All command joins are **federated** joins across two substrates. The join layer composes outputs; it does not rewrite either substrate contract.

### `query`

- Structural `query` behavior remains deterministic and contract-stable.
- Memory-aware querying is explicit (dedicated namespace/flag/subcommand), never implicit widening.
- Joined responses must separate:
  - `structural_facts`
  - `memory_context`
  - `provenance`

### `explain`

- Baseline explanation resolves from structural intelligence first.
- Memory context (decisions, patterns, failure modes, investigations, questions) is attached second.
- If doctrine conflicts exist:
  - prefer latest promoted non-superseded node,
  - include supersession lineage and conflict metadata.

### `ask --repo-context`

- Resolve target context from structural graph/index first.
- Enrich answer with memory entities reachable through `derived_from`, `evidenced_by`, `supersedes`, `related_to`, `promoted_from`.
- Return provenance per claim and clearly distinguish:
  - topology facts,
  - memory interpretation,
  - confidence annotations.

### `analyze-pr`

- Detect impacted structural entities from diff.
- Traverse memory graph from impacted IDs and related rule/module scopes.
- Emit deterministic PR intelligence including:
  - relevant decisions,
  - applicable patterns,
  - known failure modes,
  - active investigations,
  - unresolved/high-value questions.
- Output must separate structural impact from memory interpretation and include provenance and confidence.

## Provenance rules

Any memory-derived statement in command output must include machine-readable provenance.

### Required provenance fields

- `source_artifact`
- `source_kind`
- `captured_at`
- `captured_by`
- `lineage`
- `integrity`

### Provenance policy

- No promoted claim without evidence lineage (`evidenced_by` chain).
- No supersession without explicit `supersedes` edge and timestamp.
- No synthesized memory claim without explicit `derived_from` lineage.

## Contract-boundary rules

1. **Structural contract independence**
   - Structural schema versioning remains independent from memory schema versioning.
2. **Memory contract independence**
   - Memory schema evolution must not mutate structural semantics.
3. **Join contract explicitness**
   - Join behavior versioning is explicit and separate from both substrates.
4. **Backward compatibility**
   - Existing structural consumers remain valid unless an explicit major contract boundary is crossed.
5. **No silent widening**
   - Commands must not silently change structural response shape to include memory payloads without explicit contract/version signaling.

### Recommended compatibility envelope

- `repo_graph_schema_version`
- `memory_schema_version`
- `join_contract_version`

## Rule / Pattern / Failure Mode note candidates

### Rule candidate

Commands that compose structural and memory outputs must preserve substrate boundaries and emit provenance for every memory-derived claim.

### Pattern candidate

Use **structural-first grounding + memory-second enrichment** via typed relation traversal (`promoted_from`, `supersedes`, `evidenced_by`, `derived_from`, `related_to`) to maximize determinism without losing temporal intelligence.

### Failure Mode candidate

**Contract collapse** occurs when temporal memory artifacts are backfilled into structural graph payloads as topology truth, causing schema drift, ambiguous query behavior, and non-deterministic command outputs.
