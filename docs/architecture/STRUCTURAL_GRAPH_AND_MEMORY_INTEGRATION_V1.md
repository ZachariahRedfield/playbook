# STRUCTURAL_GRAPH_AND_MEMORY_INTEGRATION_V1

## Purpose

Define a future-state integration model between:

- the **structural repository graph** (`.playbook/repo-graph.json`), and
- the **memory system** (`.playbook/memory/*`).

This spec is additive. It preserves current contracts while introducing deterministic join semantics and provenance requirements for memory-aware command behavior.

## Non-goal and contract guardrail

### Structural graph remains structural truth

`.playbook/repo-graph.json` remains the canonical structural representation of repository topology (modules, files, ownership, static relations).

It is **not** redefined here as:

- a temporal event stream,
- a longitudinal memory ledger,
- or a session transcript store.

### Memory remains the temporal and interpretive layer

`.playbook/memory/*` remains the layer for temporal accumulation, promotion history, investigative artifacts, and question/answer traces.

Rule:
Structural graph contract and memory contract must remain separable and independently versioned.

Failure Mode:
If structural graph is overloaded as a temporal log, deterministic structure queries become unstable and contract drift propagates across commands.

## Substrate separation model

## 1) Structural substrate

**Artifact:** `.playbook/repo-graph.json`

**Responsibility:**

- repository topology and structural dependencies,
- deterministic entity IDs for structural nodes,
- static/slow-moving architecture relationships.

**Allowed evolution:**

- additive structural fields,
- contract-versioned edge/node schema updates,
- deterministic normalization improvements.

**Disallowed scope expansion:**

- storing conversational memory,
- storing promotion decisions as primary source,
- storing investigation timelines.

## 2) Memory substrate

**Artifacts:** `.playbook/memory/*`

**Responsibility:**

- temporal knowledge objects,
- evidence-backed decisions,
- promotion and supersession trails,
- investigative context and unresolved questions,
- session-local and cross-session knowledge continuity.

**Allowed evolution:**

- new memory-native node kinds,
- new memory relation kinds,
- richer provenance metadata,
- retrieval indexes tuned for command usage.

## Memory-native concepts (first-class node kinds)

The memory substrate introduces/normalizes the following node kinds:

- `decision`: accepted/rejected/partial governance decisions.
- `pattern`: reusable architecture or remediation patterns with promotion state.
- `failure_mode`: recurring breakdown classes with trigger conditions and impact signature.
- `investigation`: bounded inquiry threads tying symptoms, hypotheses, and evidence.
- `session`: execution-local context bundles (operator intent, command chain, artifacts).
- `question`: explicit unresolved or resolved repository questions.

### Minimal common fields (memory nodes)

All memory-native nodes should expose:

- `id`
- `kind`
- `title`
- `status`
- `created_at`
- `updated_at`
- `provenance`
- `evidence_refs[]`
- `scope` (repo/module/rule/command scope)

## Cross-substrate edge relations

These relations are memory-layer relations and should not mutate structural graph meaning.

- `promoted_from`
  - expresses promotion lineage (example: `pattern` promoted_from `investigation` outcome set).
- `supersedes`
  - expresses canonical replacement (example: new `decision` supersedes previous decision).
- `evidenced_by`
  - attaches claims to immutable or content-addressed evidence artifacts.
- `derived_from`
  - captures synthesis lineage (example: `failure_mode` derived_from repeated `question`/`investigation` clusters).

### Relation invariants

- Relations must be directional and typed.
- Relations must include provenance metadata.
- `supersedes` edges must not delete prior nodes; they mark historical continuity.
- `evidenced_by` edges should resolve to durable artifact identifiers, not transient in-memory pointers.

## Retrieval and join semantics by command

All joins are **federated joins** across structural and memory substrates, not substrate collapse.

## `ask`

`ask --repo-context` should:

1. ground response in structural entities from repo intelligence/graph,
2. enrich with memory nodes linked by `derived_from`/`evidenced_by`/`supersedes`,
3. return answer slices with explicit provenance blocks.

Join preference order:

- structural match (module/file/rule target), then
- memory relevance scored by recency + promotion status + evidence density.

## `explain`

`explain <target>` should:

1. resolve deterministic structural explanation baseline,
2. attach memory-backed rationale layers (decisions, patterns, failure modes),
3. include supersession notices when prior doctrine is replaced.

If memory conflicts exist, prefer latest non-superseded promoted node and include conflict metadata.

## `query`

`query` remains contract-first and deterministic.

- Existing structural query contracts remain unchanged.
- New memory-aware query modes must be explicit (for example, `query memory ...` or additional flags).
- No implicit widening of structural query response shape without schema versioning.

## `analyze-pr`

`analyze-pr` should:

1. detect structural impact from diff,
2. join to relevant memory nodes by impacted entity IDs and relation traversal,
3. emit deterministic PR intelligence:
   - prior decisions touched,
   - applicable patterns,
   - known failure modes,
   - open investigations/questions related to changed area.

Output should include confidence and provenance, and distinguish structural facts from memory interpretations.

## Provenance requirements

Every memory-derived statement included in command output must provide machine-readable provenance.

Required provenance fields:

- `source_artifact` (path or content-addressed ID)
- `source_kind` (decision/pattern/failure_mode/investigation/session/question)
- `captured_at`
- `captured_by` (command or workflow stage)
- `lineage` (edge chain used in derivation)
- `integrity` (hash/checksum when available)

Provenance policy:

- No promoted memory claim without `evidenced_by` links.
- No supersession without explicit `supersedes` edge and timestamp.
- No command-level synthesis without traceable `derived_from` lineage.

## Graph evolution and contract boundaries

## Versioning

- Structural graph contract versioning is independent from memory contract versioning.
- Cross-substrate join contract has its own compatibility envelope.

Recommended envelope:

- `repo_graph_schema_version`
- `memory_schema_version`
- `join_contract_version`

## Backward compatibility

- Adding memory integration must not break consumers expecting pure structural `repo-graph` semantics.
- Commands may add optional provenance/memory sections, but required existing fields remain stable until explicit major contract transition.

## Migration posture

- Prefer additive fields and optional sections first.
- Gate behavior shifts behind explicit flags or version negotiation.
- Publish schema deltas before defaulting new join behavior.

## Notes candidates (for promotion pipeline)

These are candidate note templates for deterministic memory capture.

## Rule candidate

A command that merges structural and memory information must emit provenance per claim and preserve substrate boundaries in output shape.

## Pattern candidate

Use structural-first grounding with memory-side enrichment via typed relation traversal (`derived_from`, `evidenced_by`, `supersedes`, `promoted_from`) to preserve determinism and contextual intelligence simultaneously.

## Failure Mode candidate

Contract collapse occurs when memory facts are backfilled into structural graph as if they were topology truth, causing ambiguous query behavior and schema instability.

## Implementation guidance (phased)

1. Introduce memory node/edge schemas and provenance blocks in `.playbook/memory/*`.
2. Add join adapters for `ask`, `explain`, `query` (opt-in), and `analyze-pr`.
3. Add schema contracts for join outputs and provenance invariants.
4. Validate with deterministic fixtures that assert:
   - structural invariants untouched,
   - supersession lineage preserved,
   - evidence links resolvable,
   - command outputs stable across repeated runs.

## Acceptance criteria (future-state)

- Structural graph remains topology-only and free of temporal memory payloads.
- Memory-native nodes support required kinds and edge relations.
- Joined command outputs are provenance-complete.
- Supersession and promotion trails are machine-traceable.
- Contract versions cleanly communicate structural vs memory vs join changes.
