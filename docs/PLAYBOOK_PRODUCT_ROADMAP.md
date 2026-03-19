# PLAYBOOK - 12 MONTH PRODUCT ROADMAP

Deterministic Repo Runtime and Trust Layer for Software Engineering

## Mission

Build the deterministic runtime and trust layer between humans/AI agents and real repositories.

Truth-boundary note: this document captures **future intent and sequencing**. For current command implementation truth, use `docs/commands/README.md`. For machine-readable committed delivery state, use `docs/roadmap/ROADMAP.json`.

## Document job and alignment boundaries

This roadmap defines strategic product direction and sequencing only.

- Roadmap: strategic direction and maturity sequencing.
- Business strategy: monetization and go-to-market sequencing in `docs/PLAYBOOK_BUSINESS_STRATEGY.md`.
- SKU packaging: architecture of Open Core -> Team -> Enterprise in `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`.
- Metrics and proof-of-value: deterministic measurement contract in `docs/architecture/PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md`.
- Rollout architecture: trust-maturity stage gates in `docs/architecture/PLAYBOOK_PILOT_DESIGN_PARTNER_AND_ROLLOUT_ARCHITECTURE.md`.

Pattern: Product Story Follows Architecture.
Rule: Roadmap sequencing must preserve CLI-first, offline-capable, private-first operation.
Failure Mode: Business docs drifting away from runtime truth.

## Strategic direction

Recent implementation note: deterministic promotion receipts now accompany `pnpm playbook promote story ...` and `pnpm playbook promote pattern ...`, persisting audited `promoted` / `noop` / `conflict` outcomes to `.playbook/promotion-receipts.json` and making promotion an explicit audited write boundary visible through Observer artifact inspection.

Recent implementation note: fleet-level readiness aggregation is now available in current command surfaces (`pnpm playbook status fleet --json`, Observer `GET /api/readiness/fleet`, and Observer dashboard fleet summary card) to prioritize cross-repo adoption without replacing repo-first workflows.
Recent implementation note: deterministic adoption work-queue planning is also available (`pnpm playbook status queue --json`, Observer `GET /api/readiness/queue`, and Observer dashboard work-queue panel) to translate readiness state into ordered, wave-based, parallel-safe execution plans.
Recent implementation note: Codex-ready execution packaging now layers on top of the queue (`pnpm playbook status execute --json`, Observer `GET /api/readiness/execute`, and Observer dashboard execution-plan card) to emit wave-scoped worker lanes and copy-paste prompts for parallel repo operations.

Playbook continues to ship as a deterministic repository intelligence and governance CLI, while deepening into a deterministic reasoning engine behind stable command contracts.

Positioning guardrails:

- Keep command-surface reliability stable while reasoning depth grows.
- Control-plane milestone: `pnpm playbook orchestrate` is now implemented as deterministic lane-contract generation (goal -> ownership-bounded lanes -> wave/dependency ordering -> worker prompt artifacts) while preserving non-autonomous boundaries (no worker launch/branch/PR/merge execution).
- Preserve deterministic runtime and trust-layer identity across all phases.
- Expand by trust maturity (`read-only -> verify-only -> low-risk plan/apply -> PR/CI -> workspace/team governance -> org/tenant governance`), not by feature sprawl.

## Rollout architecture doctrine (single-roadmap alignment)

Canonical rollout architecture reference: `docs/architecture/PLAYBOOK_PILOT_DESIGN_PARTNER_AND_ROLLOUT_ARCHITECTURE.md`.

Canonical dependency-ordered architecture index reference: `docs/architecture/PLAYBOOK_FINAL_ARCHITECTURE_MAP_AND_CANONICAL_DEPENDENCY_INDEX.md`.

Roadmap layering rule:

- the Final Architecture Map is the dependency-ordered index over roadmap architecture layers
- this roadmap remains the single strategic roadmap doctrine for sequencing and commitment posture
- control-plane adoption must be staged over proven repo-level trust boundaries

Playbook sits between humans/AI coding agents and repositories as a contract-first operating layer.

Humans + AI Agents
↓
Playbook
↓
Repository

CORE PRINCIPLES

These rules guide all development decisions.

1ï¸âƒ£ CLI First

Playbook must always function:

locally

offline

inside CI

Cloud must never be required.

pnpm playbook init
pnpm playbook analyze
pnpm playbook verify

must always work independently.

2ï¸âƒ£ Deterministic Governance

Rules must be:

explicit

predictable

CI-friendly

Avoid "AI guessing" for core enforcement.

CI contract stance:

- `pnpm playbook verify --json` is the canonical repository validation gate in CI.
- CI should enforce product correctness, not automation maintenance.
- Maintenance automation (for example `agents:update`, `agents:check`, docs audit) should run in dedicated scheduled/on-demand maintenance workflows.
- Cross-repo demo refresh automation should run as PR-based scheduled/on-demand maintenance workflows (not inside the main correctness CI gate).
- Rule: Generated artifacts must be regenerated before they are validated in any refresh/build/release pipeline.
- Rule: Generated artifacts must be produced in staging and promoted only after validation succeeds.
- Pattern: Shared staged-artifact orchestration should provide generation isolation, candidate validation, and gated promotion.
- Failure Mode: Environment-sensitive generation paths and direct committed-output writes undermine deterministic artifact governance.
- Pattern: Generate → validate → promote is the default artifact pipeline shape.
- Failure Mode: Validating stale generated artifacts before regeneration creates false-negative pipeline failures and circular recovery paths.

Failure Mode: If CI mixes product validation with maintenance tasks, pipelines become slow and fragile.

3ï¸âƒ£ Knowledge Lifecycle (Internal-First)

Every meaningful engineering change should produce evidence, but evidence is not automatically reusable knowledge.

Playbook must enforce a deterministic knowledge lifecycle:

Observation / Extraction
â†“
Canonicalization
â†“
Deterministic Comparison
â†“
Bucketing / Compaction
â†“
Promotion
â†“
Retirement

Reasoning-engine lifecycle bridge (implementation-facing):

`evidence -> zettels -> graph -> groups -> candidate patterns -> draft pattern cards -> promotion decisions -> contracts`

Lifecycle stage intent:

- **Observation / Extraction**
  - capture raw findings from repository/runtime analysis
  - treat outputs as evidence-oriented signals, not reusable guidance
- **Canonicalization**
  - normalize wording/shape into stable, comparable candidates
  - remove unstable tokens and incidental phrasing
- **Deterministic Comparison**
  - compare canonical candidates against existing compacted knowledge with stable rules
  - reject ad-hoc/manual semantic matching paths
- **Bucketing / Compaction**
  - classify candidate outcome deterministically (`discard`, `attach`, `merge`, `new candidate`)
  - act as the trust-preserving bridge between extraction and promotion
- **Promotion**
  - elevate only validated compacted knowledge into reusable patterns/rules/contracts
  - require stricter trust thresholds than raw observation
- **Retirement**
  - deprecate, supersede, merge away, or remove stale/duplicative knowledge artifacts under explicit policy
  - prevent knowledge drift and duplication over time

Why this matters

Playbook is a deterministic engineering intelligence runtime, not an unbounded memory accumulator. Uncontrolled pattern accumulation degrades determinism, retrieval quality, and operator trust.

Rule: Treat extracted knowledge as evidence first, reusable knowledge second.

Status update: telemetry → repository memory → learning compaction → improvement recommendations → knowledge inspection is now implemented as a deterministic runtime pipeline; current roadmap focus is hardening, governance quality, and promotion policy depth rather than introducing a parallel learning path.

Recent implementation note: `pnpm playbook learn doctrine --json` now adds a report-only post-merge extraction surface for reusable Rule / Pattern / Failure Mode suggestions, notes-update guidance, and future verification candidates seeded from real merged work, while preserving human-reviewed promotion boundaries.

Rule: Promotion must only happen after canonicalization, deterministic comparison, and compaction.
Pattern: Internal-first knowledge lifecycle before public command expansion.
Pattern: Compaction is the trust-preserving bridge between extraction and promotion.
Failure Mode: Unbounded pattern accumulation turns deterministic intelligence into low-trust memory sprawl.
Failure Mode: Promoting observations directly into reusable guidance without lifecycle gates causes duplication and semantic drift.

Toroidal Flow framing (additive overlay):

- Treat the lifecycle as a deterministic closed loop: `observe -> verify -> plan -> apply -> extract -> canonicalize -> compact -> promote -> retire`.
- Preserve current runtime command ladders; this is an architecture model overlay, not a command rename.
- Treat `apply` as midpoint in full-cycle architecture framing.
- Allow only promoted knowledge to re-enter future context assembly; raw extracted findings are evidence, not reusable context.
- Keep promotion/retirement optional and governance-gated, not mandatory on every cycle.

Architecture artifact alignment (Toroidal Flow + Knowledge Compaction):

- Pattern artifact: `patterns/pattern.closed_loop_intelligence.md`
  - captures the closed-loop architecture as a deterministic lifecycle from observation through retirement
  - reinforces the invariant that `apply` is midpoint, not endpoint
- Rule artifact: `rules/rule.intention_over_retention.md`
  - constrains retention to cycle intention and reusable knowledge extraction outcomes
- Rule artifact: `rules/rule.smallest_predictive_pattern.md`
  - requires pattern storage to remain abstraction-first and minimally predictive
- Principle artifact: `architecture/principle.graph_before_theory.md`
  - anchors higher-order abstraction on stable relationship substrates
- Principle artifact: `architecture/principle.state_transformation_relation.md`
  - codifies the primitive model `State -> Transformation -> Relational Influence` for system framing

Implementation foundation (internal):

- Introduced internal knowledge artifact model representing `candidate -> compacted -> promoted -> retired` lifecycle states.
- Added deterministic artifact ID generation based on canonicalized representation.
- Established evidence-linked knowledge artifacts to preserve traceability to source observations/rules/remediations/repo structure evidence.
- Implemented lifecycle helpers that enforce valid transitions and support supersede relationships.
- Positioned lifecycle infrastructure as internal-only groundwork without expanding the public CLI knowledge-management surface.

## Minimal reasoning engine first (proof before expansion)

Playbook roadmap execution must prove one complete closed-loop reasoning engine before broadening scope to generalized cross-domain automation.

Minimal closed loop target:

`observe -> atomize -> connect -> compress -> govern -> enforce -> reflect`

Phased rollout requirement:

- **Phase 1**: self-host on Playbook
- **Phase 2**: bounded pilot on Fawxzzy Fitness
- **Phase 3**: controlled cross-repo transfer

Roadmap stance:

- prioritize phased proof over premature generalization
- keep early pilot boundaries explicit (include/exclude surfaces)
- promote only what passes deterministic governance and review gates

Rule:
Prove one complete closed-loop reasoning engine before expanding scope to generalized cross-domain automation.

Pattern:
A strong pilot repo improves both the product being built and the reasoning engine observing it.

Failure Mode:
Using a second repo too early without bounded rollout turns a proving ground into a noise amplifier.

## External Pilot Integration â€” Fawxzzy Fitness

Roadmap checkpoint: first-class external targeting (`--repo`) and one-command baseline external analysis via `playbook pilot --repo <path>` are implemented; treat this section as sequencing context, not canonical live command status

This roadmap slice establishes the next operator-safe migration layer for running Playbook from this repository against the primary external pilot repository while preserving legacy pilot tooling until parity is proven.

Current slice establishes:

- coexistence-first migration policy for external pilot rollout
- legacy Playbook inventory framework (`KEEP_TEMPORARILY`, `REPLACE_WITH_NEW_PLAYBOOK`, `INVESTIGATE_USAGE`, `REMOVE_AFTER_PARITY`)
- phased removal strategy (`Coexistence -> Capability Mapping -> Parity Validation -> Controlled Removal`)
- pilot execution contract centered on `pnpm playbook pilot --repo <path>` for first external baseline analysis
- first-class external repository targeting via global `--repo <path>` and command-local `playbook pilot --repo <path>` on canonical command surface
- deterministic artifact generation in external repositories under `<target>/.playbook/`
- coexistence-first pilot execution without legacy removal in the target repository
- fixture-based coverage for external runtime behavior and positional parsing (`--repo <fixture> query modules --json`)
- independent external pilot validation confirms runtime targeting works beyond the Playbook repository (FawxzzyFitness and Nat1-Games)
- deterministic machine-written JSON artifact output for machine-consumed findings/plan flows (`--json --out`) and direct pilot-owned artifact writes (`.playbook/findings.json`, `.playbook/plan.json`)
- deterministic invalid-artifact read guardrails for risk/query flows, including explicit corruption errors and CLI-owned regeneration guidance
- deterministic `.playbookignore` bootstrap/apply workflow via `pnpm playbook ignore suggest` and `pnpm playbook ignore apply --safe-defaults`
- safe-default-only managed `.playbookignore` updates with review-only handling for lower-confidence recommendations
- runtime coverage honors explicit `.playbookignore` rules so follow-up pilot/index cycles reflect tightened scan boundaries

Reference plan:

- `docs/roadmap/EXTERNAL_PILOT_FAWXZZY_FITNESS.md`
- `docs/pilots/FAWXZZY_FITNESS_PILOT_RETROSPECTIVE.md`

Pilot retrospective doctrine now elevates the following priorities:

- external consumer bootstrap proof
- environment/runtime health diagnostics
- next-best-improvement analysis
- post-merge doctrine extraction

Pattern — System -> Interpretation Gap
Deterministic output can still be hard to use when human interpretation cost stays too high.

Pattern — Interpretation Layer
Playbook should derive human-facing summaries from deterministic truth without creating a second source of truth.

Pattern — Progressive Disclosure
Default product surfaces should reveal depth in layers rather than dumping full system density by default.

Pattern — Single Next Action
When evidence is sufficient, product surfaces should converge on one recommended next operator move.

Pattern — State -> Narrative Compression
Dense but correct state should be compressible into readable governed narrative.

Rule — Stabilize Tooling Surface Before Governed Product Work
External runtime/bootstrap reliability must be proven before higher-order governed product work can be treated as complete.

Failure Mode — Correct-but-Dense Truth Reduces Adoption
Correct outputs that require system knowledge to interpret reduce actionability and adoption.

Failure Mode — Superficial Integration Without Bootstrap Proof
A repo can appear integrated while still failing real governed consumption due to missing bootstrap/runtime/artifact guarantees.

Rule â€” Machine-Consumed Artifacts Must Be CLI-Written
If downstream commands read generated JSON artifacts, those artifacts must be written by the CLI itself rather than relying on shell redirection.

Pattern â€” First-Class Artifact Emission
Structured runtime artifacts should be emitted through explicit output flags with controlled encoding, directory creation, and deterministic content boundaries.

Failure Mode â€” Shell Redirect Artifact Corruption
Machine-readable JSON captured through wrappers or shell redirection can be silently corrupted by banner text, encoding differences, or shell behavior.

Failure Mode â€” Opaque JSON Parse Crash
When corrupted runtime artifacts are parsed without a guardrail, later commands fail far from the original write site, making the real bug harder to diagnose.

Pattern â€” Artifact Consumers Treat Prior JSON as Untrusted Input
Commands that consume prior runtime artifacts should treat those files as untrusted inputs and degrade gracefully when artifacts are missing or malformed.

Failure Mode â€” Hidden Optional Artifact Dependency Crash
A secondary command like index can fail because of a hidden dependency on stale or corrupted `.playbook/*.json` artifacts produced by an earlier workflow step.

Rule â€” Canonical Operator Surface
A CLI repo must expose one canonical operator-facing invocation form across docs, templates, generated docs, and roadmap guidance.

Pattern â€” Generator-Level Truth Enforcement
If a documentation surface is generated, command normalization must be fixed at the metadata/generator layer rather than by patching rendered markdown.

Failure Mode â€” Command-Surface Drift
When bare commands, npx flows, and direct internal entrypoints are all shown as if they are equivalent truth, humans and agents start planning against the wrong surface.

Failure Mode â€” External-Repo Coupling
A repo-intelligence system that only works when executed inside its own repo context is not yet a true external runtime.

Rule â€” Optimize for Measurable Coverage, Not Imagined Completeness
A repo-intelligence system should report how much of a repository was analyzable, analyzed, skipped, and unknown instead of claiming total understanding.

Pattern â€” Versioned Runtime Observability
A durable analysis system should store current state, immutable per-cycle snapshots, and compact history rollups so it can reason about both repo state and its own behavior over time.

Pattern â€” Observation / Interpretation Split
Observed facts and derived inferences must be stored separately so analyzer upgrades can be distinguished from repository changes.

Failure Mode â€” Artifact Heap Without Runtime Model
If `.playbook/` only accumulates outputs without cycle boundaries, coverage accounting, and telemetry, the system cannot learn, explain drift, or optimize itself reliably.

Failure Mode â€” False 100 Percent Analysis
If Playbook reports strong conclusions without modeling blind spots, skipped files, unsupported areas, and confidence boundaries, users will overtrust incomplete analysis.

Rule — Scores Must Not Hide Blind Spots
Coverage metrics must expose what was excluded, unsupported, ignored, or unresolved so high scores do not create false confidence.

Pattern — Optimization-Ready Telemetry
Runtime telemetry should summarize the phases, fallbacks, reads/writes, and path classes that matter for deterministic optimization rather than logging raw event noise.

Pattern — Scan Waste Classification
Expensive or low-value scan paths become actionable only when the system classifies them into deterministic categories such as build-cache, vcs-internal, generated-report, or temporary-file.

Failure Mode — Pretty Score, False Confidence
If coverage appears near-perfect while blind spots remain large, the system will overstate repo understanding and mislead future learning layers.

Failure Mode — Telemetry Too Thin to Optimize
If telemetry only records top-level command calls, the system cannot meaningfully optimize scan strategy, cache behavior, or internal execution flow.

## Research track: Pattern Meaning and Knowledge-Graph Evolution (framing)

Status: **Research framing published; not a claim of fully implemented runtime capability.**

This roadmap track formalizes conceptual doctrine for:

- pattern meaning,
- attractor dynamics of meaning stabilization,
- evolutionary dynamics of knowledge graphs.

Canonical artifacts:

- `docs/research/THEORY_OF_PATTERN_MEANING.md`
- `docs/research/ATTRACTOR_MODEL_OF_MEANING.md`
- `docs/architecture/EVOLUTIONARY_DYNAMICS_OF_KNOWLEDGE_GRAPHS.md`

Why this matters:

- strengthens long-horizon architecture coherence for memory/knowledge evolution,
- provides a shared vocabulary for future compaction and promotion features,
- reduces roadmap confusion by explicitly separating theory from implemented command/runtime truth.

Rule: Treat research doctrine and implemented runtime capability as separate layers.
Pattern: Use research docs for conceptual models and architecture docs for runtime mapping.
Failure Mode: Mixing speculative theory with implemented feature claims creates roadmap confusion and weakens trust.

## Next defining capabilities for reasoning-engine maturity

### Meta-Playbook introspection

Playbook should introspect its own reasoning pipeline to detect weak compaction quality, repeated failure motifs, and governance blind spots, then emit bounded improvement proposals as reviewable artifacts.

### Functorial knowledge transforms

Playbook should map validated pattern knowledge into executable surfaces (contracts, docs, CI policy) with structure-preserving, replayable transforms and lineage guarantees.

### Topology/equivalence compression

Playbook should collapse structurally equivalent promoted patterns into canonical representatives so doctrine scales by structure rather than duplicated prose.

Novelty boundary:

Playbook does not claim invention of new raw mathematics. Product novelty is architectural synthesis plus deterministic operationalization of established ideas into everyday engineering governance.

Rule:
Every major subsystem in Playbook must contribute to knowledge formation, compression, governance, or self-reflection.

Pattern:
Playbookâ€™s novelty is architectural synthesis, not isolated invention of underlying theory.

Failure Mode:
Treating Playbook as only a tooling layer hides its real product direction and leads to roadmap underreach.

4ï¸âƒ£ Developer Experience Over Features

Adoption depends on:

Install
Run
Understand
Trust

within 5 minutes.

PRODUCT ARCHITECTURE

Playbook evolves through three layers.

Playbook CLI (Open Source)
â†“
Governance Engine
â†“
Playbook Cloud (Optional)
YEAR 1 OBJECTIVE

## Product positioning (current)

Playbook is positioned as **deterministic repo intelligence + governance + safe remediation runtime**:

- deterministic repo intelligence for humans and AI agents
- governance validation through explicit, CI-enforceable contracts
- safe remediation through reviewed `plan -> apply -> verify` loops
- machine-readable command surfaces for automation and integrations

Current implemented product-facing command/artifact set:

- `analyze`
- `verify`
- `rules`
- `doctor`
- `diagram`
- `plan`
- `apply`
- `playbook-demo` artifact (exposed through `pnpm playbook demo`)
- `ai-context`
- `ai-contract` (`.playbook/ai-contract.json` handshake contract)
- `doctor --ai` AI-contract readiness gate (deterministic validation of contract + intelligence + remediation surfaces)
- repository intelligence (`index`, `query`, `deps`, `ask`, `explain`)
- deterministic architectural risk intelligence (`pnpm playbook query risk <module>`)
- deterministic documentation coverage intelligence (`pnpm playbook query docs-coverage [module]`)
- deterministic rule ownership intelligence (`pnpm playbook query rule-owners [rule-id]`)
- deterministic module ownership intelligence (`pnpm playbook query module-owners [module]`)
- deterministic test hotspot intelligence (`pnpm playbook query test-hotspots`) for candidate-only optimization discovery in validation workflows
- deterministic architecture guardrail audits (`pnpm playbook audit architecture`) for platform hardening coverage
- deterministic knowledge inspection surfaces (`pnpm playbook knowledge ...`) for read-only evidence/candidate/promoted/superseded auditing

## Roadmap framing (current baseline + future enhancements)

Use `docs/roadmap/IMPROVEMENTS_BACKLOG.md` as the staging area for emerging ideas, and keep this roadmap focused on prioritized product capabilities.

Pattern: Single Strategic Roadmap

Only one roadmap exists in the repository: `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.
All idea-level planning belongs in `docs/roadmap/IMPROVEMENTS_BACKLOG.md`.

## Roadmap-as-contract

Machine-readable roadmap commitments are maintained in `docs/roadmap/ROADMAP.json`. CI validates this contract and enforces feature ID references for pull requests in CI contexts.

Roadmap entries describe implementation intent and may include planned command families that are not yet discoverable in current CLI help. Treat `pnpm playbook --help` and implemented command contracts as the source of truth for live command availability.

Toroidal Flow initiative (`PB-V08-TOROIDAL-FLOW-001`) is roadmap-scoped architecture framing that overlays current behavior. It does not introduce runtime behavior changes in this pass.

## Implementation sequencing pass (post-cleanup)

Pattern: Architecture Then Contract Then Implementation
Rule: Build order follows trust and dependency order
Failure Mode: Leaving research mode without execution shape

Canonical sequencing reference:

- strategic sequencing and commitment posture: this roadmap document
- machine-readable contract and dependency-linked feature entries: `docs/roadmap/ROADMAP.json`
- canonical architecture dependency stack: `docs/architecture/PLAYBOOK_FINAL_ARCHITECTURE_MAP_AND_CANONICAL_DEPENDENCY_INDEX.md`

### 1) Implemented baseline

- Deterministic core and repository intelligence substrate are live (`PB-V03-INDEX-001`, `PB-V03-QUERY-001`).
- Deterministic PR analysis and architecture dependency indexing are live baselines (`PB-V04-ANALYZEPR-001`, `PB-V09-FINAL-ARCHITECTURE-MAP-001`).

### 2) Active hardening (current build mode)

- Trust/runtime hardening in flight: plan/apply trust model, package-boundary convergence, delivery-system gating, product-truth packaging, failure-intelligence codification, and v0.8 knowledge compaction foundations (`PB-V04-PLAN-APPLY-001`, `PB-V05-PACKAGE-BOUNDARIES-001`, `PB-V1-DELIVERY-SYSTEM-001`, `PB-V1-PRODUCT-TRUTH-PACKAGING-001`, `PB-V06-FAILURE-INTELLIGENCE-001`, `PB-V08-*`).

### 3) Next buildable slices (dependency-ready after active hardening)

Near-term dependency chain:

1. `PB-V07-ARCH-INTELLIGENCE-GRAPH-001`
2. `PB-V09-ARCHITECTURE-ROLE-INFERENCE-001`
3. `PB-V09-SESSION-EVIDENCE-001`
4. `PB-V09-CONTROL-PLANE-001`
5. `PB-V09-PR-REVIEW-LOOP-001`
6. `PB-V09-LONGITUDINAL-STATE-001`
7. `PB-V09-KNOWLEDGE-QUERY-INSPECTION-001`

Tiny roadmap entry (visibility-first, low-distraction):

- **ID:** `PB-V09-ARCHITECTURE-ROLE-INFERENCE-001`
- **Description:** Extend architecture graph to classify package roles (`interface`, `orchestration`, `foundation`, `adapter`) and validate dependency direction against a deterministic matrix.
- **Status:** `planned`
- **Effort:** `low-medium`
- **Dependencies:** graph extraction, dependency indexing, architecture diagram generation.

Rule worth preserving:

- Observation systems should mature before governance systems.
- Playbook should see clearly before it starts judging architecture.

### 4) Later platform layers (dependency-blocked until prior trust slices are proven)

- Automation and learning extensions: `PB-V09-AUTOMATION-SYNTHESIS-001`, `PB-V09-OUTCOME-FEEDBACK-LEARNING-001`.
- Cross-repo and multi-tenant expansion: `PB-V09-MULTI-REPO-TRANSFER-001`, `PB-V09-GOVERNED-INTERFACE-API-001`, `PB-V09-WORKSPACE-TENANT-GOVERNANCE-001`.
- Broader interface/routing direction remains later and proof-gated: `PB-V09-INTERFACE-SURFACES-001`, `PB-V09-CAPABILITY-ROUTING-001`.

### 5) Product/business overlays (not runtime prerequisites)

- Packaging/SKU, metrics/ROI, and pilot/rollout architecture remain overlay layers scheduled over proven runtime evidence (`PB-V09-PACKAGING-SKU-ARCHITECTURE-001`, `PB-V09-METRICS-ROI-PROOF-OF-VALUE-001`, `PB-V09-PILOT-DESIGN-PARTNER-ROLLOUT-001`).

## Platform evolution: deterministic runtime first, platform second

Playbook develops from **deterministic repo intelligence + governance + remediation runtime** into a broader engineering intelligence platform over time. That growth is layered, dependency-ordered, and explicitly separated from the active delivery window.

Pattern: Platform growth should be layered, not feature-accumulated.
Pattern: Deterministic core first, compounding intelligence second.
Rule: Roadmap must distinguish active delivery from architectural direction.
Rule: Future platform layers should be dependency-ordered before scheduling.
Failure Mode: Research captured in docs but not integrated into roadmap execution shape.
Failure Mode: Roadmap inflation from treating platform direction as near-term commitment.

### Delivery boundary

- **Implemented runtime today**: deterministic repository intelligence, governance validation, risk/docs/ownership intelligence, PR analysis, reviewed `verify -> plan -> apply -> verify` remediation loops, and implemented v0 `orchestrate` control-plane lane-contract artifact generation (not full autonomous orchestration execution).
- **Near-term execution window**: packaging/product-truth sync, delivery-system hardening, command-boundary convergence, external pilot/runtime hardening, and knowledge-compaction foundations already accepted elsewhere in this roadmap and in `docs/roadmap/IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md`.
- **Long-term platform direction**: the layers below describe how the current runtime compounds into a broader engineering intelligence platform.
- **Unscheduled backlog themes**: layers marked outside the near-term execution window are directional/backlog work and are not committed as part of the current 4-week plan.

### Recommended sequencing for later platform layers

1. deterministic runtime hardening (`verify -> plan -> apply`, intelligence artifacts, and contract validation)
2. session envelope + evidence model
3. control plane (policy, approvals, mutation scopes, adapter boundaries, export rules)
4. PR review loop hardening (session/evidence-attached review intelligence + policy-gated actioning)
5. longitudinal learning / knowledge persistence / promotion layers
6. repo-scoped Stories / Backlog system (durable interpretation layer between detection and execution)
7. automation synthesis consuming governed/promoted knowledge
8. outcome feedback / automation runtime learning
9. broader execution orchestration hardening
10. multi-repo transfer (explicit promotion only)
11. governed interface/API surfaces for multi-repo control planes
12. workspace/tenant governance + optional hosted deployment model
13. packaging/SKU architecture (Open Core -> Team -> Enterprise)
14. broader interface surfaces
15. capability / model routing

This ordering is a dependency recommendation, not an active delivery commitment.

### Packaging stance: product layer over one runtime

Packaging is a product-layer framing over the same deterministic runtime/governance architecture, not a separate engine family.

Canonical packaging reference: `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`.

Rule: SKU boundaries must not change core runtime semantics.
Rule: Cloud must remain optional.
Pattern: Same runtime, different operational surfaces.

### Platform layers

#### 1. Observation

- **Already exists today**
  - `index`, `query`, `graph`, `explain`, `ask --repo-context`, `analyze-pr`, `doctor`, and `verify` already produce deterministic repository and governance observations.
  - `.playbook/repo-index.json`, `.playbook/repo-graph.json`, module context artifacts, and findings/plan artifacts provide the present observation substrate.
- **Partially defined**
  - coverage accounting, telemetry shaping, and observation-versus-interpretation boundaries are defined in current roadmap and architecture docs but are not yet a full longitudinal observation system.
- **Future work**
  - richer cycle telemetry, explicit blind-spot accounting, and stronger repository/runtime self-observation.
- **Execution window**
  - inside the current near-term execution window only where observation hardens the deterministic core; broader observation expansion is later.

#### 2. Knowledge Persistence / Compaction

- **Already exists today**
  - internal-first knowledge lifecycle framing, candidate/compacted/promoted/retired artifact modeling, and evidence-linked compaction foundations are already part of the roadmap and architecture direction.
- **Partially defined**
  - candidate extraction, deterministic bucketing, and pattern-card storage are in-progress as internal foundations.
- **Future work**
  - durable knowledge persistence, promotion gates, retirement workflows, and replayable compaction/promotion artifacts.
- **Execution window**
  - inside the near-term window only for current deterministic compaction foundations; broader persistence/promotion runtime is outside the current 4-week plan.

#### 3. Session + Evidence Envelope

- **Already exists today**
  - deterministic command artifacts (`.playbook/repo-index.json`, findings/plan outputs, and verify/apply execution outputs) provide the substrate that a session envelope must compose.
  - repo-scoped workflow continuity now persists in `.playbook/session.json` and supports deterministic `session show/pin/resume/clear` semantics with stale-artifact warnings.
- **Partially defined**
  - evidence-linked findings/plans and trust-boundary language exist, while broader actor/ref/approval/promotion-candidate lineage contracts still need deeper unification across layers.
- **Future work**
  - standardize the Session envelope and Evidence provenance model described in `docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`.
  - require deterministic evidence references for policy decisions, promotion candidates, and future automation synthesis inputs.
- **Execution window**
  - outside the current near-term execution window except for existing remediation/evidence hardening already in progress.

Rule - Workflow continuity must be stored in repo-scoped session state, not implied from transient conversation history.
Pattern - Resumeable systems externalize working memory into inspectable artifacts.
Failure Mode - If workflow memory lives only in chat or human recall, the system cannot scale to agentic iteration.

#### 4. Trust / Evidence Hardening

- **Already exists today**
  - deterministic findings, evidence-linked plans, remediation trust boundaries, and private-first local execution are current product constraints.
- **Partially defined**
  - observation-versus-interpretation split, promotion thresholds, and evidence lineage expectations are documented but not yet a full trust/evidence model across all layers.
- **Future work**
  - evidence scoring, stronger lineage contracts, trust thresholds for promotion/control actions, and richer proof surfaces for platform-level decisions.
- **Execution window**
  - outside the current near-term execution window beyond existing remediation/evidence hardening already underway.

#### 5. Policy / Control Plane

- **Already exists today**
  - `verify`, remediation safety rules, CI validation, and docs/roadmap contract enforcement already function as local deterministic policy gates.
- **Partially defined**
  - approval/policy checkpoints around `apply` and future governance controls are documented as architecture direction.
- **Future work**
  - establish the canonical control-plane architecture in `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md` with explicit actor classes, execution modes, mutation scope levels, approval requirements, adapter boundaries, and locality/export policies.
  - require fail-closed policy enforcement when evidence, approvals, or verification state is incomplete/ambiguous.
- **Execution window**
  - outside the current near-term execution window except for active delivery-system and remediation-hardening work already committed elsewhere.

#### 6. PR Review Loop

- **Already exists today**
  - deterministic `analyze-pr` analysis and reviewed `verify -> plan -> apply -> verify` remediation loops provide the current substrate for PR intelligence and guarded remediation.
- **Partially defined**
  - review finding taxonomy, evidence-linked comment/suggestion contracts, action-class semantics, and escalation policy are not yet fully standardized as one canonical PR review loop.
- **Future work**
  - formalize the PR Review Loop architecture in `docs/architecture/PLAYBOOK_PR_REVIEW_LOOP_ARCHITECTURE.md` so trigger normalization, session creation, artifact hydration, deterministic analysis, evidence attachment, policy gating, bounded autofix eligibility, re-verification, and human escalation share one governed runtime contract.
  - enforce thin review interfaces (CI, PR comments, future UI/API) over the same deterministic runtime and control-plane checks.
- **Execution window**
  - outside the current near-term execution window except for currently implemented deterministic `analyze-pr` and remediation trust hardening.

#### 7. Repo Longitudinal State + Knowledge Promotion

- **Already exists today**
  - deterministic artifacts provide point-in-time evidence (index/findings/plan/apply/verify outputs) and candidate knowledge lifecycle framing.
  - explicit memory lifecycle commands now support replayed candidate promotion into repo-local semantic memory plus deterministic prune workflows for stale/superseded/duplicate artifacts.
- **Partially defined**
  - initial promotion/prune semantics are productized for local semantic memory, while broader repo-level longitudinal state and deeper review contracts remain directional.
- **Future work**
  - formalize the canonical architecture in `docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md`.
  - define schema-governed repo-local longitudinal state (session/review timelines, recurring findings, remediation history, verification outcomes, approvals, recurring failure clusters, unresolved risks, candidate/promoted/superseded knowledge).
  - implement a human-reviewed knowledge-promotion pipeline with provenance-preserving compaction, demotion, supersession, and stale-knowledge handling.
- **Execution window**
  - after Session + Evidence, Control Plane, and PR Review Loop architecture layers; outside the current near-term execution window unless explicitly promoted in roadmap status.


#### 8. Repo-Scoped Stories / Backlog System

- **Why this layer exists**
  - deterministic detection can surface many correct findings, blockers, readiness gaps, architecture issues, and feature opportunities, but those raw outputs are too granular to act as the durable human planning unit.
  - Playbook needs a repo-native interpretation layer that persists across sessions and execution attempts without collapsing findings, plans, workers, and receipts into one artifact.
  - the target shape is `Detection -> Story -> Plan -> Execution -> Receipt`, where Story is the durable repo-scoped action unit and Backlog is the per-repo queue/view over those stories.
- **Already exists today**
  - Playbook now persists canonical repo story state in `.playbook/stories.json` and candidate derivation state in `.playbook/story-candidates.json`, establishing a governed split between durable backlog truth and read-only candidate generation.
  - explicit story promotion is implemented so candidate stories can be grouped/deduped first and then promoted into the canonical backlog instead of auto-converting every finding into a story.
  - Playbook already emits deterministic findings, readiness gaps, execution plans, worker-lane proposals, routing recommendations, and execution receipts that act as evidence inputs for story creation and later story updates.
  - Observer now provides read-only repo backlog visibility sourced from `.playbook/stories.json`, so operators can inspect canonical story state without introducing a second planning system.
- **Partially defined**
  - implemented foundations now exist, but deeper lifecycle seams still need hardening: canonical story schema evolution, deterministic priority scoring, dependency-aware ordering, and richer story-linked execution transitions are not yet the fully unified control-plane model.
  - story-linked routing exists in unreleased notes, but the full `Story -> Plan -> Worker -> Receipt` lifecycle is still only partially connected and needs clearer architectural doctrine across planning and execution surfaces.
- **Future MVP scope**
  - deepen repo-local story storage and manual story creation for human-originated work beyond the current implemented foundation.
  - make story detail the fully governed durable seam for evidence, rationale, acceptance criteria, dependencies, execution lane, and suggested route.
  - add deterministic priority scoring so backlog ordering becomes explainable and stable instead of operator-interpreted only.
- **Future evolution**
  - deepen candidate normalization and dedupe across repeated findings and recurring evidence refreshes.
  - dependency-aware story ordering.
  - deepen `story -> plan` generation and `plan -> worker lane` derivation so story-linked execution becomes a complete governed lifecycle rather than a partial seam.
  - tie receipts, updated-state outcomes, and observed drift back to stories with deterministic lifecycle transitions.
  - optional GitHub issue import/export later, without making external issue systems the canonical source of truth.
- **Non-goals / guardrails**
  - do not build a generic PM suite inside Playbook.
  - do not add sprint planning, assignees, comments, boards, or generic ticket workflow as core scope.
  - do not automatically promote every finding into a first-class story.
  - do not collapse Story, Plan, Worker, and Receipt into one artifact.
- **Execution window**
  - dependency-ordered after session/evidence, control-plane, observer/readiness, and repo-longitudinal-state hardening so the backlog layer can consume stable deterministic evidence.
  - planned as a near-future initiative after current hardening/stabilization work, not as the immediate top priority in the current 4-week execution window.

Pattern: Detection -> Story -> Plan -> Execution -> Receipt.
Pattern: Detection needs durable interpretation.
Pattern: Canonical story state, candidate derivation, and Observer rendering are separate architecture seams.
Pattern: Product roadmap docs must distinguish implemented foundations from future evolution.
Rule: Stories must be structured first, narrative second.
Rule: Product roadmap docs must distinguish implemented foundations from future evolution.
Failure Mode: Backlog spam from raw findings.
Failure Mode: When roadmap docs lag implemented governed surfaces, operator understanding and future planning prompts drift from product truth.

#### 9. Knowledge Query / Inspection Surfaces

- **Already exists today**
  - deterministic read-runtime intelligence surfaces (`index`, `query`, `ask`, `explain`) already establish contract-first inspection behavior for repository intelligence artifacts.
- **Partially defined**
  - repository memory inspection requirements exist directionally in longitudinal-state docs, but there is not yet a canonical architecture slice for deterministic memory query/inspection with provenance-preserving comparison/timeline/staleness views.
- **Future work**
  - formalize the canonical architecture in `docs/architecture/PLAYBOOK_KNOWLEDGE_QUERY_AND_INSPECTION_SURFACES.md`.
  - define deterministic read-only inspection contracts for memory classes (session evidence, repo longitudinal memory, candidate knowledge, promoted governance, and promotable reusable patterns).
  - ensure candidate vs promoted distinction, provenance traceability, and stale/superseded inspection are explicit before broader automation consumption.
- **Execution window**
  - dependency-ordered after Repo Longitudinal State + Knowledge Promotion and before broader automation synthesis or expanded agent/runtime surfaces.

#### 10. Automation Synthesis (Governed Knowledge Consumption)

- **Already exists today**
  - directional architecture/vision language establishes that synthesis remains future-scoped and governance-gated.
- **Partially defined**
  - future synthesis sequencing exists, but first-class governed input eligibility and provenance-linked context packaging contracts were previously implicit across multiple docs.
  - suggestion-only vs mutation-capable synthesis boundary needed explicit contract framing for first implementation slices.
- **Future work**
  - formalize the canonical architecture in `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md`.
  - require synthesis to consume only promoted, inspectable, provenance-linked knowledge artifacts and template contracts once `docs/architecture/PLAYBOOK_KNOWLEDGE_QUERY_SURFACES.md` (Phase 14) is in place.
  - require stale/superseded exclusion rules, explicit override policy, and lineage-attached generation outputs before any operationalization path.
  - Phase 15 thin slice: ship suggestion-generation contracts with policy/provenance/rollback-accountability envelopes, while deferring autonomous mutation/deployment behavior to later phases.
- **Execution window**
  - dependency-ordered after Knowledge Query / Inspection Surfaces and before broader orchestration/interface expansion; remains outside the current near-term execution window unless explicitly promoted in roadmap status.

#### 11. Outcome Feedback + Automation Runtime Learning

- **Already exists today**
  - directional architecture language already requires runtime monitoring, rollback readiness, and evidence-linked automation trust posture.
- **Partially defined**
  - outcome classes, feedback artifact contracts, and candidate-learning boundaries are distributed across docs and not yet formalized as one canonical architecture slice.
- **Future work**
  - formalize the canonical architecture in `docs/architecture/PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md`.
  - define taxonomy-governed outcome classes, provenance-linked feedback artifacts, and repo-local confidence/trend update contracts.
  - require runtime-learning outputs to remain candidate knowledge until explicit human review promotes, demotes, or supersedes governance artifacts.
  - require rollback/deactivation and later regressions to become first-class learning signals with preserved lineage.
- **Execution window**
  - dependency-ordered after Automation Synthesis (Governed Knowledge Consumption) and before broader orchestration/interface expansion; outside the current near-term execution window unless explicitly promoted in roadmap status.

#### 12. Governed Cross-Repo Pattern Promotion / Transfer

- **Already exists today**
  - external repository targeting and bounded pilot execution exist today through `--repo` and `playbook pilot --repo <path>`, while repo-local/private-first boundaries remain explicit.
- **Partially defined**
  - phased proof strategy (`self-host -> bounded pilot -> controlled cross-repo transfer`) is defined, but explicit transfer package, sanitization, compatibility-gating, and recall/demotion contracts were not centralized in one canonical architecture slice.
- **Future work**
  - formalize the canonical architecture in `docs/architecture/PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md`.
  - require transfer to move only intentionally promoted, sanitized, provenance-preserving reusable pattern packages.
  - require receiving repos to treat imports as candidate inputs pending local review/adoption, not auto-enforced governance.
  - define explicit recall/demotion paths for bad transferred patterns and explicit upstream core promotion paths.
- **Execution window**
  - dependency-ordered after Outcome Feedback + Automation Runtime Learning and before broader interface/platform expansion; outside the current near-term execution window unless explicitly promoted in roadmap status.

#### 13. Governed Interface / API Surfaces for Multi-Repo Control Planes

- **Already exists today**
  - CLI-first deterministic runtime contracts and control-plane guardrails establish the base semantics that future server/API wrappers must preserve.
- **Partially defined**
  - directional app/server examples (`/api/playbook/ask`, `/api/playbook/query`, `/api/playbook/explain`, `/api/playbook/index`) exist, but canonical multi-repo request/response envelope, actor taxonomy, and batch semantics were not yet centralized in one architecture slice.
- **Future work**
  - formalize the canonical architecture in `docs/architecture/PLAYBOOK_GOVERNED_INTERFACE_API_SURFACES_FOR_MULTI_REPO_CONTROL_PLANES.md`.
  - require governed interface actions to preserve session/evidence lineage, control-plane policy decisions, and per-repo provenance boundaries.
  - require browser clients to call validated server/API actions only; do not allow arbitrary browser-side CLI execution.
  - keep hosted/cloud control planes optional and avoid turning interface surfaces into generic remote shell behavior.
- **Execution window**
  - dependency-ordered after Governed Cross-Repo Pattern Promotion / Transfer and before broader interface packaging; outside the current near-term execution window unless explicitly promoted in roadmap status.

#### 14. Workspace / Tenant Governance + Optional Hosted Deployment Model

- **Already exists today**
  - control-plane, session/evidence, and governed interface contracts already establish deterministic runtime and per-repo trust boundaries that this layer must preserve.
- **Partially defined**
  - optional cloud/control-plane language exists, but canonical workspace/tenant policy inheritance, override visibility, and hosted-vs-self-hosted parity semantics were not centralized in one architecture slice.
- **Future work**
  - formalize the canonical architecture in `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`.
  - define user/session/repo/workspace/tenant/promotion scope boundaries with explicit policy inheritance and fail-closed conflict rules.
  - keep Playbook Cloud optional and subordinate to CLI-first, offline-capable, private-first local guarantees.
  - require hosted/self-hosted layers to remain coordination packaging over the same deterministic runtime semantics.
  - require workspace/tenant aggregation to preserve per-repo evidence lineage and drill-down accountability.
- **Execution window**
  - dependency-ordered after Governed Interface / API Surfaces for Multi-Repo Control Planes and before broader interface packaging; outside the current near-term execution window unless explicitly promoted in roadmap status.

#### 15. Packaging / SKU Architecture (Open Core -> Team -> Enterprise)

- **Already exists today**
  - open-core CLI-first, offline-capable, private-first deterministic runtime posture and optional hosted-layer language already exist across strategy and architecture docs.
- **Partially defined**
  - monetization ladder language exists, but explicit SKU-to-architecture mapping and cross-SKU invariants were previously distributed across multiple docs.
- **Future work**
  - formalize the canonical architecture in `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`.
  - require Open Core, Team, and Enterprise packaging to route through the same verify/session/evidence/control-plane semantics.
  - require monetization to focus on coordination/governance scale while preserving strong local deterministic value in Open Core.
- **Execution window**
  - dependency-ordered after Workspace/Tenant Governance + Optional Hosted Deployment Model; directional/planned unless explicitly promoted in roadmap status.

#### 16. Review + Execution Orchestration

- **Already exists today**
  - reviewed `verify -> plan -> apply -> verify` execution loops, CLI-first execution, and CI-safe remediation workflows are implemented.
- **Partially defined**
  - serialized plan execution, approval layers, maintenance modes, and automation-synthesis staging are defined as future operating models.
- **Future work**
  - broader orchestration hardening across recurring workflows and policy-gated non-interactive execution, dependency-ordered after governed synthesis, outcome feedback, and governed cross-repo transfer contracts.
- **Execution window**
  - near-term work is limited to current remediation contract hardening; broader orchestration expansion is outside the 4-week plan.

#### 17. Interface Surfaces

- **Already exists today**
  - CLI, JSON command contracts, GitHub/CI formatting surfaces, AI contract/bootstrap artifacts, and demo/docs surfaces are implemented.
- **Partially defined**
  - app-integrated runtime/API surfaces, optional dashboards, and broader operator experiences are described as future directions.
- **Future work**
  - durable API/server surfaces, richer UX layers, and broader interface packaging over the same deterministic runtime.
- **Execution window**
  - outside the current near-term execution window except for current product-truth/documentation packaging work.

#### 18. Capability / Model Routing

- **Already exists today**
  - deterministic routing is presently command- and contract-driven rather than model-driven; Playbook prefers explicit command surfaces and repository intelligence artifacts over open-ended inference.
- **Partially defined**
  - architecture docs describe thin interfaces over trusted runtime layers, but capability-selection and model-routing policy are not yet a committed product surface.
- **Future work**
  - capability routing across deterministic engines, explain/query/reasoning paths, and any future bounded model usage under explicit trust and policy controls.
- **Execution window**
  - outside the current near-term execution window.

### Current planning stance

The active 4-week execution plan remains intentionally focused on already accepted runtime, delivery-system, and compaction-foundation work. The platform layers above provide the dependency-ordered direction for later planning, not a commitment to deliver all layers now.

## Product Truth Packaging and Narrative Sync

The current gap is not a lack of raw deterministic analysis capability. The gap is packaging: explicit canon, priority, discoverability, and synchronization guidance that makes product truth easy to find and hard to misinterpret.

This track exists so humans and AI agents do not need multiple interpretation passes to answer:

- what is canonical
- what is compatibility-only
- what is utility
- what is planned vs live
- what questions `ask --repo-context` is intended to answer

Current commitments (`PB-V1-PRODUCT-TRUTH-PACKAGING-001`):

1. **Canonical workflow contract**
   - publish and validate one authoritative workflow contract for serious-user operation
   - ensure docs/demo/help either reuse the same source or are deterministically checked against it
2. **Command role / lifecycle / discoverability metadata**
   - encode command role, lifecycle state, and discoverability intent in deterministic metadata
   - support generation of a command truth table that separates canonical vs compatibility/utility framing
3. **Narrative sync audit across runtime/help/docs/demo/roadmap**
   - detect drift between implemented command contracts and narrative surfaces
   - keep planned-vs-live language explicit and machine-checkable
4. **`ask --repo-context` question-boundary contract**
   - define intended question classes and explicit unsupported-question behavior
   - keep deterministic repository-intelligence-first sourcing explicit in docs/contracts
5. **Demo/onboarding sync gate**
   - make demo/onboarding narrative drift visible in CI or maintenance validation
   - align onboarding guidance with canonical operating ladder and live command surfaces

Acceptance criteria:

- one authoritative workflow contract exists and is reused by docs/demo/help or validated against them
- command metadata expresses role/lifecycle/discoverability clearly enough to generate a command truth table
- drift between runtime, docs, demo, and roadmap is detectable by deterministic audit
- `ask --repo-context` scope and unsupported-question behavior are documented explicitly
- demo/onboarding drift is visible in CI or maintenance validation

Conservative non-goals for this track:

- no broad autonomous mutation behavior
- no replacement of `verify -> plan -> apply -> verify`
- no new broad command family in this pass
- no public `pnpm playbook knowledge *` command-family expansion until lifecycle and trust contracts are stable
- roadmap intent must not be presented as live command availability

## Product Development Lifecycle

Playbook features follow a structured lifecycle:

Idea
â†“
Improvement Backlog
â†“
Roadmap
â†“
Implemented
â†“
Archived

This keeps the roadmap focused on active commitments while preserving product intelligence discovered during development.

## Backlog Rotation Strategy

The improvement backlog should remain manageable.

When the backlog grows large, completed items should be archived.

Example structure:

```text
docs/
  PLAYBOOK_PRODUCT_ROADMAP.md
  roadmap/
    IMPROVEMENTS_BACKLOG.md
  archive/
    PLAYBOOK_IMPROVEMENTS_2026.md
```

Archived items preserve historical product intelligence without cluttering the active backlog.

Current baseline:

- **AI Repository Intelligence (`pnpm playbook ai-context`, `pnpm playbook ai-contract`, `index`, `query`, `deps`, `ask`, `explain`)** is implemented and available for deterministic AI bootstrap and repository intelligence workflows.
- `pnpm playbook ask` now supports deterministic response modes (`--mode normal|concise|ultra`) to match explanation depth to developer workflow speed.
- `pnpm playbook ask --repo-context` now hydrates ask prompts from trusted Playbook artifacts (`.playbook/repo-index.json` + AI contract metadata) instead of broad ad-hoc repository inference.

Future roadmap work should focus on enhancement quality (schema hardening, richer index coverage, CI artifact workflows, and contract durability), not on introducing these commands.

## Platform Hardening

Playbookâ€™s long-term reliability depends on deterministic repository artifacts powering higher-level intelligence commands.

Priority hardening tracks:

1. **Artifact schema versioning + evolution governance**
   - enforce and test schemaVersion coverage for persisted artifacts
   - formalize compatibility and migration policy in contract docs
   - require CI mismatch behavior to remain deterministic and actionable

2. **SCM context abstraction**
   - introduce shared SCM normalization module (`packages/core/src/scm/context.ts`)
   - align merge-base, detached HEAD, shallow clone, dirty tree, and rename behavior across command surfaces
   - add edge-case contract tests for PR vs push contexts

3. **Remediation trust model enforcement**
   - encode Level 0-3 change-scope boundaries into plan/apply contracts
   - keep Level 3 cross-module/security-sensitive changes human-reviewed by default
   - expand remediation safety telemetry for CI auditing

4. **Ecosystem adapter boundaries**
   - isolate external tooling integrations behind deterministic adapter interfaces
   - prevent tool-specific behavior from leaking into engine-level command logic
   - harden adapter error normalization and version-compatibility checks

5. **Context efficiency strategy**
   - strengthen index-once/query-many behavior with incremental indexing direction
   - prioritize module/diff scoped responses and concise deterministic outputs
   - track token/latency budgets for high-frequency command paths

6. **Repeatable architecture guardrail audits**
   - run `pnpm playbook audit architecture` as a deterministic hardening diagnostic
   - keep audit checks aligned with docs/contracts/roadmap surfaces
   - enforce stable JSON contract coverage for architecture audit automation

## Product Direction: Architecture Intelligence

Playbook is evolving from a verification tool into an architecture intelligence engine.

In addition to enforcing rules and generating remediation plans, Playbook will analyze repositories and development workflows to produce structured insights about system architecture, risk, and change impact.

Key capabilities in this direction include:

- Repository indexing and query system
- Architecture-aware impact analysis
- Risk hotspot detection
- Pull request intelligence and analysis
- Durable engineering memory direction (`.playbook/memory/*`) to preserve decisions, rationale, and investigation history as queryable repository intelligence for richer AI reasoning.
- Playbook command surfaces already implement a reusable deterministic engineering reasoning loop (`observe -> understand -> diagnose -> plan -> act -> verify -> learn`) that should remain the core execution model across CLI, CI, and future interface layers.

## Product Direction: Knowledge Distillation Engine

Playbook is evolving from repository verification/intelligence into a **Knowledge Distillation Engine** for software engineering.

This architectural direction unifies repository intelligence, context compression, read/change runtime behavior, and the repository learning loop under a recursive intelligence model while preserving the canonical execution model (`observe -> understand -> diagnose -> plan -> act -> verify -> learn`).

Recursive intelligence cycle:

`observe -> detect repetition -> extract candidate patterns -> generalize into rules/invariants -> compress into reusable artifacts -> reuse during repository reasoning and remediation -> learn from outcomes`

Repository evidence sources for distillation:

- source code
- repository structure
- dependency graphs
- documentation
- pull request diffs
- verify findings
- plan/apply histories
- CI failures
- rule violations
- ownership metadata
- architecture metadata

Architecture principle:

Atomic knowledge is **layer-relative** rather than globally fixed.

Layer-relative knowledge units:

- **syntax layer**: tokens, symbols, AST nodes
- **structure layer**: files, modules, dependencies, ownership edges
- **behavior layer**: findings, failures, fixes, remediation actions
- **semantic layer**: rules, doctrines, invariants, constraints
- **compressed runtime layer**: digests, bundles, graph summaries, reusable intelligence artifacts

Pattern: Intelligence via Recursive Compression.

- Playbook should continuously transform repository evidence into increasingly reusable and compact knowledge representations.

Pattern: Layer-Relative Knowledge Units.

- The unit of knowledge depends on the active reasoning layer rather than being globally fixed.

Rule: Compression Must Preserve Explanatory Power.

- A compressed representation is only valid if it still explains repository behavior, boundaries, and architecture meaningfully.

Pattern: Human-Reviewed Knowledge Promotion.

- Repeated patterns may generate candidate rules, doctrines, or invariants, but promotion into enforced governance requires explicit review.

Failure Mode: Premature Canonicalization.

- Forcing one universal knowledge atom too early destroys useful intermediate representations.

Failure Mode: Compression Without Semantics.

- Token reduction without preserved meaning produces weak and unsafe repository intelligence.

## Knowledge Compaction Phase (internal-first specification)

Compaction is the formal internal phase that turns raw candidate knowledge into reusable, reviewable pattern drafts.

Compaction lifecycle:

`observe -> extract candidate patterns -> canonicalize -> compare against stored patterns -> decide outcome -> emit compacted review drafts -> human review/promotion -> archive or supersede replaced patterns`

Compaction answers:

- Is this actually new?
- Is this another example of an existing pattern?
- Can this be merged into a smaller reusable abstraction?
- Is this too specific to store?
- Does this split an existing pattern into two cleaner patterns?

Decision buckets (exactly one per candidate):

- `discard`
- `attach`
- `merge`
- `add`

Canonicalization before comparison (deterministic):

- file paths -> role labels where possible
- package/module names -> component/tool roles where possible
- remove unstable IDs/hashes/timestamps
- normalize exact error strings into mechanism-level summaries
- keep concrete incidents as evidence blocks rather than primary abstractions

Compressed storage direction uses pattern cards containing stable fields such as:

- `id`, `title`
- `trigger/context`
- `mechanism`
- `invariant`
- `implication/response`
- representative `examples`
- supporting `evidence`
- `supersedes`
- `confidence`

Scope boundary for first formal pass:

- internal
- deterministic
- review-oriented
- artifact-backed

Automation boundaries:

- safe now: exact dedupe, canonicalization, evidence attachment, over-specific rejection, simple merge suggestions
- human-reviewed now: aggressive generalization, conflict resolution, pattern splitting, retire/supersede decisions

Contract stance:

- no broad new user-facing command family in this pass
- no autonomous rule promotion
- no replacement of canonical remediation loop (`verify -> plan -> apply -> verify`)
- keep canonical operating ladder unchanged (`ai-context -> ai-contract -> context -> index -> query/explain/ask --repo-context -> verify -> plan -> apply -> verify`)

Current implementation status (features: `PB-V08-KNOWLEDGE-COMPACTION-SPEC-001`, `PB-V08-KNOWLEDGE-CANDIDATE-EXTRACTION-001`, `PB-V08-KNOWLEDGE-BUCKETING-001`, `PB-V08-PATTERN-CARD-STORAGE-001`):

- `PB-V08-KNOWLEDGE-COMPACTION-SPEC-001` now includes deterministic verify-stage pattern compaction output to `.playbook/patterns.json` plus `playbook query patterns` for deterministic inspection of compacted canonical patterns.

- Internal deterministic foundations are now live in the engine: canonicalization, deterministic bucket decisions (`discard | attach | merge | add`), and deterministic review artifacts layered on top of bucketing for inspection/testing.
- Review artifacts keep canonical reason codes as the primary machine contract, with human-readable rationale derived deterministically from those reason codes.
- This remains an internal bridge between extraction and promotion.
- Graph-ready durable pattern card storage is now live under `.playbook/patterns/*.json` with deterministic review drafts under `.playbook/compaction/review-drafts.json`.
- Promotion now includes an explicit deterministic local review boundary with staged candidate queue and reviewed approvals/rejections; no silent or automatic promotion is allowed.
- Live deterministic promotion surfaces in this slice: `pnpm playbook query pattern-review`, `pnpm playbook query promoted-patterns`, and `pnpm playbook patterns promote --id <pattern-id> --decision approve|reject`.
- Storage remains local and explicit (`.playbook/pattern-review-queue.json`, `.playbook/patterns-promoted.json`); cross-repo sync remains future work.
- Cross-repo baseline aggregation is now available via `.playbook/cross-repo-patterns.json` plus `pnpm playbook patterns cross-repo|portability|generalized|repo-delta`; governed transfer/sync policies still remain future scope.

Live-command boundary note:

- Deterministic compaction readback remains available via `pnpm playbook query patterns`, now alongside explicit review/promotion query and decision commands.
- Treat `pnpm playbook --help` and `docs/commands/README.md` as the source of truth for currently available commands.

Compaction spec details are defined in `docs/architecture/KNOWLEDGE_COMPACTION_PHASE.md`.

## Integration Architecture Direction: shared core, local intelligence

### Consumer Integration Contract

`docs/CONSUMER_INTEGRATION_CONTRACT.md` defines the formal downstream integration model for installing Playbook in external repositories.

Goals:

- define shared core vs project-local intelligence
- prevent forks
- enable safe downstream adoption
- support future embedded runtime/API integrations

Canonical model for downstream adoption:

- **Shared core product/engine:** Playbook CLI/engine/contracts remain the reusable upstream product surface.
- **Project-local Playbook state:** each consuming repository owns its own local Playbook state (`playbook.config.json` / `.playbook/*` index/artifacts/plans and repository-specific rules/extensions).
- **Installing Playbook is not a fork by default:** adding Playbook to a repository creates local integration state built on shared core.

### Private-first intelligence model

- scanning/indexing/artifacts remain local by default
- no automatic upstream code/content sharing
- any export/sync/cloud/telemetry behavior is future work and must be explicit + opt-in

### Runtime artifact boundaries and storage hygiene direction

Playbook should maintain explicit boundaries between local runtime state, reviewed automation outputs, and intentionally committed contracts/examples.

- Runtime artifacts should live under `.playbook/` and be treated as local working state by default.
- Regenerated runtime artifacts should not be recommitted on every run unless intentionally promoted to stable contracts/examples.
- Demo artifacts committed under `.playbook/demo-artifacts/` remain product-facing snapshot contracts, not general runtime state.
- Future repository intelligence scanning should exclude irrelevant and high-churn directories to keep indexing deterministic and focused on source-of-truth content.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated artifacts on every run causes unnecessary repo-history growth and noisy diffs.

Delivered direction: `.playbookignore` is now bootstrapped from ranked runtime recommendations through `ignore suggest` and `ignore apply --safe-defaults`, with deterministic managed-block updates and review-first preservation for ambiguous entries.

Rule - Apply Only Trusted Ignore Recommendations.

Pattern - Recommendation Before Application, Safe Defaults Before Review.

Failure Mode - Auto-Applying Ambiguous Ignores.

Failure Mode - Non-Idempotent Ignore Management.

### Governed promotion and transfer workflow

- repository-specific observations stay local to the consuming repo
- reusable patterns move beyond one repository only through explicit governed promotion/transfer paths
- transferred reusable patterns must be sanitized, provenance-preserving, and compatibility-scoped
- receiving repositories treat imported patterns as candidate inputs until local review/adoption
- downstream usage informs Playbook through explicit docs/roadmap/rule/template promotion workflows, not hidden mutation

### Extension model preference

Pattern: **config/plugins/rule packs over forks** for project-specific customization.

Failure mode: treating per-project customization as core forks causes drift, duplicate fixes, and unclear ownership boundaries.

### Embeddable runtime/API direction (future)

For app-integrated actions (internal dashboards, CI control planes, admin/dev panels), Playbook should expose server-side/library surfaces over time.

- browser clients should call validated server endpoints/actions
- avoid raw browser-side arbitrary command execution as the default model
- retain deterministic governance and policy checks server-side

### Follow-up implementation checklist (roadmap slices)

- [x] publish a consumer-repo integration contract doc that defines project-local Playbook state boundaries
- [ ] add a lightweight config/plugin/rule-pack architecture note with extension examples
- [ ] draft first server-side library/API design stub for embedded `ask`/`query`/`explain` workflows
- [x] add `ask --module <name>` scoped repo-context hydration
- [x] add `ask --diff-context` for change-scoped intelligence prompts
- [x] expose ask context-source provenance contract in JSON for app/agent integrations
- [ ] define explicit opt-in export/sync/telemetry policy language before any cloud-backed intelligence behavior

### Storage/runtime hygiene follow-up checklist

Implemented baseline:

- `doctor` emits Playbook Artifact Hygiene diagnostics and structured suggestions (`PB012`, `PB013`, `PB014`).
- `index` and repository scans honor `.playbookignore` for scan exclusions.
- `plan`/`apply` integrate artifact hygiene remediation tasks for deterministic storage governance.

- [x] define `.playbookignore` semantics for repository intelligence scanning and document default exclusion guidance.
- [x] publish artifact lifecycle/retention policy language across runtime artifacts, CI outputs, and committed demo/contract snapshots.
- [x] classify cacheable local intelligence artifacts under `.playbook/` and define safe regeneration expectations.
- [x] document CI artifact workflow guidance so generated artifacts are reviewable without creating long-term repository-history bloat.

Rule: **Playbook analyzes but does not author.**

Playbook provides structured analysis, diagnostics, and recommendations but does not automatically rewrite pull requests or developer intent. Its role is to provide architectural intelligence rather than replace the developer.

Establish Playbook as a trusted governance tool in the developer ecosystem.

Target outcomes:

1,000+ GitHub stars
100+ repositories using Playbook in CI
First external contributors
Initial enterprise interest

Revenue is not the priority during Year 1.

Adoption is.

## Roadmap Compounding Audit (Planning Baseline)

This section records a structural planning audit to keep roadmap phases compounding, non-overlapping, and AI-runtime ready.

### Executive Summary

Strengths:

- CLI-first and deterministic-governance principles are explicit and consistent with the product mission.
- Repository intelligence is already positioned as a machine-readable substrate and is connected to AI/CI workflows.
- The canonical remediation flow (`verify -> plan -> apply -> verify`) is repeatedly reinforced.

Weaknesses:

- Read-runtime capabilities (`ask`, `query`, `explain`, PR analysis) and change-runtime capabilities (`verify`, `plan`, `apply`) are interleaved across phases, which blurs sequencing.
- Context-compression mechanisms are present but not modeled as a dedicated architectural layer.
- Several phases overlap in scope (`query`, dependency graph, impact, risk) rather than compounding as a single intelligence maturation track.
- AI execution runtime planning appears before all mutation-safety and deterministic patch-scope prerequisites are clearly gated.

### Roadmap Structural Issues

Overlapping phase concerns:

- Query, dependency graph, impact analysis, and risk analysis are spread across separate phases with shared substrate dependencies.
- Context compression appears as a standalone subsection between phases rather than a formal phase with explicit contracts.
- PR intelligence is implemented but documented outside the core phase ladder, despite being a read-runtime capability.

Unclear boundaries:

- The roadmap mixes capability introduction (new layer) and capability enhancement (quality expansion) inside the same phase descriptions.
- AI execution runtime planning overlaps with autonomous maintenance and security-program mutation controls.

Sequencing issues:

- Repository intelligence formalization should complete before read/change runtime specialization.
- Deterministic mutation scope, path boundaries, and policy gates should be marked as explicit prerequisites before broad agent runtime expansion.

### Recommended Phase Structure

Use a layered phase model so each phase compounds directly on the previous one:

1. **Phase 1 â€” CLI Foundations**  
   Deterministic command contracts, distribution reliability, baseline verification UX, and deterministic lane contract generation for orchestration planning.
2. **Phase 2 â€” Repository Intelligence Substrate**  
   Formalize index contracts for modules, dependencies, test relationships, docs mapping, ownership, and architecture metadata.
3. **Phase 3 â€” Repository Knowledge Graph**  
   Deterministic local graph substrate generated from repository intelligence artifacts.
4. **Phase 4 â€” Context Compression Layer**  
   Context bundles, module digests, cached snapshots, and deterministic change-scope assembly.
5. **Phase 5 â€” Read Runtime (Query / Explain / Ask / Analyze-PR)**  
   Deterministic architecture reasoning and read-only repository understanding flows.
6. **Phase 6 â€” Change Runtime (Verify / Plan / Apply)**  
   Deterministic remediation orchestration with explicit plan contracts and mutation boundaries.
7. **Phase 7 â€” Risk-Aware Execution**  
   Risk signals, impact-aware sequencing, and risk-shaped remediation prioritization.
   - Wave 1 (implemented): deterministic `learning-state-snapshot` layering over outcome/process telemetry and optional task-execution-profile evidence (`Evidence -> Snapshot -> Proposal`) for compact reviewable learning summaries without autonomous mutation.
   - Wave 2B (implemented): additive process telemetry route-learning evidence (`task_profile_id`, `route_id`, selected rule packs/validations, validation/planning/apply durations, intervention and over/under-validation signals, and realized parallel safety indicators) with deterministic normalization + bounded rollups for Learning State Snapshot evaluation quality.
   - Wave 2C (implemented): learning-state derivation now consumes enriched outcome/process telemetry to strengthen route-fit, parallel safety, reasoning-scope efficiency, and validation-cost pressure metrics with explicit low-signal open-question prompts and backward-compatible partial summaries.
   - Wave 2A (implemented): additive outcome-telemetry structural context (`task_profile_id`, `task_family`, `affected_surfaces`, estimated/actual change surface, post-apply verify/CI status, regression categories, pattern families implicated) with deterministic normalization and backward-compatible safe degradation for partial legacy records.
8. **Phase 8 â€” AI Repository Contract**  
   Machine-readable AI-operability contract and enforcement rules.
   - Router Lane 1 (implemented): additive deterministic `execution-plan` proposal contract (`.playbook/execution-plan.json`) and `playbook route` inspection surface that stays proposal-only, uses task-execution-profile baselines, optionally refines with learning-state evidence, and degrades safely when optional artifacts are missing.
   - Router Lane 3 (implemented): learning-state metrics now conservatively refine route proposals (retry pressure, route efficiency, parallel safety, router fit, validation-cost pressure) with additive `learning_state_available`, `route_confidence`, `open_questions`, and warnings while preserving required validations and deterministic output ordering.
   - Router Lane 4 (implemented): execution-plan outputs are now Codex-worker-ready with additive route fields (`expected_surfaces`, `likely_conflict_surfaces`, `dependency_level`, `recommended_pr_size`, `worker_ready`) and deterministic `playbook route --codex-prompt` compilation into PR-sized proposal-only worker prompts (objective, implementation plan, surfaces, verification, docs updates, and governance block).
9. **Phase 9 â€” Repository Memory System**  
   Establish the temporal memory substrate (session/episodic evidence) while keeping repository structural intelligence (`index`/`graph`) as a distinct deterministic layer.
   - Worker assignment slice (implemented): deterministic proposal-only `worker-assignments` contract generation from lane-state readiness/dependency gates via `pnpm playbook workers` / `pnpm playbook workers assign`, including `.playbook/worker-assignments.json` and `.playbook/prompts/<lane_id>.md` outputs without worker launch or branch/PR automation.
10. **Phase 10 â€” Replay / Consolidation / Promotion**  
    Add deterministic replay and consolidation pipelines with salience-gated, provenance-preserving promotion queues so fast episodic memory cannot become durable doctrine without review.
11. **Phase 11 â€” Session + Evidence Layer**  
    Session envelope and evidence provenance contracts that bind actor context, command lineage, approvals, and deterministic artifact references.
12. **Phase 12 â€” Control Plane / Agent Runtime v1**  
    First-class policy/approval/mutation-boundary architecture that gates privileged execution and keeps agents above (not inside) the deterministic substrate.
13. **Phase 13 â€” Review + Execution Orchestration**  
    Policy-gated orchestration that consumes repository intelligence + AI contracts + session/evidence + control-plane checks while preserving deterministic mutation workflow.
14. **Phase 14 â€” Knowledge Query / Inspection Surfaces (Read Runtime) - implemented (hardening)**  
    Deterministic, provenance-preserving read-runtime inspection of repository memory and promoted knowledge so humans/CI can query, compare, and audit candidate/promoted/stale states before broader automation consumption.
15. **Phase 15 â€” Automation Synthesis (Governed Knowledge Consumption)**  
    Future controlled synthesis that consumes only promoted, inspectable, provenance-linked knowledge artifacts after `docs/architecture/PLAYBOOK_KNOWLEDGE_QUERY_SURFACES.md` (Phase 14) is in place. This phase explicitly excludes raw chat memory, unreviewed candidate knowledge, and undocumented inference as automation-grade input. Initial thin implementation slice is architecture/contracts/docs plus suggestion-generation contracts only (no autonomous mutation-heavy runtime behavior and no autonomous deployment/execution paths).

Phase 15 allowed vs forbidden input examples:

- Allowed: promoted knowledge from deterministic query/inspection surfaces with provenance/freshness metadata attached, used to produce reviewable suggestions.
- Forbidden: raw transcripts, opaque prompt memory, or unreviewed candidate artifacts used directly for mutation-ready actions.

16. **Phase 16 â€” Outcome Feedback + Automation Runtime Learning (Human-Reviewed)**  
    Governed feedback loops that convert verified runtime outcomes, rollback/deactivation events, and later regressions into provenance-linked repo-local candidate learning artifacts (confidence, template suitability, trigger quality, rollback heuristics, stale-knowledge flags, and trend updates). Outputs remain candidate artifacts until explicit human-reviewed promotion/demotion/supersession.
17. **Phase 17 â€” Governed Cross-Repo Pattern Promotion / Transfer**  
    Controlled compounding of reusable engineering knowledge across repositories through explicit, provenance-preserving, sanitization-verified, compatibility-gated transfer packages. Imported patterns are candidate inputs until locally reviewed; no hidden telemetry or automatic global sync.
18. **Phase 18 â€” Governed Interface / API Surfaces for Multi-Repo Control Planes**  
    Optional interface expansion that exposes validated server/API action surfaces over the same deterministic runtime, preserving per-repo policy/provenance boundaries while enabling coordinated multi-repo control-plane workflows.
19. **Phase 19 â€” Workspace / Tenant Governance + Optional Hosted Deployment Model**  
    Optional workspace/tenant governance and deployment packaging layer over the same deterministic runtime, defining policy inheritance, per-repo accountability, and hosted/self-hosted parity without making cloud connectivity mandatory.
20. **Phase 20 â€” Autonomous Maintenance (Policy-Gated)**  
    Recurring maintenance execution modes with approval and policy controls, layered after governed synthesis, outcome-feedback, cross-repo transfer, governed control-plane interface contracts, and workspace/tenant governance boundaries.
21. **Phase 21 â€” Repository Learning Loop Expansion (Human-Reviewed)**  
    Broader pattern detection and candidate improvements from repeated findings/remediations/query usage, including advanced clustering, graph-informed learning artifacts, and higher-order synthesis inputs. Outputs remain candidate knowledge artifacts until human review promotes them to enforced governance.

Reasoning for reordering:

- Separates repository understanding (read runtime) from repository mutation (change runtime).
- Makes intelligence and context efficiency foundational before AI runtime expansion.
- Ensures advanced automation is gated by deterministic contracts, session evidence, policy approvals, and mutation safety.

### Official future-work split (post current stabilization)

Current-state command surfaces remain the canonical implemented interface and are unchanged by this section. Future sequencing below describes architecture maturity order only.

TODO (roadmap contract alignment): add explicit feature IDs, dependencies, and verification commands in `docs/roadmap/ROADMAP.json` for Repository Memory System, Control Plane / Agent Runtime v1, and Outcome Learning / Policy Improvement only after those slices are commitment-ready for CI-enforced contract validation.

1. **Repository Memory System (next major platform phase)**
   - Clarify that structural graph (`.playbook/repo-graph.json` and `.playbook/repo-index.json`) remains repository-shape intelligence, while temporal memory remains under `.playbook/memory/*`.
   - Positioned after graph/failure-intelligence maturity and before deeper agent-runtime expansion.
   - Formalizes **structural graph vs temporal memory** boundaries:
     - structural graph = repository topology and dependency shape
     - temporal memory = execution/observation events with lifecycle state
   - Formalizes **fast episodic memory vs slow doctrine**:
     - fast episodic memory = revisable session/replay evidence
     - slow doctrine = promoted, reviewed, durable governance knowledge

2. **Replay / Consolidation / Promotion (explicit phase)**
   - Formalizes **replay -> consolidation -> salience gates -> human-reviewed promotion** as a first-class dependency layer.
   - Requires provenance-preserving retrieval and review queues before any doctrine promotion/demotion/supersession.
   - Keeps candidate generation high-recall while preventing low-signal promotion through explicit salience and approval gates.

3. **Control Plane / Agent Runtime v1**
   - Builds on memory + replay/consolidation + evidence + policy boundaries, not in parallel with them.
   - Keeps the architecture rule explicit: **agents sit on top of the deterministic substrate** (index/graph/verify/plan/apply/contracts), not inside or instead of it.
   - Preserves deterministic governance and human-review boundaries as mandatory runtime gates.
   - Future orchestration scope after deterministic lane contract generation includes: worker launch, merge guards, and orchestration state tracking.

4. **Outcome Learning / Policy Improvement (human-reviewed)**
   - Converts reviewed outcomes into ranking/prioritization improvements, not mutation authority expansion.
   - Maintains promotion gates: learning outputs remain candidate artifacts until explicit human-reviewed promotion/demotion decisions.

5. **Autonomous Maintenance (policy-gated, later phase)**
   - Remains dependency-ordered after control-plane trust boundaries and outcome-learning/policy-improvement maturity.
   - Focuses on bounded recurring maintenance workflows under explicit approval and fail-closed policies.
   - Does not imply autonomous doctrine promotion or uncontrolled mutation.

6. **Repository Learning Loop Expansion (later phase)**
   - Distinct from control-plane foundations and from autonomous maintenance.
   - Expands pattern discovery and repository-level learning after the previous trust layers are stable.

### Missing Capabilities to Formalize

The roadmap should make these explicit as first-class contracts:

- module digests for compact architecture context transfer
- minimal change-scope bundles for patch targeting
- deterministic mutation scope declaration (`allowedFiles`, patch-size constraints, boundary checks)
- risk-aware context shaping (high-risk modules get richer context; low-risk modules stay concise)
- cache lifecycle policy for `.playbook/context/*` intelligence snapshots

### Token Efficiency Opportunities

To reduce scan cost and AI tokens:

- make `index` + cached intelligence artifacts the default source for read runtime operations
- require context bundles for agent workflows instead of broad repository scans
- add deterministic module digests as lightweight context payloads for `ask`/`explain`
- persist change-scope bundles that include files/tests/dependencies/docs/rules/risk in one contract
- enforce patch-scope narrowing before generation to reduce reasoning breadth

### Architecture Patterns

- Pattern: One intelligence substrate powering multiple task runtimes.
- Pattern: Read runtime and change runtime are distinct execution modes with shared contracts.
- Pattern: Context compression is a product layer, not an ad-hoc optimization.
- Pattern: Contract-driven AI execution with deterministic mutation boundaries.
- Pattern: Risk-aware context shaping to balance safety and token efficiency.

### Failure Modes

- Failure Mode: Feature accumulation without layer boundaries.
- Failure Mode: Treating read and mutation tasks as the same runtime path.
- Failure Mode: Context bloat from repeated full-repo scans.
- Failure Mode: Agent/runtime expansion before mutation-safety prerequisites are complete.
- Failure Mode: Intelligence drift when index/schema ownership is distributed across unrelated phases.

### Recommended Documentation Reorganization (this file)

Rewrite/reorganize these sections in `docs/PLAYBOOK_PRODUCT_ROADMAP.md`:

- Consolidate **PHASE 2**, **PHASE 3**, **PHASE 4**, **PHASE 5**, **PHASE 6**, and **PHASE 7** into a clear progression: substrate -> knowledge graph -> context compression -> read runtime -> change runtime -> risk-aware execution.
- Keep **AI Efficiency & Context Compression** as an explicit numbered phase.
- Move **PR Intelligence (Implemented)** under the read-runtime phase grouping.
- Add an explicit "Phase 10 prerequisites" block requiring deterministic mutation scope, policy gates, repository-memory boundaries, and contract validation before `pnpm playbook agent` expansion.
- Add a future **Repository Learning Loop** phase scoped to human-reviewed suggestions only (no autonomous mutation).

### Documentation Capture Rules (Post-Audit)

Roadmap documentation must preserve these architectural statements:

- Read workflows and change workflows are separate runtimes sharing one repository-intelligence substrate.
- Persistent repository intelligence is the default mechanism for reducing AI token usage.
- Context compression and deterministic mutation scope are core AI-efficiency and safety mechanisms.
- Future phases should prioritize intelligence quality and contract durability over command-surface growth.
- A repository learning loop can propose rule/context improvements from observed patterns, with human review required.

PHASE 1 â€” CLI FOUNDATIONS

Goal:
Ship a reliable local-first CLI with deterministic contracts for human and machine workflows.

Core outcomes:

- Build and distribution reliability (`pnpm -r build`, npm packaging, CI install paths).
- Stable command registry and deterministic JSON outputs.
- Verification-first baseline (`verify`, `plan`, `apply`) for governance enforcement.

PHASE 2 â€” REPOSITORY INTELLIGENCE

Goal:
Build deterministic repository intelligence artifacts that AI systems and developers can trust.

Primary capability:

- `pnpm playbook index` generates `.playbook/repo-index.json` as machine-readable repository context.

Intelligence artifacts should include:

- modules
- dependencies
- dependents
- architecture metadata

PHASE 3 â€” REPOSITORY KNOWLEDGE GRAPH

Goal:
Build a deterministic local Repository Knowledge Graph artifact from repository intelligence.

Primary capability:

- `pnpm playbook index` emits `.playbook/repo-graph.json` as a local, deterministic, CLI-first graph artifact generated from repository evidence.
- Graph artifact evolution is versioned by explicit contract policy with additive-vs-breaking guidance for downstream CI/AI consumers.
- Implemented thin-slice hardening: graph stats include deterministic node/edge kind count maps and are exposed through `pnpm playbook graph --json` contracts.

Graph architecture stance:

- local
- deterministic
- CLI-first
- generated from repository evidence
- canonical context source for reasoning/runtime flows

Initial graph concepts:

Nodes:

- repository
- module
- file
- function
- test
- rule
- doc
- owner
- finding
- plan task
- risk signal

Edges:

- depends_on
- contained_in
- defines
- calls
- verified_by
- governed_by
- owned_by
- violates
- remediates
- impacts

Repository Knowledge Graph should power:

- context compression

Current shipped compression slice:

- `pnpm playbook index` also emits `.playbook/context/modules/*.json` compressed module digests derived from index + graph + deterministic risk/docs/test signals.
- Existing read runtime (`query impact`, `explain <module>`) reuses digest/graph context additively before broader inference.
- impact analysis
- risk-aware reasoning
- future pattern mining / repository learning loops
- higher-signal `ask` / `query` / `explain` inputs

Current stabilization direction:

- favor additive read-runtime enrichment (query/explain graph neighborhood summaries)
- avoid broad new graph command families when existing command surfaces can absorb deterministic summaries
- add only low-cost deterministic relationships derivable from indexed repository truth (`contains`, `depends_on`, `governed_by`)

PHASE 4 â€” AI EFFICIENCY & CONTEXT COMPRESSION

Goal:
Reduce AI cost/latency while increasing knowledge reuse quality for repository reasoning and remediation.

Compression in this phase is both token-efficiency and representation compaction for reusable repository knowledge.

Examples of compressed artifacts:

- module digests
- change-scope bundles
- graph neighborhood summaries
- repeated remediation clusters
- candidate invariant summaries

Key mechanisms:

- repository intelligence graph summaries
- context bundles
- cached context snapshots
- deterministic patch scope

PHASE 5 â€” QUERY SYSTEM

Goal:
Enable deterministic repository reasoning through command-surface intelligence queries.

Primary capability:

- `pnpm playbook query`

Representative queries:

- `pnpm playbook query architecture`
- `pnpm playbook query dependencies <module>`
- `pnpm playbook query impact <module>`
- `pnpm playbook query risk <module>`
- `pnpm playbook query docs-coverage`
- `pnpm playbook query rule-owners`
- `pnpm playbook query test-hotspots`

This phase establishes contract-driven repository reasoning so AI systems can avoid ad-hoc inference.

### Impact Analysis Query

Command:
`pnpm playbook query impact <module>`

Purpose:
Identify all modules, packages, and files affected by changes to a specific module.

Example:

`pnpm playbook query impact auth`

Output:

- dependent modules
- affected rules
- architecture boundaries touched

PHASE 6 â€” DEPENDENCY GRAPH + IMPACT ANALYSIS

Goal:
Use repository dependency edges to make change impact deterministic.

Primary capabilities:

- dependency graph in index artifacts
- impact analysis via `pnpm playbook query impact <module>`

Expected outcomes:

- identify downstream dependents before edits
- expose architectural blast radius for proposed changes
- prioritize low-impact remediation paths first

PHASE 7 â€” RISK ANALYSIS

Goal:
Add deterministic module-level risk scoring for safer AI and human remediation planning.

Primary capability:

- `pnpm playbook query risk <module>`

Risk model signals should include:

- fan-in
- fan-out
- verification failures
- dependency-hub status

Expected outcome:

- safer prioritization of change sequencing and rollout planning.

PHASE 8 â€” AI REPOSITORY CONTRACT

Status: **Baseline implemented** via `pnpm playbook ai-contract` and `.playbook/ai-contract.json`.

Goal:
Define a deterministic, machine-readable AI interaction contract that repositories expose before agent runtime execution is introduced.

Primary capability:

- `.playbook/ai-contract.json`
- `pnpm playbook ai-contract` / `pnpm playbook ai-contract --json`

The AI Contract specifies how AI systems should interact with a Playbook-governed repository.

Contract fields include:

- AI runtime used
- repository workflow
- repository intelligence sources
- remediation workflow rules

Example contract:

```json
{
  "schemaVersion": "1.0",
  "kind": "playbook-ai-contract",
  "ai_runtime": "playbook-agent",
  "workflow": ["index", "query", "plan", "apply", "verify"],
  "intelligence_sources": {
    "repoIndex": ".playbook/repo-index.json",
    "moduleOwners": ".playbook/module-owners.json"
  },
  "remediation": {
    "canonicalFlow": ["verify", "plan", "apply", "verify"],
    "diagnosticAugmentation": ["explain"]
  },
  "rules": {
    "requireIndexBeforeQuery": true,
    "preferPlaybookCommandsOverAdHocInspection": true,
    "allowDirectEditsWithoutPlan": false
  }
}
```

AI-operable repository signal:

- Repositories containing `.playbook/ai-contract.json` are treated as AI-operable through Playbook governance.
- AI systems should consult this contract before making or proposing code changes.

This phase formalizes Playbook's repository-to-AI protocol, ensuring AI behavior is deterministic and governance-aware.

Future standardization direction:

- Publish `docs/AI_CONTRACT_SPEC.md` as a public AI Contract specification for AI-operable repositories.

PHASE 9 â€” REPOSITORY MEMORY SYSTEM (ARCHITECTURE + CONTRACT FOUNDATIONS)

Goal:
Introduce first-class Repository Memory System architecture and contracts while preserving current runtime behavior.

Scope in this phase:

- define explicit memory layering (`structural intelligence -> working context -> episodic memory -> replay/consolidation -> doctrine/policy memory`)
- publish memory event and knowledge/promotion contracts
- keep structural graph contract boundaries explicit
- wire roadmap/contract language for future memory-aware retrieval and promotion/prune workflows

Boundary rule:

- `.playbook/repo-graph.json` remains the structural graph and must not be repurposed as the full temporal memory store.

Execution posture:

- documentation/contract architecture phase only
- no command-surface or runtime behavior expansion required in this slice

PHASE 10 â€” AI EXECUTION RUNTIME (PLAYBOOK AGENT)

Goal:
Introduce **Playbook Agent** as an AI execution runtime for repositories.

New command:

- `pnpm playbook agent`

Vision:
Instead of AI systems directly editing code without guardrails, Playbook Agent orchestrates deterministic repository workflows so every proposal runs through repository intelligence and remediation contracts.

Agent contract relationship:

- Playbook Agent consumes `.playbook/ai-contract.json` and repository-memory doctrine boundaries to determine repository workflow and operating rules.

Example agent bootstrap flow:

1. AI system enters repository.
2. Detects `.playbook/ai-contract.json`.
3. Loads Playbook workflow/intelligence/remediation rules from the contract.
4. Executes the deterministic `plan -> apply -> verify` loop.

Example:

- `pnpm playbook agent "add pagination to workouts API"`

Deterministic AI execution loop:

1. `pnpm playbook index`
2. `pnpm playbook query architecture`
3. `pnpm playbook query dependencies <module>`
4. `pnpm playbook query risk <module>`
5. `pnpm playbook plan`
6. `pnpm playbook apply`
7. `pnpm playbook verify`
8. Repeat remediation cycle until verify is clean.

This phase defines Playbook as an AI governance and execution runtime, not only a repository rule checker.

## PR Intelligence (Implemented)

Playbook provides structured deterministic analysis of pull requests/branch diffs to help developers understand architectural impact and risk.

Primary command:

`pnpm playbook analyze-pr --json`
`pnpm playbook analyze-pr --format github-comment`
`pnpm playbook analyze-pr --format github-review`

Current capabilities:

- Detect changed files and affected indexed modules from local git diff
- Derive downstream module impact and architecture boundaries touched
- Aggregate risk signals from existing module-risk intelligence
- Surface docs review candidates and ownership-aware context
- Emit stable machine-readable PR analysis output for automation
- Export deterministic GitHub-ready PR summary markdown via formatter mode (`--format github-comment`) without introducing new analysis logic
- Export deterministic GitHub inline review diagnostics via formatter mode (`--format github-review`) from canonical analysis findings
- Standardize analyze-pr output selection through a single formatter layer (`--format text|json|github-comment|github-review`) so new presentation paths replace superseded ad-hoc branches
- Wire GitHub Actions PR transport to post/update one sticky Playbook summary comment using the canonical `--format github-comment` formatter output (marker: `<!-- playbook:analyze-pr-comment -->`)
- Wire GitHub Actions PR transport to synchronize inline review diagnostics using canonical `--format github-review` output (marker: `<!-- playbook:analyze-pr-inline -->`) so resolved diagnostics disappear
- Treat index generation as an explicit prerequisite in CI (`pnpm playbook index` producer before `analyze-pr` consumer) to avoid artifact-readiness drift
- Treat PR diff base as an explicit CI contract (`--base origin/${{ github.base_ref }}` + `fetch-depth: 0`) instead of implicit environment inference

Playbook should analyze PRs but not author them.

Rule: **Playbook analyzes changes rather than rewriting developer intent.**

PHASE 11 â€” AUTONOMOUS REPOSITORY MAINTENANCE

Goal:
Extend Playbook Agent into recurring and CI-driven repository maintenance modes.

Planned operating modes:

- CI self-healing: `pnpm playbook agent --fix-ci`
- maintenance mode: `pnpm playbook agent --mode maintain`

Example autonomous tasks:

- documentation drift fixes
- architecture corrections
- rule remediation
- dependency cleanup
- targeted coupling reduction/refactoring flows

Documentation patterns to enforce in this phase:

- Pattern: Contract-Driven AI Execution
  - AI systems must operate through deterministic repository workflows instead of directly modifying code.
- Pattern: AI Execution Loop
  - AI change proposals pass through `plan -> apply -> verify` cycles until repository verification succeeds.
- Pattern: Repository Intelligence Layer
  - Structured repository artifacts (index, dependency graph, risk graph) allow AI tools to reason about codebases deterministically.

Updated product direction:
Playbook evolves from a repository rule checker into an AI-aware repository governance and execution runtime.

Key product pillars:

- Repository intelligence
- Deterministic remediation
- AI-safe execution
- Architecture enforcement

## Security Program

Security is a first-class product program for Playbook and is implemented as deterministic, automated processâ€”not manual review.

### Deterministic Mutation Architecture

Playbook is evolving toward a deterministic and secure repository mutation engine, not just a command runner. The canonical mutation workflow is:

`verify -> plan -> approval -> apply -> verify`

This execution pipeline preserves both automation and control:

- `verify` identifies structural, architectural, or policy failures in deterministic rule output.
- `plan` generates evidence-linked remediation proposals tied to concrete findings.
- `approval` provides a policy and review checkpoint for humans and/or CI before writes occur.
- `apply` executes only validated remediation tasks from the approved plan contract.
- final `verify` confirms repository health after mutations are applied.

Playbook intentionally separates analysis (`verify`), planning (`plan`), and execution (`apply`) so automated repository changes remain reviewable, policy-gated, and reproducible.

### 1ï¸âƒ£ Execution Safety (Highest Priority)

Secure the core lifecycle:

`index â†’ query/ask/explain â†’ verify â†’ plan â†’ validate â†’ policy â†’ apply â†’ verify`

Key guarantees:

- repo-root boundary enforcement
- deterministic file targeting
- no unreviewed writes
- diff-based remediation only
- policy-gated apply
- evidence-linked plans
- no arbitrary command execution

Roadmap milestones:

- [ ] repo path normalization and traversal protection
- [ ] symlink escape prevention
- [ ] patch size and scope limits
- [ ] file write allowlists
- [ ] remediation plan validation layer
- [ ] policy engine gate before apply
- [ ] deterministic remediation contracts with strict schema + task invariants

### 2ï¸âƒ£ Release and Supply Chain Integrity

Ensure Playbook releases are verifiable and tamper-resistant.

Roadmap milestones:

- [ ] SBOM generation for every build
- [ ] dependency vulnerability scanning
- [ ] secret scanning in CI
- [ ] Sigstore/Cosign artifact signing
- [ ] provenance attestations
- [ ] immutable releases
- [ ] protected CI pipelines

Automated artifacts:

- `/artifacts/sbom.json`
- `/artifacts/provenance.json`
- `/artifacts/signature.cosign`

### 3ï¸âƒ£ Self-Auditing Security Features

Playbook will provide built-in deterministic security intelligence via the same query/verify engine contracts.

Planned command surface:

- `pnpm playbook query vulnerabilities`
- `pnpm playbook query secrets`
- `pnpm playbook query risky-exec`
- `pnpm playbook query unsafe-paths`
- `pnpm playbook verify security-baseline`

Documentation patterns and rules to encode:

- Rule â€” No Unreviewed Writes: Playbook must never modify repository files without a diff-based plan and explicit apply step.
- Rule â€” Repo Root Security Boundary: all file reads and writes must resolve within the repository root.
- Pattern â€” Policy-Gated Remediation: `finding â†’ plan â†’ validation â†’ policy â†’ apply â†’ verify`.
- Pattern â€” Evidence-Bound Outputs: plans must reference deterministic findings and source evidence.
- Failure Mode â€” Prompt Poisoning via Repository Content: repository text is untrusted evidence and must not influence runtime policy behavior.
- Failure Mode â€” Boundary Drift: new commands must not expand file access scope without explicit security review.
- Rule â€” Roadmap Automation Check: every new CLI command must include a security verification checklist (path boundary protection, deterministic outputs, plan/apply compatibility, and snapshot tests).

FUTURE DIRECTION â€” PLAYBOOK PLATFORM VISION

Playbook starts as a CLI-first developer tool, but the platform is intentionally architected so the same analysis engine can power multiple product surfaces.

Architecture Philosophy

packages/engine is the core analysis engine.

Interfaces built on top of it can include:

CLI
GitHub Actions
API services
Web dashboards

This separation allows Playbook to grow from a local CLI workflow into a broader engineering governance platform without fragmenting core logic.

Potential Long-Term Capabilities

- Repository architecture graphs
- Engineering governance scoring
- Cross-repository insights
- Playbook Cloud dashboards
- AI-assisted repository explanation

LONG TERM VISION

Playbook becomes the governance infrastructure for AI-assisted development.

Equivalent ecosystem role:

Git â†’ version control
CI â†’ builds
Sentry â†’ runtime errors
Playbook â†’ architecture governance
NORTH STAR METRICS

Year 1 (adoption-over-revenue, measured with deterministic proof-of-value context):

1,000 GitHub stars
100 repositories using Playbook
10 external contributors

Year 2:

10,000 developers
1,000 repos using Playbook
first enterprise deployments
FOCUS MANTRA

Every feature must answer one question:

How do we keep AI-generated code aligned with architecture?

## Proof-of-value measurement architecture alignment

Canonical reference: `docs/architecture/PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md`.

Roadmap and adoption decisions should measure value through deterministic repository outcomes, trust signals, governance improvements, and evidence-linked before/after pilot windows.

Rule: adoption-over-revenue Year 1 remains the operating stance, but proof-of-value measurement must be explicit from day one.

Measurement guardrails:

- measure outcomes, trust, governance, and coordination impact rather than vanity usage activity
- preserve CLI-first, offline-capable, private-first operation; cloud aggregation is optional, never required
- preserve per-repo explainability/provenance when aggregating to team/workspace/tenant views

## Phase: AI Repository Intelligence (Current + Next Enhancements)

This phase is now implemented in the current product baseline.

Implemented baseline: `pnpm playbook index` (paired with `query`, `deps`, `ask`, `explain`, and `ai-context`).

- Command intent: generate a machine-readable repository intelligence artifact for AI-safe repository understanding.
- Output path: `.playbook/repo-index.json`.
- Current index coverage:
  - modules (including modular-monolith `src/features/*` modules as first-class indexed/explainable module targets)
  - dependency edges (workspace manifest links, root manifest links, and source import relationships)
  - workspace topology (`packages/*` relationships and package roles)
  - module test presence mapping (`tests_present` + deterministic `coverage_estimate: unknown`)
  - config surface inventory (eslint, tsconfig, jest, vitest, and command inventory from package scripts)
  - database schema
  - framework
  - architecture contracts
- Product purpose: enable AI agents to safely understand repository structure and constraints before making code changes.
- Next enhancements: richer intelligence coverage, schema hardening, and stronger CI artifact workflows.

## Phase: AI-Operable Repository Platform (Loop 1 Complete)

Status: the first remediation interface loop is now implemented via `verify`, `plan`, and `apply`.

Canonical flow:

`verify -> plan -> apply -> verify`

- `verify` detects deterministic governance findings.
- `plan` emits deterministic remediation intent (`tasks`) in both human and machine-readable forms.
- `apply` executes deterministic auto-fixable tasks from fresh planning or a serialized `--from-plan` artifact.
- `fix` remains as a convenience/direct remediation path, while `plan` + `apply` is the primary automation contract.

Pattern: **Reviewed Intent Before Execution**

The safest automation model is to generate a machine-readable plan, review it, then execute that exact artifact.

Pattern: **Two-tier backlog (Improvement Backlog â†’ Roadmap)**.

Use `docs/roadmap/IMPROVEMENTS_BACKLOG.md` to capture emerging ideas; promote only prioritized capabilities into this roadmap.

## Phase: Serialized Execution Contracts & Automation Hardening (Next)

Focus this subphase on contract durability for CI and agent integrations:

- [ ] `apply --from-plan` parity hardening across text/json modes and failure reporting.
- [ ] Stable task IDs and schema hardening for long-lived artifact compatibility.
- [ ] Handler registry hardening so unsupported/failed handlers are explicit and auditable.
- [ ] CI/GitHub Action artifact workflows for exporting, reviewing, and applying plan artifacts across steps/jobs.

Failure mode to avoid: **Apply recomputes intent during artifact execution**

If `apply --from-plan` silently re-runs planning logic and diverges from the reviewed artifact, the execution contract is no longer trustworthy.

## Future Capability Track: Automation Synthesis / Playbook Agent

Detailed product direction: see `docs/AUTOMATION_SYNTHESIS_VISION.md` and `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md`.

Goal:
Extend Playbook from deterministic remediation into a future **Automation Synthesis** platform that can propose and safely operationalize recurring engineering automations without bypassing governance.

This track is dependency-ordered after inspectable, provenance-linked repository knowledge query surfaces so automation consumes governed knowledge that humans can inspect first.

Why this matters:

- Teams repeatedly perform the same operational and repository maintenance work.
- Capturing these repeats as reviewed automations reduces toil while preserving policy, explainability, and repository safety.
- Playbook can reuse its existing contract-first execution model so synthesized automation remains reviewable and deterministic rather than opaque agent behavior.

Core concept:

- detect recurring work signals (for example from verify/plan/apply history and approved remediation patterns)
- classify work into known automation patterns/templates using approved trigger taxonomy and promoted/reviewed pattern knowledge
- synthesize candidate automation logic and runbooks from governed, inspectable, provenance-linked knowledge context packages
- treat generated automations as untrusted until verified in isolated sandboxes
- route verified candidates through explicit approval gates before deployment to orchestration backends
- monitor runtime behavior with rollback-ready controls

Foundational requirements:

- deterministic contracts for automation definitions, approvals, and execution states
- synthesis input eligibility rules that exclude raw chat memory, unreviewed candidate knowledge, and evidence-free inferred rules
- provenance-linked synthesis outputs that attach lineage to governed knowledge/evidence inputs
- reusable template and policy packs tied to docs-backed governance behavior
- sandboxed verification before any production orchestration action
- human-reviewable outputs (diffs, risk summaries, and execution intent)
- security-first approval and deployment boundaries aligned with existing apply safety model

Likely phased implementation sequence:

1. **Signal + Pattern Layer**: capture recurring work telemetry and map it to stable Automation Synthesis patterns.
2. **Synthesis + Verification Layer**: generate candidate automations and validate them in deterministic sandboxes.
3. **Approval + Deployment Layer**: add policy/owner approval flows and controlled promotion into orchestration targets.
4. **Runtime Intelligence Layer**: add observability, anomaly detection, and rollback workflows for deployed automations.

Explicit out-of-scope boundaries for initial versions:

- not a replacement for core repository intelligence and remediation priorities
- no autonomous direct repository writes outside `verify -> plan -> apply` policy controls
- no vendor-locked orchestration dependency as a required default
- no fully hands-off self-modifying automation runtime without human approval

Feature: Plugin Ecosystem

Support external packages:

- playbook-plugin-react
- playbook-plugin-next
- playbook-plugin-supabase

Plugins provide:

- verify rules
- analyze rules
- fix handlers

Purpose:

Enable a community ecosystem similar to ESLint plugins.

Feature: Agent Interface

Expose machine-readable interfaces:

- pnpm playbook analyze --json
- pnpm playbook status --json
- pnpm playbook plan --json
- pnpm playbook apply --json
- pnpm playbook fix --json (convenience path)
- pnpm playbook verify --json

Purpose:

Allow AI coding tools to safely interact with repositories through Playbook.

Feature: GitHub Action

Allow repositories to add:

uses: playbook/verify

Purpose:

Automate governance checks in CI.

## Rule: Product State Must Be Anchored

When a new command or major workflow ships, update the authoritative product-state surfaces in the same change (or immediately after):

- `README.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- command reference docs
- demo docs/contracts
- `docs/CHANGELOG.md`

Pattern: **AI Anchor Drift**.

Command-state rule for current roadmap framing:

- New command additions must update README, roadmap, command reference, demo docs, and changelog.
- `index` and the AI repository-intelligence surface are implemented; roadmap items should track enhancement quality and automation durability rather than command existence.
- When docs and implementation disagree, code is source of truth.

## Phase: Command Validation Automation & Self-Verifying Development Loop

Goal:
Make Playbook command development self-verifying so new commands are validated deterministically as they are added.

Why this matters:
Playbook is building an AI-operable CLI surface. That surface becomes much more trustworthy when every command addition expands both product capability and automated validation coverage.

Development loop target:

1. implement command
2. add/update command contract tests
3. run deterministic validation
4. fix regressions before merge

Required validation surfaces for new commands:

- contract tests for deterministic JSON/text behavior where applicable
- smoke coverage for runtime execution paths
- local built CLI validation inside the Playbook repo
- docs and command-inventory updates in the same change

Codex-aligned workflow:

- Codex should not stop at implementation
- Codex should also add or update contract tests, run validation commands, and remediate failures before completion

Baseline validation commands:

- `pnpm -r build`
- `pnpm test`
- `pnpm smoke:ci`
- branch-accurate CLI runs through `pnpm playbook ...`

Pattern: Self-Verifying Command Development

- Every new command should increase both feature coverage and validation coverage.

Rule: Command Additions Must Ship With Validation

- A new command is not complete until its deterministic behavior is exercised by automated tests or smoke coverage.

Pattern: Branch-Accurate Command Validation

- Inside the Playbook repository, command validation should run against the locally built CLI entrypoint rather than assuming published package behavior.

Future enhancement:

- introduce `pnpm playbook self-test` as a system-level validation entrypoint that exercises key commands and contracts against fixture repositories.

## Documentation governance contract

- Deliver deterministic documentation governance through `pnpm playbook docs audit` for humans, CI, and AI.
- Maintain a single strategic roadmap (`docs/PLAYBOOK_PRODUCT_ROADMAP.md`) and separate improvements backlog (`docs/roadmap/IMPROVEMENTS_BACKLOG.md`).
- Keep cleanup/migration guidance out of long-lived policy docs once governance is command-enforced.

## Security Contracts

- Added machine-readable security contracts to map runtime guards to deterministic enforcement tests.
- Added contract-driven security verification stage (`pnpm test:security`) for CI regression protection.

## Feature: PB-V1-DEMO-REFRESH-001 â€” PR-based demo repository refresh automation

Goal: keep committed demo artifacts/docs in `ZachariahRedfield/playbook-demo` synchronized using the branch-accurate local Playbook CLI build without polluting correctness CI.

Implementation surfaces:

- `scripts/demo-refresh.mjs`
- `.github/workflows/demo-refresh.yml`
- `.github/workflows/demo-integration.yml` (dry-run integration surface)
- `docs/integration/PLAYBOOK_DEMO_COMPANION_CHANGES.md`

Contract:

- clone `playbook-demo`
- inject `PLAYBOOK_CLI_PATH` to force local CLI usage
- detect target package manager from lockfiles and execute refresh with matching command runner (`npm run`, `pnpm run`, or `yarn run`)
- avoid shell-fragile `bash -lc` execution in default paths (argv/spawn execution)
- allowlist committed refresh outputs (`.playbook/demo-artifacts/**`, `.playbook/repo-index.json`, `docs/ARCHITECTURE_DIAGRAMS.md`)
- fail on non-allowlisted mutations
- configure explicit git author identity and explicit token-based push auth in `--push` mode (`PLAYBOOK_GIT_AUTHOR_*`, `PLAYBOOK_DEMO_GH_TOKEN`/`GH_TOKEN`)
- open/update PRs only (no direct push to `main`)

## Deterministic Artifact Layer

Rule
Playbook artifacts must only be written via the artifact IO layer to guarantee determinism and pipeline reliability.

Failure Mode
Shell redirection (`>`) may introduce encoding corruption. CLI owned artifact output must always be preferred.

## CI Checkout Auth Hardening

Rule
Treat checkout auth failures as stage-0 blockers and remediate token/permissions before runtime warning cleanup.

Pattern
Use explicit least-privilege workflow permissions (`contents: read` for PR validation jobs) and modern checkout action versions to keep fork/same-repo PR checkout deterministic.

Failure Mode
If workflow permissions are implicit/restricted, `actions/checkout` can fail early with `could not read Username for https://github.com` before any build/test stage executes.

## Agent Routing Boundary (Controller vs Worker)

Status: **In progress - routing authority introduced for task classification before model usage.**

- Playbook now classifies task routes as `deterministic_local`, `model_reasoning`, `hybrid`, or `unsupported`.
- Routing decisions include reasons, required inputs, missing prerequisites, and mutation eligibility.
- Rule: The model must never decide its own authority boundary; Playbook must classify the task first.
- Pattern: Stable AI systems separate controller logic from reasoning workers.
- Failure Mode: Implicit model usage makes behavior non-deterministic, hard to audit, and difficult to improve.

## Deterministic execution contract and run-state

Playbook now treats remediation/agent execution as first-class state, persisted as deterministic execution runs.

- Rule: Every multi-step remediation flow must be representable as a deterministic execution run artifact.
- Pattern: Agent-ready systems model actions as inspectable state transitions rather than transient command output.
- Failure mode: Without explicit run-state, the system cannot reliably resume, audit, compare, or learn from execution behavior.

Execution state is persisted under `.playbook/runs/<run-id>.json` and is queryable through `playbook query runs` and `playbook query run --id <run-id>`.

## Phase 8 progress update (lane compilation safety slice)

- Added deterministic `workset-plan` compilation from `orchestrate --tasks-file`.
- Execution-plan to lane-plan compilation now happens before any autonomous orchestration concerns.
- Worker-ready prompts are emitted per lane while unsupported/ambiguous tasks remain explicitly blocked.
- Added `playbook cycle` as the live thin runtime orchestrator over existing primitives (`verify -> route -> orchestrate -> execute -> telemetry -> improve`) with deterministic `.playbook/cycle-state.json` status artifacts.
- Added deterministic `lane-state` derivation at `.playbook/lane-state.json` so planned lanes become explicit tracked lifecycle state (`blocked`, `ready`, `running`, `completed`, `merge_ready`) with conservative merge and verification posture before any autonomous execution concerns.
- Added proposal-only lane lifecycle transition commands (`pnpm playbook lanes start <lane_id>`, `pnpm playbook lanes complete <lane_id>`) with strict dependency gating and conservative merge-ready recomputation.
- Rule — Lane lifecycle transitions must stay stricter than eventual automation behavior.
- Pattern — Readiness snapshots become operationally useful when they support deterministic state progression.
- Failure Mode — Static lane-state without lifecycle transitions cannot become a real orchestration layer.

### Adoption/readiness status surface (implemented)

- `pnpm playbook status --json` provides a deterministic adoption contract for connected repos: connection status, Playbook detection, governed artifact readiness, lifecycle stage, fallback-proof eligibility, cross-repo eligibility, blockers, and exact next commands.
- Observer repo cards/details now expose this readiness stage and first actionable next command without requiring manual artifact interpretation.

- Execution outcomes: adoption execution now has a deterministic receipt model, planned-vs-actual lifecycle comparison, observer retry/drift surfacing, and reconciled updated-state closure (`state -> queue -> execution plan -> execution receipt -> updated state`).
- Loop closure: explicit execution-result ingestion now drives the canonical control-loop boundary (`execution result -> receipt -> updated-state -> next queue`) through `.playbook/execution-outcome-input.json` and `pnpm playbook receipt ingest --json`.
- Next dependency-ordered step completed: post-receipt reconciliation now writes canonical updated adoption state, and deterministic queue derivation from updated-state now drives retry/replan/review routing without re-reading raw receipts.

- Outcome ingestion + reconciliation is complete, and queue derivation from updated-state is now the canonical next-step driver for adoption execution control flow.


- `playbook story list --json` exposes the canonical repo-local story backlog artifact at `.playbook/stories.json`.
- `playbook story candidates --json` derives and writes the non-canonical inspectable candidate artifact at `.playbook/story-candidates.json` without mutating `.playbook/stories.json`.
- `playbook story promote <candidate-id> --json` explicitly promotes one candidate into the canonical backlog artifact.
- `playbook promote story global/patterns/<pattern-id> --repo <repo-id> --json` seeds a repo-local story from promoted global pattern metadata while preserving `.playbook/stories.json` as the only execution-relevant backlog surface.
- `playbook patterns proposals --json` groups cross-repo comparisons into promotable portable-pattern/story candidates with evidence lineage and explicit governed promotion targets.
- `playbook patterns proposals promote --proposal <proposal-id> --target memory|story [--repo <repo-id>] --json` keeps cross-repo adoption explicit while bridging into reusable memory or canonical backlog surfaces.

- Rule: Stories are the durable repo-scoped action unit and must remain structured first, narrative second.
- Rule: Global knowledge may suggest local work, but only repo-local stories may enter execution planning.
- Pattern: Backlog state is a canonical repo-local artifact, not a UI-owned construct.
- Pattern: Findings need durable interpretation before they become backlog work.
- Pattern: Candidate stories require grouping, dedupe, and explicit promotion.
- Pattern: Reusable knowledge compounds when it can seed bounded local backlog items.
- Failure Mode: If story state is introduced without a canonical artifact and governed writes, backlog semantics fragment immediately.
- Failure Mode: Letting patterns enter execution directly creates a second control path and breaks operator trust.
- Failure Mode: Raw finding -> automatic story conversion creates backlog spam and weak planning signal.


- Pattern: Story is durable intent; Plan is execution shape; Receipt is observed outcome.
- Rule: Story, Plan, Worker, and Receipt must remain separate governed artifacts even when linked.
- Rule: Story lifecycle transitions must be driven by linked execution artifacts, not UI-only state.
- Failure Mode: Story status edited independently of receipt/updated-state creates split-brain backlog truth.
- Failure Mode: Collapsing planning and execution artifacts into story state destroys clear control-plane boundaries.
