# Playbook CLI Command System Analysis

## Scope and method

This analysis covers the command layer implemented in:

- `packages/cli` (registry + handlers)
- `packages/engine` (runtime subsystems invoked by commands)
- `packages/core` (analysis/audit primitives surfaced through CLI)

Method used:

1. Enumerated all registered commands from registry/metadata.
2. Mapped each command to subsystem calls and artifact IO.
3. Derived producer/consumer edges for deterministic artifact pipelines.
4. Compared current command system to the target lifecycle: **Observe -> Analyze -> Plan -> Execute -> Verify**.

---

## 1) Command categories (surface area)

Playbook currently exposes **34 registered commands** in four metadata categories.

### Core
`analyze`, `pilot`, `verify`, `plan`, `orchestrate`, `apply`

### Repository tools
`analyze-pr`, `doctor`, `diagram`, `patterns`, `docs`, `audit`, `rules`, `schema`, `context`, `ai-context`, `ai-contract`, `ignore`, `contracts`

### Repository intelligence
`index`, `graph`, `query`, `deps`, `ask`, `explain`, `route`

### Utility
`demo`, `init`, `fix`, `status`, `upgrade`, `session`, `learn`, `memory`

### Structural observation

There is already metadata-level command lifecycle tagging (`canonical`, `utility`, `compatibility`) and discoverability tagging (`primary`, `secondary`, `hidden-compatibility`), which is a strong built-in guardrail against command explosion.

---

## 2) Command capability map (command -> subsystem -> artifacts -> consumers)

| Command | Primary subsystem(s) | Key outputs/artifacts | Primary consumers |
|---|---|---|---|
| `index` | Engine indexer + graph + module context | `.playbook/repo-index.json`, `.playbook/repo-graph.json`, `.playbook/context/modules/*` | `query`, `deps`, `graph`, `ask --repo-context`, `explain` |
| `query` | Engine repo query | JSON query result | Humans/automation, governance loops |
| `deps` | Engine dependency query | Module dependency projection | Architecture/governance decisions |
| `ask` | Engine ask + optional diff/repo context | Deterministic Q&A payload with sources | AI/operator workflows |
| `explain` | Engine explain target resolver | Rule/module/architecture explanation payload | Remediation planning + onboarding |
| `verify` | Engine verify + rule loaders + execution/session tracking | Findings payload (optional `--out`), run evidence | `plan`, `doctor`, policy gates |
| `plan` | Engine plan contract + remediation derivation + run tracking | Plan payload (optional `--out`) | `apply` |
| `apply` | Engine plan parse/select + executor + route guards + run tracking | Apply result payload + mutated repo + run/session evidence | Follow-up `verify`, status/session |
| `pilot` | Composite wrapper | Chained child outputs from `context/index/query/verify/plan` | Bootstrap workflows |
| `doctor` | Core audit + engine health/docs/risk/index + verify aggregation | Health report + optional fixes | Repository operators |
| `docs` | Engine docs audit | Docs governance findings | `doctor`, CI |
| `audit` | Core architecture audit | Architecture guardrail findings | `doctor`, architecture governance |
| `analyze-pr` | Engine PR analyzer + formatter | PR intelligence (text/json/github formats) | PR review loops |
| `orchestrate` | Engine orchestrator compiler | `.playbook/orchestrator/*` lane artifacts | Human/agent execution lanes |
| `contracts` | Engine contract registry builder | Contract registry JSON | Integrations and policy checks |
| `schema` | Engine schema registry | JSON schema(s) | Tooling validation |
| `learn` | Engine learn draft | Candidates artifact (`.playbook/knowledge/candidates.json`) | `memory` |
| `memory` | Engine memory replay/promote/prune | Knowledge artifacts + promotion/prune results | Longitudinal memory workflows |
| `patterns` | Engine compaction/promotion | Promotion decisions/artifacts | Pattern governance workflows |
| `status` | Composite (`analyze` + `verify` + `doctor`) | Aggregated health status | Daily operations |
| `session` | Engine session store + run linkage | Session artifact state | Agents/operators resuming work |

---

## 3) Command dependency graph

Detailed graph: `docs/architecture/COMMAND_GRAPH.md`.

### Important explicit chain

- **Deterministic remediation pipeline**: `verify -> plan -> apply -> verify`
- **Repository intelligence pipeline**: `index -> query/deps/explain/ask(repo-context)`
- **Knowledge pipeline**: `learn draft -> memory promote/replay/prune`

### Composite/meta commands

- `pilot` composes `context + index + query + verify + plan`.
- `doctor` composes verify/docs/audit/risk/index-oriented checks.
- `status` composes analyze/verify/doctor style signals.

---

## 4) Artifact pipeline

### Major deterministic artifacts

1. **Repository intelligence artifacts**
   - `.playbook/repo-index.json`
   - `.playbook/repo-graph.json`
   - `.playbook/context/modules/*`

2. **Remediation artifacts**
   - verify findings JSON (`--out`)
   - plan JSON (`--out`)
   - execution runs (`.playbook/runs/*`)
   - session state (`.playbook/session.json`)

3. **Orchestration artifacts**
   - `.playbook/orchestrator/*`

4. **Knowledge artifacts**
   - `.playbook/knowledge/candidates.json`
   - promoted/pruned knowledge artifacts

### Pipeline quality assessment

- **Strength**: artifact writing uses deterministic JSON and optional envelope/checksum semantics.
- **Strength**: run/session evidence creates traceability across commands.
- **Weakness**: not every command declares its producer/consumer contract in one canonical machine-readable map.

---

## 5) Pattern extraction

### Pattern A — Analysis/Observation command

Characteristics:
- scans repo or artifacts
- returns deterministic JSON summary
- typically no repo mutation

Examples: `index`, `query`, `deps`, `graph`, `verify`, `docs`, `audit`, `analyze-pr`, `rules`, `contracts`, `schema`.

### Pattern B — Transformation/Planning command

Characteristics:
- consumes findings/intelligence
- emits executable/structured plan

Examples: `plan`, `orchestrate`, `learn draft`.

### Pattern C — Execution command

Characteristics:
- consumes approved plan or deterministic task selection
- mutates repo and writes execution evidence

Examples: `apply`, `ignore apply`, selected `doctor --fix` paths.

### Pattern D — Composite/orchestrator command

Characteristics:
- wraps a known sequence of lower-level commands
- unifies operator workflow

Examples: `pilot`, `doctor`, `status`.

### Pattern E — AI/control-plane bootstrap command

Characteristics:
- emits machine context contracts for agents/tools

Examples: `ai-context`, `ai-contract`, `context`, `route`, `session`.

---

## 6) Architectural observations

1. **Good separation of concerns**
   - CLI command routing stays thin; heavy lifting lives in engine/core.

2. **Built-in anti-drift metadata model**
   - `commandMetadata` centralizes category, lifecycle, discoverability, and examples.

3. **Execution control plane is already present**
   - run/session artifacts and execution-step append/complete APIs form an implicit control plane across remediation commands.

4. **Dual command identities exist in metadata**
   - `pilot` appears in two category entries (Core and Repository tools), signaling taxonomy overlap.

5. **Compatibility commands retained intentionally**
   - `analyze`/`fix` are marked compatibility + hidden discoverability, indicating controlled deprecation posture.

---

## 7) Gaps and opportunities

### Gap 1 — Canonical command IO registry is distributed

Current state:
- command contracts, schemas, metadata, and command implementations all hold parts of truth.

Opportunity:
- add a generated **single command capability manifest** (`command -> args -> artifacts produced/consumed -> subsystems`) emitted by one command.

### Gap 2 — Composite command transparency

Current state:
- composition exists (`pilot`, `doctor`, `status`) but dependency contracts are mostly implicit.

Opportunity:
- standardize child-command trace output and artifact lineage for all composite commands.

### Gap 3 — Potential command overlap (early command explosion signal)

Observed overlap zones:
- health/governance summaries: `status` vs `doctor` vs portions of `verify`
- intelligence answering: `query` vs `ask --repo-context` vs `explain`

Opportunity:
- define explicit “when to use” boundaries and promote one primary entrypoint per operator intent.

### Gap 4 — Internal vs public command boundary

Opportunity:
- formally mark commands that are automation-internal or compatibility-only in CLI help/metadata output (not just discoverability field).

### Gap 5 — Observe/Analyze/Plan/Execute/Verify loop alignment

Assessment:
- Loop is mostly present.
- “Observe” is split across `index`, `analyze-pr`, `query`, `graph`.

Opportunity:
- introduce a lightweight explicit `observe` umbrella command (composite) that materializes a standardized observation artifact for downstream planning.

---

## 8) Consolidation and abstraction candidates

1. **Unify artifact contract declaration**
   - Generate command docs + schemas + metadata from one command capability source.

2. **Normalize planning semantics**
   - Align `plan`, `orchestrate`, `learn draft` under a shared “planning contract” abstraction (input evidence + output executable/structured plan + lineage).

3. **Normalize execution semantics**
   - Consolidate apply-like behaviors (`apply`, `ignore apply`, `doctor --fix`) around one execution policy/evidence wrapper.

4. **Taxonomy cleanup**
   - Resolve duplicate classification (`pilot`) and define strict category assignment rules.

---

## 9) Recommended next documentation artifacts

To support future self-improvement loops, add a generated machine-readable artifact:

- `.playbook/command-capability-index.json`

Suggested schema fields:
- `name`, `category`, `lifecycle`, `discoverability`
- `inputFlags`, `subcommands`
- `subsystems` (engine/core/node/session/orchestrator/memory/etc.)
- `producesArtifacts[]`
- `consumesArtifacts[]`
- `composesCommands[]`
- `mutatesRepository` (boolean)
- `deterministicOutput` (boolean)

This would let Playbook reason about its own command system directly instead of inferring from source.
