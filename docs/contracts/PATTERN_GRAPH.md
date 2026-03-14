# Pattern Graph Contract (v1)

## Purpose

`pattern-graph.schema.json` defines a first-class, read-only knowledge graph for pattern intelligence in Playbook contracts.

This contract is intentionally additive and deterministic:

- additive: new nodes/edges can be appended without breaking existing readers
- deterministic: stable `id` references and explicit arrays support reproducible snapshots
- query-friendly: links are modeled as reference arrays (`*_refs`, `relation_edges`) for indexed traversal

## Node types

- **Pattern**: canonical pattern record (repository-native or research-conceptual).
- **Mechanism**: reusable mechanism used by one or more patterns.
- **Layer**: explicit architectural/conceptual layer taxonomy.
- **Evidence**: source-backed proof artifacts.
- **PatternInstance**: concrete manifestation of a pattern in a repository or conceptual corpus.
- **PatternRelation**: explicit edge between patterns.

## Metadata types

- **AttractorScore**: scoring metadata separated from structural nodes.
- **PromotionState**: lifecycle state (`candidate`, `observed`, `promoted`, `retired`).

## Evidence vs instance vs relation

- **Evidence** answers: _what source supports this claim?_  
  Examples: code span, document path, observation, or research reference.
- **PatternInstance** answers: _where/how does this pattern show up concretely?_  
  Instances bind one pattern to specific evidence.
- **PatternRelation** answers: _how do two patterns interact?_  
  Relations model graph edges (`reinforces`, `depends-on`, `conflicts-with`, `composes`) with evidence-backed rationale.

## Rule

Pattern graph contracts must be additive, deterministic, and query-friendly before they become adaptive or self-modifying.

## Pattern

Separate structural node types from scoring metadata so read models stay stable while ranking evolves.

## Failure mode

Embedding evolving heuristic logic directly into base schemas makes versioning brittle and breaks downstream consumers.


## Attractor scoring engine

Attractor scores model **structural persistence**, not truth.

### Signals

Each pattern is scored with deterministic, bounded signals (`0..1`):

- `recurrence`: instance recurrence density
- `cross_domain_reuse`: reuse across repository-native and research-conceptual neighborhoods
- `evidence_strength`: evidence count and evidence-kind diversity
- `repository_impact`: repository footprint from instances, edges, and source type
- `governance_alignment`: alignment with governance-relevant layers and evidence presence

### Weighted formula

```
attractor_score =
  recurrence * 0.30 +
  cross_domain_reuse * 0.20 +
  evidence_strength * 0.20 +
  repository_impact * 0.20 +
  governance_alignment * 0.10
```

### Promotion thresholds

- `< 0.30` → `observed`
- `>= 0.30` → `candidate`
- `>= 0.65` → `promoted`
- `>= 0.85` → `canonical`

### Governance safeguards

- New scores are appended as additional `AttractorScore` entries; historical scores are never overwritten.
- Promotion transitions are deterministic and threshold-based.
- Multiple weak signals are intentionally aggregated to avoid over-trusting single heuristics.
- Patterns without evidence or instances are penalized to reduce graph hallucination risk and preserve trust.

Rule: Pattern scores represent structural persistence, not truth.

Pattern: Multiple weak signals aggregated are safer than a single strong heuristic.

Failure Mode: Allowing patterns without evidence or instances creates graph hallucination and undermines trust in the knowledge model.
