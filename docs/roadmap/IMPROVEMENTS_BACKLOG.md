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

Related long-term architecture reference: `docs/architecture/PLAYBOOK_PLATFORM_ARCHITECTURE.md`.

---

## Staging candidates: Product truth packaging and narrative sync

These backlog candidates feed roadmap track `PB-V1-PRODUCT-TRUTH-PACKAGING-001` without implying live command-surface changes in this pass.

- Add a generated command truth table framing commands as canonical workflow, compatibility-only, or utility surfaces.
- Add narrative drift checks that compare runtime/help/docs/demo/roadmap language for planned-vs-live consistency.
- Add explicit `ask --repo-context` question-boundary examples (in-scope and unsupported) for deterministic operator expectations.
- Add demo/onboarding synchronization checks so ladder guidance stays aligned with implemented contracts.

---

## Platform direction: Packaging / SKU Architecture consistency

Backlog scope (directional, not current-sprint commitment):

- Define SKU capability boundaries for Open Core, Team, and Enterprise over one deterministic runtime.
- Add packaging-to-architecture consistency checks across strategy, roadmap, architecture, and contract surfaces.
- Add open-core proof-of-value guardrails so free/local workflows remain strong trust/activation surfaces.
- Define team coordination surface taxonomy (shared visibility, policies, PR checks, remediation history, governance reporting direction).
- Define enterprise trust surface taxonomy (tenant governance, RBAC/SSO direction, approvals/auditability, compliance packs, deployment controls).
- Define packaging/deployment parity rules across hosted and self-hosted/boundary-controlled models.
- Define optional services policy and discovery role so services accelerate adoption without becoming the product moat.

Pattern: Packaging follows architecture.
Pattern: Open Core proves trust; paid layers scale coordination/governance.
Rule: SKU boundaries must not change runtime semantics.
Rule: Cloud remains optional; local-only operation remains valid.
Failure Mode: Cloud-first SKU fork of deterministic runtime truth.
Failure Mode: Free tier too weak to prove deterministic value.

---

## Research synthesis summary (platform direction labels)

- Pattern: Shared Core + Project-Local Intelligence
- Pattern: Conversation-to-Knowledge Pipeline
- Pattern: Verification as Trust Boundary
- Pattern: Knowledge Compaction Pipeline
- Rule: Repo-local facts stay local; only sanitized reusable patterns move upstream
- Rule: Bounded capability routing beats one undifferentiated agent
- Failure Mode: Chat Without Memory
- Failure Mode: Distributed Policy Without a Control Plane
- Failure Mode: Evidence-poor automation
- Failure Mode: Best-effort downstream checks create false confidence

These labels are long-term architecture/backlog framing only and do not modify the current 4-week execution plan.

---


## Platform direction: Metrics / ROI / Proof-of-Value architecture

Backlog scope (directional, not current-sprint commitment):

- Define canonical trust metric definitions and thresholds for deterministic workflows.
- Add ROI baseline capture templates for before/after pilot measurement windows.
- Add pilot proof-of-value scorecards with evidence-link requirements.
- Define governance impact measurement contracts with provenance fields.
- Define team coordination measurement model for onboarding/review/routing outcomes.
- Define enterprise audit/approval value measurement model for governance throughput and traceability.
- Define per-repo to workspace/team/tenant aggregation rules that preserve explainability.

Pattern: Proof of Value Follows Deterministic Evidence.
Pattern: Trust Before ROI Scale.
Pattern: Multi-Layer Value Model (Individual, Team, Enterprise).
Rule: Measure outcomes, not just activity.
Rule: ROI claims require baseline + attribution.
Rule: Governance metrics must preserve provenance and per-repo explainability.
Rule: Unsafe speed is not product value.
Failure Mode: Vanity usage metrics mistaken for value.
Failure Mode: ROI claims without baseline.
Failure Mode: Cloud-only instrumentation biasing product strategy.
Failure Mode: Fast but unsafe automation looking “successful” in dashboards.
Failure Mode: Aggregated metrics that lose per-repo evidence lineage.

---

## Platform direction: Session + Evidence prerequisites

Backlog scope (explicitly directional; not an active delivery commitment):

- Define a deterministic **session artifact contract** that captures actor, refs, command chain, consumed/produced artifacts, findings, approvals, and links to PR/CI/issue context.
- Define an **evidence graph** contract that links deterministic source artifacts and command outputs to findings, plans, apply traces, verify outcomes, and approval decisions.
- Define **repo longitudinal state** stitching across sessions so repeated outcomes can be compared without weakening repository-local privacy boundaries.
- Define a deterministic **knowledge promotion pipeline** where candidate memory/pattern promotion is evidence-bound, provenance-preserving, and policy-gated.

Pattern: Evidence Before Memory.
Rule: Policy and approvals precede autonomous execution.
Failure Mode: Agent runtime expansion before trust primitives.
Failure Mode: Memory without evidence.

---
## Platform direction: Repository Longitudinal State Model

Backlog scope (directional, not current-sprint commitment):

- Define deterministic repository identity + run lineage contract across repeated cycles.
- Version longitudinal memory schema for recurring findings, remediations, and outcomes.
- Add lifecycle/retention classes so historical state remains bounded and auditable.
- Add deterministic drift signals that compare current run state to longitudinal baseline.
- Add recurring-finding clustering contracts.
- Add candidate pattern extraction contracts from repeated evidence bundles.
- Add a promotion review queue for human-reviewed knowledge promotion.
- Add provenance-preserving knowledge compaction contracts.
- Add demotion/supersession rules when promoted knowledge is contradicted.
- Add stale-knowledge detection and expiration signals.
- Add repo health timeline and trend tracking surfaces.

Pattern: Repository Learning Is Longitudinal, Not Session-Isolated.
Pattern: Human-Reviewed Knowledge Promotion.
Pattern: Compaction With Provenance.
Rule: Candidate knowledge is not enforced governance until reviewed.
Rule: Knowledge must be demotable when contradicted or stale.
Failure Mode: Memory blob without structure.
Failure Mode: Accumulating logs instead of compacting knowledge.

Rule: Longitudinal state must strengthen deterministic reasoning rather than creating unbounded memory sprawl.

---

## Platform direction: Knowledge Compaction and Promotion Pipeline

Backlog scope:

- Formalize conversation-to-knowledge promotion gates (`draft -> reviewed -> promoted`).
- Encode deterministic compaction from repeated observations into reusable pattern candidates.
- Require evidence provenance links on any promoted pattern/rule/contract artifact.
- Add retirement/supersede semantics to prevent stale pattern accumulation.

Pattern: Knowledge compaction is the bridge between repeated observations and trusted reusable guidance.

---

## Platform direction: Evidence Graph / Trust Model

Backlog scope:

- Define evidence graph contracts linking observation, remediation plans, execution traces, and verify outcomes.
- Add trust-state fields that distinguish observed facts vs inferred guidance vs promoted reusable patterns.
- Define fail-closed trust behavior when evidence is incomplete, contradictory, or stale.

Rule: Verification remains the trust boundary for mutation and promotion actions.

---

## Platform direction: Control Plane / Approval Model

Backlog scope:

- Define approval-state contracts across CLI, CI, PR, and API execution surfaces.
- Define explicit permission/mutation boundaries per actor and capability.
- Add deterministic deny paths when required approvals or policy context are missing.
- Add an explicit **approval policy model** with actor-aware escalation (`automatic -> human approval -> owner/security approval`).
- Add a canonical **mutation-scope taxonomy** (`Level 0` through `Level 4`) for deterministic action classification.
- Add deterministic **adapter policy boundaries** so integration-specific behavior cannot leak into core runtime policy semantics.
- Add explicit **export/sync policy** contracts that keep repo-local facts local unless intentionally promoted/exported.
- Add enforceable **fail-closed rules** for ambiguous policy, incomplete verification, missing approvals, or stale/contradictory evidence.

Pattern: Policy Follows Evidence.
Pattern: Control Plane Before Autonomy.
Rule: Verification remains the trust boundary.
Rule: Repo-local facts stay local unless intentionally promoted.
Rule: Ambiguous policy or incomplete verification must fail closed.
Failure Mode: Tool autonomy before policy boundaries.
Failure Mode: Session evidence without enforcement.
Failure Mode: Adapter-specific behavior leaking into core runtime.
Failure Mode: Memory/export behavior implied without explicit opt-in.
Failure Mode: Distributed policy logic across tools without a shared control plane creates inconsistent governance outcomes.

---


## Platform direction: PR Review Loop Architecture

Backlog scope:

- Define canonical review finding taxonomy (`architecture drift`, `risk/blast radius`, `missing tests`, `documentation gaps`, `rule/contract violations`, `remediation candidates`, `prevention targets`).
- Define bounded autofix eligibility classes and map them to control-plane mutation scopes.
- Define mandatory review evidence linkage for comments, suggestions, and escalation decisions.
- Define deterministic escalation policy for ambiguous, high-risk, or policy-blocked review findings.
- Define re-verification contract after any candidate mutation path in PR review workflows.

Pattern: Review Loop Over Deterministic Artifacts.
Pattern: Evidence-Attached PR Intelligence.
Pattern: Thin Review Interfaces Over One Runtime.
Rule: Re-verify after any candidate mutation.
Rule: Only bounded low-risk classes may be autofix-eligible.
Rule: Ambiguous review outcomes fail closed.
Failure Mode: Review comments without evidence lineage.
Failure Mode: PR autofix before policy/mutation-scope checks.
Failure Mode: Adapter-specific review behavior leaking into core semantics.
Failure Mode: Broad agent UX shipped before review-loop trust hardening.

---


## Platform direction: Knowledge Query / Inspection Surfaces for Memory

Backlog scope (directional, not current-sprint commitment):

- Add deterministic memory query schema for read-only inspection outputs.
- Add provenance trace inspection surfaces linking memory records to evidence bundles.
- Add candidate/promoted knowledge comparison views with explicit class boundaries.
- Add stale/superseded knowledge inspection views.
- Add repo timeline/trend inspection surfaces for longitudinal change visibility.
- Add validated server/API read surfaces for knowledge inspection that preserve control-plane governance.

Pattern: Inspectable Memory Before Automated Memory Consumption.
Pattern: Queryable Repository Knowledge.
Pattern: Provenance-Preserving Inspection.
Rule: Candidate knowledge must remain distinguishable from promoted governance.
Rule: Memory query surfaces are read-only intelligence surfaces.
Rule: Repo-local knowledge remains private-first unless intentionally promoted/exported.
Failure Mode: Memory exists but cannot be trusted or inspected.
Failure Mode: Free-form memory blob without deterministic inspection contracts.
Failure Mode: Automation consumes knowledge before humans can inspect provenance.
Failure Mode: Query surfaces imply enforcement.

---

## Platform direction: Automation Synthesis consuming governed/promoted knowledge

Backlog scope (directional, not current-sprint commitment):

- Define governed knowledge eligibility rules for synthesis inputs.
- Define a synthesis context packaging contract with explicit candidate/promoted class separation.
- Define provenance-linked automation generation contracts that attach knowledge/evidence lineage.
- Define stale-knowledge exclusion and explicit override policy contracts.
- Define synthesis outcome feedback contracts into repo longitudinal memory.
- Define template-to-knowledge input contracts for approved pattern families and required metadata.

Pattern: Governed Knowledge Before Automation.
Pattern: Inspectable Knowledge as Synthesis Input.
Pattern: Provenance-Linked Automation Generation.
Rule: Automation Synthesis may only consume governed/promoted knowledge.
Rule: Candidate knowledge is not automation-grade input.
Rule: Verification remains the trust boundary.
Rule: Repo-local knowledge stays local unless intentionally promoted.
Failure Mode: Automation synthesized from raw chat memory.
Failure Mode: Candidate knowledge operationalized before review.
Failure Mode: Provenance-free automation generation.
Failure Mode: Cross-repo leakage through synthesis context.
Failure Mode: Automation consumes stale or superseded knowledge.

---


## Platform direction: Outcome Feedback + Automation Runtime Learning

Backlog scope (directional, not current-sprint commitment):

- Define a canonical automation outcome taxonomy (success, partial success, verification failure, policy rejection, rollback/deactivation, later regression, false positive, false negative, stale template/knowledge, operator correction).
- Define provenance-linked outcome feedback artifacts and evidence bundle contracts.
- Add template-quality and pattern-quality confidence tracking from repeated runtime outcomes.
- Add recurring rollback-pattern mining and candidate rollback-heuristic proposals.
- Add stale-knowledge detection signals derived from runtime outcomes and verification lineage.
- Add candidate promotion/demotion/supersession review queue for automation-derived learning artifacts.
- Add repo health trend updates driven by runtime outcome classes over time.

Pattern: Runtime Outcomes Become Evidence.
Pattern: Closed Learning Loop With Human-Reviewed Promotion.
Pattern: Rollback Events Are Learning Signals.
Rule: Verification remains the trust boundary.
Rule: Outcome feedback may refine candidate knowledge, not auto-promote governance.
Rule: Repo-local runtime learning stays local unless intentionally promoted.
Failure Mode: Self-modifying automation without review.
Failure Mode: Runtime feedback without provenance.
Failure Mode: Success metrics mistaken for governance truth.
Failure Mode: Hidden telemetry disguised as learning.
Failure Mode: Template/policy mutation driven by opaque outcome signals.

---

## Platform direction: Governed Cross-Repo Pattern Promotion / Transfer

Backlog scope:

- Define a transferable pattern package schema (identity, provenance, evidence summary, sanitization status, compatibility metadata, risk class, failure modes, demotion/supersession fields).
- Define sanitization/generalization contracts for reusable pattern extraction that prevent direct transfer of raw repo-local facts.
- Define pattern compatibility metadata contracts (repo type, architecture constraints, applicability scope, fail-closed behavior on mismatch).
- Define receiving-repo import review flow contracts (imported pattern -> local candidate -> optional local promotion).
- Define transfer recall/demotion model for bad or superseded transferred patterns.
- Define explicit upstream core promotion paths for approved reusable patterns and product-gap intelligence.
- Define privacy-safe reusable pattern library direction without hidden telemetry, automatic sync, or opaque global memory pooling.

Pattern: Local Learning, Governed Promotion, Scoped Transfer.
Pattern: Transferable Pattern Packages.
Pattern: Compatibility-Gated Cross-Repo Reuse.
Rule: Repo-local facts never transfer directly.
Rule: Imported reusable patterns are candidate inputs until locally reviewed.
Rule: Transfer must preserve provenance and sanitization status.
Rule: Bad transferred patterns must be recallable/demotable.
Failure Mode: Global memory blob disguised as product intelligence.
Failure Mode: Repo-local workaround promoted as universal doctrine.
Failure Mode: Cross-repo transfer without sanitization.
Failure Mode: Imported pattern treated as enforced governance by default.
Failure Mode: Hidden telemetry disguised as learning.


---

## Platform direction: Governed Interface / API Surfaces for Multi-Repo Control Planes

Backlog scope:

- Define canonical control-plane request envelope contract (actor, scope, operation, mode, idempotency/session identity, evidence/policy context, approval context, output format).
- Define deterministic multi-repo batch-read semantics with composed per-repo outputs.
- Define per-repo evidence drill-down contracts for aggregated control-plane views.
- Define server-side validated action surfaces for dashboards/internal platforms/CI control planes.
- Define actor and permission taxonomy for governed interface/API actions.
- Define idempotency/session contracts for API actions and retries.
- Define batch mutation guardrails and exceptional-policy requirements.
- Define optional hosted/self-hosted control-plane deployment model that preserves CLI-first/offline/private-first baselines.

Pattern: Thin Interfaces Over One Deterministic Runtime.
Pattern: Multi-Repo Control Planes Coordinate, They Do Not Collapse Repo Boundaries.
Pattern: Aggregation With Per-Repo Evidence Drill-Down.
Rule: Browser clients use validated server/API actions, not arbitrary CLI execution.
Rule: Repo-local facts stay local unless intentionally promoted/exported.
Rule: Aggregated control-plane views must preserve per-repo provenance.
Rule: Batch mutation is exceptional and strongly policy-gated.
Failure Mode: Cloud shell disguised as control plane.
Failure Mode: Aggregated UI that loses per-repo evidence lineage.
Failure Mode: Browser-side arbitrary command execution.
Failure Mode: One repo’s local policy silently becoming org-wide truth.
Failure Mode: Multi-repo data pooling without explicit governance.

---

## Platform direction: Workspace / Tenant Governance + Optional Hosted Deployment Model

Backlog scope:

- Define policy inheritance model across core defaults, tenant defaults, workspace scope, and repo-local adoption authority.
- Define workspace/repo boundary contract so aggregated views preserve per-repo evidence drill-down.
- Define tenant/org RBAC direction for developer, reviewer, workspace maintainer, org admin, and automation actors.
- Define hosted vs self-hosted parity guarantees for governance semantics.
- Define data-flow classification for hosted aggregation (governed summaries/artifacts by default, explicit export for broader data movement).
- Define repo-local override and escalation rules with fail-closed conflict handling.
- Define workspace-level audit and approval view contracts with provenance-linked policy source visibility.

Pattern: Optional Hosted Layer Over Deterministic Local Core.
Pattern: Workspace Aggregation With Per-Repo Accountability.
Pattern: Policy Inheritance With Local Adoption Authority.
Rule: Deployment model must not change governance semantics.
Rule: Cloud must remain optional.
Rule: Repo-local facts stay local unless explicitly governed for export/aggregation.
Rule: Workspace and tenant views must preserve per-repo evidence drill-down.
Failure Mode: SaaS-first drift that weakens local trust.
Failure Mode: Hosted aggregation without provenance.
Failure Mode: Tenant policy silently overriding repo-local governance without visibility.
Failure Mode: Self-hosted tier receiving weaker guarantees than hosted.
Failure Mode: Cloud control plane becoming the only real product.

---

## Platform direction: Capability / Model Routing Layer

Backlog scope:

- Define bounded capability routing contracts by task class and risk tier.
- Route intelligence/remediation tasks to explicit capability lanes instead of one undifferentiated agent loop.
- Add auditable routing decisions tied to policy/evidence requirements.

Rule: Bounded capability routing beats one undifferentiated agent for deterministic governance.

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
