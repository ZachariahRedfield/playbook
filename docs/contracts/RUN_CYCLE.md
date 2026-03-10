# RunCycle Artifact Contract

The RunCycle artifact captures one repository learning loop in a deterministic, machine-readable envelope.

It is intended to anchor:

- forward discovery (`ai-context`/`ai-contract`/`index`/`graph`)
- return remediation (`verify`/`plan`/`apply`/post-`verify`)
- zettelkasten extraction (`zettels.jsonl` and `links.jsonl`)
- deterministic graph snapshot linkage (`.playbook/graph/snapshots/<timestamp>@<shortsha>.json`)
- cycle-based memory progression (grouping outputs and promotion-readiness inputs)


## Current memory maturity

Current shipped scaffolding includes RunCycle capture, zettelkasten extraction, graph snapshots, and deterministic groups.

Next phase adds deterministic candidate-pattern synthesis into reviewable draft pattern cards plus promotion-readiness scoring.

Current scope explicitly stops before auto-promotion.

## RunCycle memory semantics

RunCycle is a spiral learning iteration:

```text
RunCycle(n)
-> observe
-> verify
-> plan
-> apply
-> extract
-> zettels
-> graph snapshot
-> deterministic groups
-> candidate patterns
-> draft pattern cards
-> review queue
-> RunCycle(n+1)
```

RunCycle artifacts capture evidence expansion and compression signals. They should be used to connect working-memory zettels to stabilized patterns and promoted contracts over time.

## State-space analogy alignment

For geometric reasoning, treat each RunCycle as a bounded state-space step:

- cycle metrics define a deterministic vector projection (see `stateSpace` and `bloch-v1` references)
- command execution applies deterministic transforms across that state
- `verify` and promotion gates act as deterministic measurement points
- compaction and promotion stabilize outcomes toward reusable attractors

This framing is a modeling aid only and must stay consistent with `docs/architecture/BLOCH_SPHERE_STATE_SPACE.md` boundaries.

## Artifact path

Runtime output path:

- `.playbook/run-cycles/<timestamp>@<shortsha>.json`

Example:

- `.playbook/run-cycles/2025-01-01T00-00-00.000Z@abc1234.json`

## Contract shape

```json
{
  "schemaVersion": "1.0",
  "kind": "playbook-run-cycle",
  "runCycleId": "2025-01-01T00-00-00.000Z@abc1234",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "repository": {
    "root": ".",
    "git": {
      "commit": "abc1234def5678",
      "shortSha": "abc1234"
    }
  },
  "forwardArc": {
    "aiContext": { "path": ".playbook/ai-context.json", "digest": "sha256:..." },
    "aiContract": { "path": ".playbook/ai-contract.json", "digest": "sha256:..." },
    "repoIndex": { "path": ".playbook/repo-index.json", "digest": "sha256:..." },
    "repoGraph": { "path": ".playbook/repo-graph.json", "digest": "sha256:..." }
  },
  "returnArc": {
    "verify": { "path": ".playbook/verify.json", "digest": "sha256:..." },
    "plan": { "path": ".playbook/plan.json", "digest": "sha256:..." },
    "apply": { "path": ".playbook/apply.json", "digest": "sha256:..." },
    "postVerify": { "path": ".playbook/post-verify.json", "digest": "sha256:..." }
  },
  "zettelkasten": {
    "zettels": { "path": ".playbook/zettelkasten/zettels.jsonl", "digest": "sha256:..." },
    "links": { "path": ".playbook/zettelkasten/links.jsonl", "digest": "sha256:..." }
  },
  "graphMemory": {
    "snapshot": { "path": ".playbook/graph/snapshots/<timestamp>@<shortsha>.json", "digest": "sha256:..." },
    "groups": { "path": ".playbook/graph/groups/<timestamp>@<shortsha>.json", "digest": "sha256:..." },
    "candidatePatterns": { "path": ".playbook/compaction/candidate-patterns/<timestamp>@<shortsha>.json", "digest": "sha256:..." },
    "draftPatternCards": { "path": ".playbook/pattern-cards/drafts/<timestamp>@<shortsha>.json", "digest": "sha256:..." },
    "promotionReviewQueue": { "path": ".playbook/promotion/review-queue/<timestamp>@<shortsha>.json", "digest": "sha256:..." },
    "promotionDecisions": { "path": ".playbook/promotion/decisions/<timestamp>@<shortsha>.json", "digest": "sha256:..." },
    "promotedPatternCards": { "path": ".playbook/pattern-cards/promoted/<timestamp>@<shortsha>.json", "digest": "sha256:..." }
  },
  "stateSpace": {
    "projection": "bloch-v1",
    "bloch": { "path": ".playbook/state-space/<runCycleId>.json", "digest": "sha256:..." }
  },
  "metrics": {
    "loopClosureRate": 0.75,
    "promotionYield": 0.2,
    "compactionGain": 0.15,
    "reuseRate": 0.3,
    "driftScore": 0.1,
    "entropyBudget": 0.4
  }
}
```

## Required sections

- `forwardArc`: refs to forward intelligence artifacts (`ai-context`, `ai-contract`, `index`, `graph`).
- `returnArc`: refs to return/remediation artifacts (`verify`, `plan`, `apply`, post-`verify`).
- `zettelkasten`: refs to `.playbook/zettelkasten/zettels.jsonl` and `.playbook/zettelkasten/links.jsonl`.
- `metrics`: must include `loopClosureRate`, `promotionYield`, `compactionGain`, `reuseRate`, `driftScore`, and `entropyBudget`.
- `graphMemory` (optional): refs to graph snapshot, deterministic groups, candidate contraction previews, synthesized pattern-card drafts, promotion review queue artifacts, explicit promotion decisions, and promoted pattern-card artifacts.
- `stateSpace` (optional): refs to internal state-space projection artifacts (for example `bloch-v1`).

Each ref is nullable. Producers should populate refs only when source artifacts exist.

## Compatibility notes with zettelkasten lifecycle

- `zettels` should contain lifecycle-state notes (`draft|observed`, `linked`, `converged`, `compacted`, `promoted`, `retired`).
- `originCycleId` in zettels should match this artifact's `runCycleId` (or a referenced prior cycle for carried evidence).
- `promotionYield`, `reuseRate`, and `compactionGain` are cycle-level indicators that consolidation is working.


## Graph-memory structure layer

RunCycle is the cycle anchor vertex for Playbook graph-memory snapshots.

Long-term structure is modeled as a typed graph:

- RunCycle and artifacts become lineage-preserving vertices
- zettels become evidence vertices linked through typed edges
- deterministic grouping produces stable pattern-card candidates
- pattern cards may promote to contracts through explicit `PROMOTES_TO` lineage

Graph-memory scope separation:

- simple graph: pairwise typed edges (`from -> to`)
- hypergraph-style: relation vertices for multi-party evidence/events
- production grouping: deterministic and replayable
- exploratory clustering: offline diagnostics only, not promotion-critical

Contraction requirements:

- accumulation is not compression
- contraction must preserve lineage back to evidence artifacts
- contracts are hard attractors and must remain traceable to cycle evidence

## Runtime artifact policy

RunCycle and Zettelkasten outputs are runtime artifacts and must remain under `.playbook/`.

For repository history, commit only curated/static examples (for example under `.playbook/demo-artifacts/`) and avoid committing volatile run-by-run snapshots.


## Graph snapshot artifact (runtime)

Runtime graph-memory snapshots capture typed edges produced from RunCycle + zettelkasten evidence.

Path:

- `.playbook/graph/snapshots/<timestamp>@<shortsha>.json`

Snapshot metrics include:

- `vertexCount`
- `edgeCount`
- `orphanVertexCount`
- `zettelCount`
- `linkedZettelCount`
- `patternCardCount`
- `contractCount`

Rule:
Grouping is allowed only when connectivity and boundary compatibility both hold.

Pattern:
Deterministic grouping is the bridge between linked memory and compressed reusable knowledge.

Failure Mode:
Over-merging connected but incompatible zettels creates false patterns and doctrine drift.


## Rule / Pattern / Failure Mode

Rule:
Do not promote grouped knowledge until it is rendered into reviewable draft pattern cards.

Pattern:
Playbook memory matures through explicit compression boundaries, not hidden jumps.

Failure Mode:
A system that can group memory but not review it will either stall or over-promote.


Rule:
Durable knowledge must pass through an explicit promotion decision.

Pattern:
Pattern-card promotion forms the durable attractors of Playbook memory.

Failure Mode:
Unreviewed pattern promotion creates unstable doctrine and architecture drift.

## Next-phase acceptance criteria

- Candidate patterns are deterministically synthesized from grouped evidence.
- Draft pattern cards are emitted as the first reviewable compression boundary.
- Promotion-readiness scoring is reproducible per run cycle.
- Promotion remains review-gated with no automatic contract promotion.

## Promotion decision journal governance

- **Rule:** No knowledge state may be mutated in place; all durable transitions must be expressed as explicit decision morphisms.
- **Pattern:** Promotion decisions are the compositional algebra of Playbook knowledge governance.
- **Failure Mode:** If promotion occurs without an append-only decision journal, doctrine becomes unreplayable and rollback semantics collapse.
