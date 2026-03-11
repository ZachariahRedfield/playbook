# Playbook Improvement Backlog

## Purpose

This document captures feature ideas, architectural improvements, and workflow opportunities discovered during development.

Items here are **not yet committed roadmap work**.

They are promoted to the roadmap when they become prioritized product capabilities.

## Lifecycle

Idea  
↓  
Improvement Backlog  
↓  
Roadmap  
↓  
Implemented  
↓  
Archive

This structure prevents roadmap bloat while preserving engineering intelligence discovered during development.

---

## Staging candidates: Product truth packaging and narrative sync

These backlog candidates feed roadmap track `PB-V1-PRODUCT-TRUTH-PACKAGING-001` without implying live command-surface changes in this pass.

- Add a generated command truth table framing commands as canonical workflow, compatibility-only, or utility surfaces.
- Add narrative drift checks that compare runtime/help/docs/demo/roadmap language for planned-vs-live consistency.
- Add explicit `ask --repo-context` question-boundary examples (in-scope and unsupported) for deterministic operator expectations.
- Add demo/onboarding synchronization checks so ladder guidance stays aligned with implemented contracts.

---

## Staging candidates: Knowledge compaction phase follow-through

These backlog candidates align to roadmap track `PB-V08-KNOWLEDGE-COMPACTION-SPEC-001` and remain internal-first.

- Add deterministic canonicalization helpers for candidate pattern normalization (role labels, unstable-token stripping, mechanism summaries).
- Add candidate bucketing contract fixtures (`discard|attach|merge|add`) with deterministic replay tests and deferred generalization metadata only.
- Add pattern-card artifact schema and validation guidance for candidate/reviewed/promoted lifecycle states.
- Track graph-ready deterministic pattern card persistence and review draft artifacts under feature `PB-V08-PATTERN-CARD-STORAGE-001`.
- Add compaction review artifact templates that link candidate abstraction fields to concrete evidence provenance.
- Add docs/rules promotion workflow checks so compaction outputs never imply autonomous promotion.

---

## Staging candidates: Knowledge lifecycle hardening (internal-first)

These candidates establish lifecycle gates before any broad knowledge-management command expansion.

- Define evidence-state contracts that explicitly distinguish observed evidence from compacted knowledge candidates.
- Add deterministic comparison fixtures proving stable candidate matching against existing compacted artifacts.
- Add promotion trust-threshold checklist contracts for reusable pattern/rule/contract elevation.
- Add retirement policies for supersede/deprecate/merge/remove actions on stale or duplicative artifacts.
- Add lifecycle audit checks that fail when observations are promoted without canonicalization+comparison+compaction evidence.

Pattern: Internal-first knowledge lifecycle before public command expansion.
Pattern: Compaction is the trust-preserving bridge between extraction and promotion.
Rule: Promotion must only happen after canonicalization, deterministic comparison, and compaction.
Failure Mode: Promoting raw observations directly into reusable guidance causes duplication and semantic drift.
Failure Mode: Unbounded pattern accumulation turns deterministic intelligence into low-trust memory sprawl.

---

## Architectural Insight: Deterministic Engineering Reasoning Loop

Playbook commands already form a reusable deterministic reasoning loop for engineering workflows.

Conceptual loop:

Observe
↓
Understand
↓
Diagnose
↓
Plan
↓
Act
↓
Verify
↓
Learn

Current command mapping:

- `index` → observe repository structure
- `query` → inspect architecture metadata
- `ask` / `explain` → understand repository semantics
- `plan` → generate deterministic remediation intent
- `apply` → execute changes
- `verify` → confirm repository compliance
- memory direction (`.playbook/memory/*`) → preserve engineering knowledge

This indicates Playbook is not only a CLI command set. The product is evolving toward a deterministic reasoning runtime for AI-assisted engineering workflows.

This reasoning loop applies across:

- architecture analysis
- remediation workflows
- CI diagnostics
- PR analysis
- repository maintenance

The loop should remain the core execution model independent of interface surface.

- Pattern: Deterministic Engineering Reasoning Loop
  - Playbook commands collectively implement a reusable reasoning cycle (`observe -> understand -> plan -> act -> verify`).
  - This pattern supports complex engineering workflows while preserving deterministic execution contracts.
- Pattern: Interface Follows Runtime
  - CLI, chat interfaces, CI automation, and AI agents should remain thin interfaces over the same Playbook reasoning loop and artifact contracts.
  - Interfaces should not bypass repository intelligence artifacts.
- Failure Mode: Interface-Led Product Drift
  - If new interfaces (UI, chat, agent surfaces) bypass the deterministic command workflow, Playbook loses consistency and trust.
  - All execution surfaces should route through the canonical Playbook reasoning loop.


---

## Staged Improvement: Storage and Runtime Artifact Hygiene

### Stage 1 — Artifact taxonomy and docs alignment

- Define a single artifact taxonomy across docs: runtime local artifacts, reviewed automation artifacts, and committed demo/contract snapshots.
- Clarify that `.playbook/` is the default runtime artifact home and that local artifacts are gitignored by default unless intentionally promoted.
- Preserve the distinction that `.playbook/demo-artifacts/` contains stable product-facing snapshot contracts/examples.

### Stage 2 — Scan and cache hygiene direction

- Roadmap `.playbookignore` as a focused scan-exclusion mechanism for high-churn/non-source directories (e.g. `node_modules`, `dist`, `coverage`, `.next`, build outputs, non-source artifact folders).
- Define local cache policy guidance for cacheable intelligence artifacts under `.playbook/`, including regeneration expectations and commit guidance.

### Stage 3 — Lifecycle and maintenance ergonomics

- Define retention classes for runtime local state, CI artifacts, and committed contract/demo artifacts so lifecycle rules are explicit.
- Explore optional cleanup/doctor visibility for oversized local Playbook state to surface repository hygiene risks early.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated artifacts on every run causes unnecessary repo-history growth and review churn.

---

## Query System Ideas

- Dependency graph query  
  Command: `pnpm playbook query dependencies`

- Impact analysis query enhancements  
  Command: `pnpm playbook query impact <module>`

---

## Developer Workflow Intelligence

- Pull request analysis  
  Command: `pnpm playbook analyze-pr`

Potential capabilities:

- modules affected by change
- architectural blast radius
- risk score
- missing tests
- documentation coverage gaps

---

## Risk Intelligence Enhancements

- `pnpm playbook query risk --top`

Purpose:  
Rank highest-risk modules in the repository.

---

## Follow-up Opportunities

- `pnpm playbook backlog audit`

Purpose:  
Automatically detect implemented improvements and archive them.

---

## Docs Governance Follow-ups

- Pattern: Documentation responsibility boundaries should be enforced by moving idea content to the improvement backlog rather than duplicating planning language across docs.
- Rule: `docs/AI_AGENT_CONTEXT.md` should describe current AI operating context, not future feature planning.
- Rule: `docs/PLAYBOOK_DEV_WORKFLOW.md` should describe development process, not act as a second roadmap.
- Rule: `docs/index.md` should navigate documentation, not duplicate backlog or roadmap content.
- Pattern: Historical one-off cleanup docs should be archived or removed once governance rules replace them.
- Failure Mode: Docs-audit warning burn-down is faked if warnings are removed by weakening audit rules instead of aligning documents.

---

## Future Capability Direction: Deterministic Knowledge Lifecycle Runtime

### Positioning

Playbook should evolve as a deterministic engineering intelligence runtime, not as an unbounded repository memory store.

Knowledge growth must be lifecycle-gated:

`observation/extraction -> canonicalization -> deterministic comparison -> bucketing/compaction -> promotion -> retirement`

### Internal-first sequencing

Near-term work should prioritize internal lifecycle contracts/artifacts over new public command families:

- extraction/observation pipelines that preserve evidence provenance
- canonicalization pipelines that normalize candidates into stable comparable shape
- deterministic comparison against compacted artifacts
- compaction/bucketing outcomes (`discard|attach|merge|new candidate`)
- gated promotion into reusable patterns/rules/contracts
- retirement policies for superseded/stale duplicative knowledge

### Public surface stance (explicit)

Potential `pnpm playbook knowledge *` commands remain directional concepts only and are intentionally deferred until lifecycle/trust contracts are stable and validated in deterministic workflows.

- Rule: Treat extracted knowledge as evidence first, reusable knowledge second.
- Rule: Promotion requires stronger trust thresholds than observation and must be lifecycle-gated.
- Pattern: Compaction is the bridge between extraction and promotion.
- Failure Mode: Uncontrolled knowledge accumulation degrades determinism, retrieval quality, and operator trust.




## Cross-Repository Pattern Learning

Playbook should eventually learn reusable architecture and workflow patterns across multiple analyzed repositories using normalized runtime artifacts.

The future signal aggregation scope should include:

- module structure
- architecture inference
- dependency graphs
- rule violations
- scan boundary classifications
- ignore recommendations
- remediation plans

These signals should synthesize candidate reusable patterns that move through the existing knowledge lifecycle:

`observation -> canonicalization -> comparison -> compaction -> promotion -> retirement`

### Future acceptance criteria (pre-enable)

Cross-repo learning should remain paused until all of the following are true:

- recommendation identity normalization complete
- ignore apply telemetry available
- runtime coverage semantics stable
- artifact schemas versioned and stable
- at least three validated external pilot repositories

### Intended architecture notes (future)

A future implementation will likely use:

- `.playbook/runtime/history`
- `.playbook/runtime/cycles`
- pattern candidate artifacts
- a deterministic pattern compaction pipeline

Rule — Pause Major Capability Until Data Quality Is Stable

Cross-repo intelligence should only begin after runtime observability, scan boundaries, and artifact schemas are proven stable across multiple repositories.

Pattern — Evidence Before Learning

Playbook should treat runtime artifacts as evidence and only derive reusable patterns after deterministic normalization and compaction.

Failure Mode — Learning From Noisy Repositories

If cross-repo learning begins before scan boundaries and ignore semantics are stable, the system will learn from build artifacts, generated files, and repository noise rather than durable engineering structure.

---

## Implemented recently: artifact hygiene and storage governance

The following improvements are now implemented in the command surface:

- Artifact classification model for runtime, automation, and contract artifacts.
- `.playbookignore` scan controls for repository intelligence generation.
- `doctor` artifact hygiene diagnostics and structured suggested fixes.
- `plan`/`apply` remediation IDs for artifact governance workflows (`PB012`, `PB013`, `PB014`).

---

## Staging candidates: Zettelkasten-attractor runtime convergence

These are runtime implementation follow-ups for the RunCycle + zettelkasten architecture model. They are backlog-only and not roadmap expansion in this pass.

- Build a deterministic zettel-to-pattern compactor that aggregates linked zettels into candidate/stabilized pattern cards.
- Define convergence thresholds (minimum linked evidence count, recurrence windows, contradiction tolerance) for stabilization eligibility.
- Add novelty-vs-reuse metrics to score whether new evidence should create a new attractor or reinforce an existing one.
- Enforce entropy budgets during compaction so evidence compression does not remove required discriminators.
- Add attractor-graph drift detection to surface over-merge, stale invariants, and contract-pattern divergence across cycles.



## Staging candidates: Canonical-core enforcement budgets

These items are future enforcement budgets and are intentionally backlog-only in this phase (docs/telemetry first; no hard gates yet).

- Define canonical core size budget boundaries per repository profile.
- Define max contract mutations per cycle to prevent doctrine churn.
- Define max unresolved draft age to bound provisional frontier staleness.
- Define forced topology compression threshold to prevent persistent frontier sprawl.

Rule: No knowledge layer may grow in authority faster than it shrinks in volume.
Pattern: A reasoning engine stays healthy by maintaining a small canonical core and a large provisional frontier.
Failure Mode: When canonical layers expand too quickly or provisional layers never compress, the system collapses into doctrine thrash or structured clutter.

---

## Backlog candidate: Bloch-style state-space telemetry

Add deterministic telemetry fields to improve cycle-level state diagnostics:

- coherence score
- ambiguity score
- collapse frequency
- drift after measurement
- noise-to-signal ratio in zettels

Scope notes:

- This is a deterministic state-space observability enhancement, not quantum runtime behavior.
- Metrics should be computed from existing Playbook artifacts (`verify`, RunCycle, zettels, compaction/promotion outcomes).

Rule: Use quantum/state-space language only when it clarifies deterministic system behavior.
Pattern: State can often be modeled more clearly as geometry than as raw event logs.
Failure Mode: Overextending the Bloch-sphere analogy turns a useful state-space model into pseudo-physics.

---

## Backlog candidate: graph-memory deterministic convergence runtime

Add graph-memory follow-ups to formalize deterministic memory structure and compaction:

- deterministic edge builder for RunCycle/artifact/zettel/pattern/contract lineage edges
- deterministic contraction pass from evidence vertices to stable attractor vertices
- WCC-based formal grouping for production-safe connected-component convergence
- offline Louvain/Leiden exploratory clustering only (diagnostic, non-critical path)
- graph telemetry and entropy budget enforcement across hot/warm/cold memory tiers

Rule:
Durable memory is not a bag of notes; it is a typed graph with preserved lineage and controlled contraction.

Pattern:
Memory compression in Playbook should happen through deterministic graph contraction from many evidence nodes into fewer stable attractor nodes.

Failure Mode:
If every zettel becomes a permanent vertex and nothing contracts, the graph becomes infinite in intake but useless in working memory.
