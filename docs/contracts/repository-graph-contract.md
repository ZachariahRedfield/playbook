# `.playbook/repo-graph.json` Contract (Versioned Evolution Policy)

This document defines the stability contract for Playbook's repository graph artifact.

## Artifact identity

- **Path**: `.playbook/repo-graph.json`
- **Kind**: `playbook-repo-graph`
- **Current schema version**: `1.1`
- **Producer**: `playbook index`
- **Primary read surfaces**: `playbook graph`, `playbook query`, `playbook explain`

## Evolution policy

Playbook follows strict contract-safe evolution for graph consumers (CI, automations, AI tooling).

### Allowed additive changes (non-breaking)

The following are allowed without a major contract break when deterministic and derivable from existing repository intelligence:

- adding new **node kinds**
- adding new **edge kinds**
- adding optional fields in summary/read outputs
- adding deterministic nodes/edges derived from existing index/rule metadata

When additive graph shape changes occur, bump artifact `schemaVersion` **minor** (for example `1.0` -> `1.1`) and keep prior invariants deterministic.

### Breaking changes

The following are breaking:

- changing/removing existing required top-level keys (`schemaVersion`, `kind`, `nodes`, `edges`, `stats`)
- changing semantic meaning of existing node/edge kinds
- renaming existing node IDs or ID schemes in a way that invalidates stable references
- making previously deterministic ordering non-deterministic

Breaking changes require a **major** `schemaVersion` bump and coordinated updates to:

- CLI schemas
- contract snapshots
- docs for downstream consumers

## Determinism requirements

Graph generation must remain:

- local-first
- deterministic ordering for nodes/edges
- low-cost (no broad heuristic inference)
- explainable from existing repository truth

## Deterministic relationship policy

Only low-cost relationships already derivable from trusted metadata are allowed in the current phase:

- `contains` (repository root contains indexed modules/rules)
- `depends_on` (module dependency edges from indexed module dependencies)
- `governed_by` (module governed by indexed rules)

## Example artifact snippet (`1.1`)

```json
{
  "schemaVersion": "1.1",
  "kind": "playbook-repo-graph",
  "nodes": [
    { "id": "repository:root", "kind": "repository", "name": "root" },
    { "id": "module:workouts", "kind": "module", "name": "workouts" },
    { "id": "rule:PB001", "kind": "rule", "name": "PB001" }
  ],
  "edges": [
    { "kind": "contains", "from": "repository:root", "to": "module:workouts" },
    { "kind": "governed_by", "from": "module:workouts", "to": "rule:PB001" }
  ],
  "stats": { "nodeCount": 3, "edgeCount": 2 }
}
```

## Downstream consumer notes

Consumers should:

- branch by `schemaVersion`
- tolerate additive node/edge kinds when not directly required
- avoid relying on generated timestamps for contract assertions
- treat `kind` + `schemaVersion` as the contract handshake

AI/tooling guidance:

- prefer graph-backed neighborhood summaries from existing read surfaces (`query`/`explain`) before doing broad repository inference
- assume graph content is deterministic, but only within declared `schemaVersion`
