# Playbook Architecture

This document describes **current-state architecture**. Future-state initiatives live in [PLAYBOOK_PRODUCT_ROADMAP.md](./PLAYBOOK_PRODUCT_ROADMAP.md). Long-term platform layering is documented in [architecture/PLAYBOOK_PLATFORM_ARCHITECTURE.md](./architecture/PLAYBOOK_PLATFORM_ARCHITECTURE.md).

Toroidal Flow is documented as an additive architecture overlay in [docs/architecture/TOROIDAL_FLOW.md](./architecture/TOROIDAL_FLOW.md). It preserves current command/runtime contracts and frames how execution and intelligence-return phases form a closed loop.

Research/theory bridge: pattern-meaning doctrine and attractor theory are captured in [docs/research/THEORY_OF_PATTERN_MEANING.md](./research/THEORY_OF_PATTERN_MEANING.md) and [docs/research/ATTRACTOR_MODEL_OF_MEANING.md](./research/ATTRACTOR_MODEL_OF_MEANING.md), with architecture mapping in [docs/architecture/EVOLUTIONARY_DYNAMICS_OF_KNOWLEDGE_GRAPHS.md](./architecture/EVOLUTIONARY_DYNAMICS_OF_KNOWLEDGE_GRAPHS.md).

Boundary rule: research docs describe conceptual models; architecture/runtime docs describe current or explicitly staged capability only.

## Documentation truth boundaries

- Live command behavior and status: `docs/commands/README.md` (authoritative operator surface).
- Strategic sequencing and future intent: `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.
- Machine-readable delivery commitments: `docs/roadmap/ROADMAP.json`.
- Historical/transitional planning notes: `docs/archive/` (non-authoritative for current operations).

Rule: architecture documents describe current-state design and bounded staged capability, not live command inventory status.


## System Design Doctrines

Playbook uses two first-class design doctrines:

- **Simple Rule Theory** (`[docs/architecture/SIMPLE_RULE_THEORY.md](./architecture/SIMPLE_RULE_THEORY.md)`): all automatable behavior should be expressed through explicit rules; rules should extract invariants, preserve minimal sufficient representation, and derive downstream behaviors/views from compact rule state rather than duplicating expanded state.
- **Triadic System Pattern** (`[docs/architecture/TRIAD_SYSTEM_PATTERN.md](./architecture/TRIAD_SYSTEM_PATTERN.md)`): stable workflows should prefer `state -> transformation -> enforcement`, with `verify -> plan -> apply` as the canonical Playbook workflow shape.

## External pilot doctrine boundary

The first external pilot clarified a core architecture need: deterministic system truth is necessary but not sufficient for adoption.

- **System truth** remains canonical, governed, and machine-readable.
- **Interpretation** is an additive representational layer that makes deterministic truth readable for humans.
- **Governance** still attaches to canonical artifacts and deterministic workflows, not to presentation logic.

Pattern: System -> Interpretation Gap.
Pattern: Interpretation Layer.
Pattern: Progressive Disclosure.

Pattern: Single Next Action.

Pattern: State → Narrative Compression.

Failure Mode: Building polished summaries before underlying diagnostics and recommendation signals exist leads to attractive but weak UX.

User-facing status, route, and observer readiness surfaces should present deterministic interpretation as a thin derived layer over canonical artifacts: default view shows state/why/next step, secondary view exposes blockers/reasoning, and deep view preserves raw JSON, receipts, diagnostics, and promotion metadata references without replacing the underlying truth.

Pattern: State -> Narrative Compression.

Failure Mode: Correct-but-dense outputs that require system knowledge reduce actionability and adoption.
Failure Mode: A repo can look integrated while still failing real governed consumption due to missing bootstrap/runtime/artifact guarantees.

### Interpretation-layer boundary

The interpretation layer is architecturally constrained:

- it does not modify source-of-truth artifacts
- it does not introduce nondeterministic state
- it derives human-facing summaries from deterministic system truth

Rule: Interpretation is representational only; canonical artifacts remain the sole source of truth.

### Reliability-before-governed-improvement doctrine

The pilot also clarified ordering doctrine for external adoption:

- stabilize tooling surface before governed product work
- tooling migration is incomplete until runtime + governance bootstrap proof passes
- first governed improvements should target correctness/performance seams with repeated logic and clear invariants

Rule: External adoption work must clear bootstrap/runtime/governance proof before higher-level product doctrine is considered complete.

### Read/write boundary doctrine

Architecture should keep read aggregation and write invalidation cleanly separated.

- **Pattern**: Shared aggregation boundary for reads, targeted invalidation boundary for writes.
- **Pattern**: Mutation path -> affected canonical IDs -> centralized recompute.
- Reads should compose through a shared aggregation layer so summaries, diagnostics, and explain surfaces consume the same truth.
- Writes should map mutations to affected canonical IDs and trigger centralized recompute instead of ad hoc local refresh paths.

Rule: Shared read aggregation and targeted write invalidation are required to keep deterministic truth coherent across product surfaces.

### Human-facing system compression

When system state grows dense, architecture should support compression layers rather than forcing consumers to reconstruct meaning themselves.

- Progressive disclosure keeps system depth available without making it mandatory.
- Single next action reduces ambiguity when the system has enough evidence to recommend a path.
- Narrative compression makes dense but correct state usable for real operators.

Rule: Architecture may add representational compression layers, but only as deterministic views over existing governed artifacts.

### Observer readiness boundary

The observer server/UI registration list is not equivalent to observability completeness. Observer surfaces compute deterministic readiness from repo-local `.playbook` directory and governed artifact presence only, and expose readiness state (`connected_only`, `playbook_detected`, `partially_observable`, `observable`) as additive metadata over repo registration records.

Rule: An observer UI must distinguish registration state from actual observability state.
Pattern: Connected repo -> readiness detection -> artifact observation.
Failure Mode: Treating registered repos as fully observed hides missing artifact evidence and causes operator misreads.


## Toroidal Flow and Knowledge Compaction artifact set

The Toroidal Flow + Knowledge Compaction architecture is also represented in compact reusable artifacts:

- Pattern: `patterns/pattern.closed_loop_intelligence.md`
- Rule: `rules/rule.intention_over_retention.md`
- Rule: `rules/rule.smallest_predictive_pattern.md`
- Principle: `architecture/principle.graph_before_theory.md`
- Principle: `architecture/principle.state_transformation_relation.md`

These artifacts capture deterministic architecture intent in reusable pattern/rule/principle cards while preserving existing runtime command contracts.

## System layering

Playbook is organized as a layered monorepo:

- **`packages/cli`**: command parsing, output rendering, and exit codes.
- **`packages/engine`**: deterministic analysis, verification, plan generation, and fix execution.
- **`packages/node`**: Node/runtime adapter utilities used by CLI and engine integration points.
- **`packages/core`**: shared core contracts/utilities retained for package compatibility.

Primary flow:

`CLI -> engine (+ node adapter) -> repository`

## Canonical integration model: shared core, local intelligence

Playbook has two distinct architecture surfaces that must not be conflated:

1. **Playbook core product (shared engine):** the reusable CLI + engine + contracts shipped by the Playbook project.
2. **Consumer-repo integration (project-local Playbook state):** repository-local configuration, intelligence artifacts, plans, and optional extensions generated/owned by the consuming repository.

Rule: **Installing Playbook into another repository creates project-local Playbook state, not a Playbook fork by default.**
Rule: **Consumer repositories should run Playbook from repo-local dependency installs; global PATH resolution is non-canonical.**

Project-local Playbook state typically includes:

- `playbook.config.json` (or `.playbook/config.json`) for local policy/configuration.
- `.playbook/repo-index.json` and other generated intelligence artifacts.
- `.playbook/plan.json` and similar remediation artifacts.
- repository-specific rules/extensions used by that repository.

Playbook core remains shared; repository-local state remains owned by the consuming project.

Deterministic consumer runtime resolution order:

1. `PLAYBOOK_BIN` explicit override.
2. Repo-local CLI install (`node_modules/.bin/playbook`, typically via `pnpm playbook ...`).
3. Optional local checkout fallback for development-only workflows (non-canonical).
4. Explicit actionable failure when no runtime is resolvable.

## Promotion boundary: local observations vs upstream product learnings

Playbook intentionally separates repository observations from core product evolution.

- **Local by default:** project-specific findings, architectural context, and rule outcomes stay in the consumer repository.
- **No hidden upstream mutation:** local command execution must not automatically mutate Playbook core.
- **Intentional upstream promotion:** generalized patterns, reusable rules, and product-level gaps should be promoted upstream deliberately through docs/roadmap/rule proposals and reviewed implementation.

Failure mode to avoid: treating project-specific customization as a core fork, which creates drift, duplicate fixes, and unclear ownership.

Preferred extension strategy for consuming repositories:

- configuration and policy tuning
- plugin-style extension points (as available)
- repository rule packs

Pattern: **prefer config/plugins/rule packs over core forks** unless a fork is unavoidable.

## Privacy and trust model

Playbook operates as **private-first by default**:

- scanning/indexing happens locally in the repository context
- generated artifacts remain local unless users explicitly export/share them
- no automatic upstream code/content export is implied by standard command usage

Any future export, sync, telemetry, or cloud-backed intelligence behavior must be explicit and opt-in.

## Architecture introspection commands

Playbook explain supports architecture-registry-backed ownership introspection:

- `pnpm playbook explain subsystem <name>` resolves subsystem ownership by canonical subsystem name.
- `pnpm playbook explain artifact <path>` resolves artifact ownership by exact artifact path.
- `pnpm playbook explain command <name>` resolves deterministic command inspection details for execution-oriented commands.

These explain surfaces are registry-backed and lineage-backed:

- subsystem ownership comes from `.playbook/architecture/subsystems.json`
- artifact and command downstream relationships come from architecture dependencies and artifact lineage mappings
- cycle runtime summaries at `.playbook/cycle-state.json` are explainable through `playbook explain artifact` with deterministic cycle metadata, ordered step execution details, and surfaced `artifacts_written` evidence
- `.playbook/cycle-state.json` is now a schema-governed runtime artifact (`packages/contracts/src/cycle-state.schema.json`) and is registered in deterministic contracts surfaces to prevent orchestration-summary shape drift
- `.playbook/cycle-history.json` is now a schema-governed runtime evidence artifact (`packages/contracts/src/cycle-history.schema.json`) derived strictly from `.playbook/cycle-state.json` so historical cycle outcomes accumulate without changing orchestration decision logic
- command inspection emits deterministic text/JSON fields for subsystem ownership, artifacts read, artifacts written, rationale summary, downstream consumers, and common failure prerequisites

All lookups fail deterministically for unknown targets and support `--json` machine-readable output for automation.



## Canonical System Blueprint artifact

Playbook now publishes a canonical architecture/runtime visualization artifact at `.playbook/system-map.json` generated by `pnpm playbook diagram system` and automatically refreshed during `pnpm playbook index` flows.

- Rule: **System architecture visualization must be derived from a canonical artifact, not hardcoded UI logic.**
- Pattern: **Artifact -> Explain -> UI render.**
- Failure mode: **If diagrams are maintained manually or only in UI code, they drift from real command/runtime behavior.**

`playbook explain artifact .playbook/system-map.json` returns the structured system map payload, and Observer UI consumes the same artifact to render the “System Blueprint” panel (layers, nodes, and edges) as a read-only renderer.

## Portability confidence recalibration loop

Portability scoring remains recommendation-first and now has an explicit recalibration stage across `knowledge_lifecycle`, `telemetry_learning`, and `improvement_engine`.

- Base portability evidence remains append-only in `.playbook/pattern-portability.json`.
- Cross-repo priors from `.playbook/cross-repo-patterns.json` and transfer outcomes from `.playbook/portability-outcomes.json` are combined into governed recalibration summaries at `.playbook/portability-confidence.json`.
- Portability outcome records in `.playbook/portability-outcomes.json` now capture deterministic recommendation trace fields (`recommendation_id`, `pattern_id`, `source_repo`, `target_repo`, `decision_status`, optional decision/adoption/outcome metadata, `timestamp`) and are append-safe with stable ordering for downstream telemetry-learning and repository-memory summaries.
- Recalibration never rewrites prior portability scores; it emits explicit `recommended_adjustment` guidance and preserves original score inspectability.
- Sparse evidence is treated conservatively and emitted as open questions to prevent static-confidence illusions.


## Command-quality telemetry coverage

Core execution commands (`verify`, `route`, `orchestrate`, `execute`, `telemetry`, `improve`) emit deterministic command-quality records to `.playbook/telemetry/command-quality.json` and append repository-memory `command_execution` events that capture command name, run id, artifact IO, duration, and completion status.

`playbook cycle` is an orchestration-only wrapper over that hardened primitive sequence. It runs the existing handlers in order and persists `.playbook/cycle-state.json` as a deterministic summary artifact without introducing duplicate routing/orchestration/execution logic.

`improvement_engine` now derives recommendation-first command hardening proposals from command-quality telemetry, optional command-quality summary artifacts, normalized repository memory events, and governed cycle runtime evidence (`.playbook/cycle-history.json`, optional `.playbook/cycle-state.json`, and optional telemetry-cycle summary/regression outputs when present). The governed result is persisted at `.playbook/command-improvements.json` and surfaced via `playbook improve commands`, with explicit evidence gating, conservative open-question output for sparse runtime signals, deterministic ordering/wording, and no autonomous command mutation.

This keeps command-level self-observation complete across execution surfaces and avoids partial observability bias in downstream learning and improvement analysis.

`playbook telemetry commands` now provides deterministic operator/automation summaries sourced from `.playbook/telemetry/command-quality.json`, exposing stable per-command rates for success/failure/partial outcomes, average duration/confidence, warning/open-question frequency, and downstream artifact frequency across `verify`, `route`, `orchestrate`, `execute`, `telemetry`, and `improve`.


`playbook policy evaluate` adds a read-only governance classification layer over improve proposals. It consumes governed proposal metadata and runtime evidence (`.playbook/improvement-candidates.json`, optional cycle regression evidence from `.playbook/cycle-history.json`) and deterministically classifies each proposal as `safe`, `requires_review`, or `blocked` without executing remediation.

`.playbook/policy-evaluation.json` is now treated as a first-class control-plane artifact: schema-governed (`packages/contracts/src/policy-evaluation.schema.json`), registered in contract surfaces, deterministically ordered by `proposal_id`, non-fatally validated at write time, and explainable through `playbook explain artifact .playbook/policy-evaluation.json` (summary counts, per-proposal decision/reason, and evidence signals when present).

Pattern: introduce evaluation before execution — proposals must pass deterministic policy classification before any action workflow.

`playbook apply --policy` is the first mutation-capable control-plane execution step and is intentionally narrow: it consumes persisted `.playbook/policy-evaluation.json`, executes only `safe` proposals, refuses `requires_review`/`blocked`, and emits deterministic `.playbook/policy-apply-result.json` on every run for auditability (including no-op runs). `.playbook/policy-apply-result.json` is now a schema-governed execution audit layer (`packages/contracts/src/policy-apply-result.schema.json`) and is explainable through `playbook explain artifact .playbook/policy-apply-result.json`.

Rule: mutation-capable policy execution must consume governed policy artifacts and run only explicitly eligible (`safe`) proposals.

Failure mode: if execution broadens beyond explicit `safe` decisions, control-plane autonomy outpaces governance trust.

`.playbook/session.json` now includes an additive `evidenceEnvelope` contract as the canonical deterministic session/evidence slice for governed execution auditability. The envelope links session/run context to existing runtime/control-plane artifacts (`.playbook/cycle-state.json`, `.playbook/cycle-history.json`, `.playbook/improvement-candidates.json`, `.playbook/policy-evaluation.json`, `.playbook/policy-apply-result.json`) and preserves stable stage lineage (`session -> proposal_generation -> policy_evaluation -> execution_result`) plus proposal IDs, policy decisions, and execution result references when present.

`.playbook/pr-review.json` is now a first-class governed control-plane artifact produced by `playbook review-pr` on every run. The artifact persists the existing review output contract (findings, proposals, policy grouping, and summary) with deterministic ordering, schema governance (`packages/contracts/src/pr-review.schema.json`), and explainability through `playbook explain artifact .playbook/pr-review.json` for findings/proposals/policy breakdown introspection.

The session evidence envelope now references `.playbook/pr-review.json` and extends lineage ordering to `session -> proposal_generation -> policy_evaluation -> pr_review -> execution_result` so PR review evidence is explicitly auditable alongside policy and execution artifacts.

An additive observer ingestion layer now composes governed artifacts from registered repositories into a deterministic read-only snapshot at `.playbook/observer/snapshot.json` using `.playbook/observer/registry.json` as the source-of-truth repo list. Ingestion is restricted to known control-plane and blueprint artifacts (`cycle-state`, `cycle-history`, `policy-evaluation`, `policy-apply-result`, `pr-review`, `session`, `system-map`), never mutates source repositories, records warning metadata for missing/malformed/invalid-kind inputs, and preserves stable repo/artifact ordering for reproducible cross-repo comparisons.

Rule: every governed decision or execution step must be traceable through a deterministic evidence envelope.
Pattern: unify existing artifacts through referenceable evidence chains before adding broader orchestration or learning layers.
Failure Mode: runs/decisions/artifacts that remain unlinked become difficult to audit, explain, and evolve even when each artifact is individually correct.

Observer wrappers can now maintain a deterministic multi-repo registry at `.playbook/observer/repos.json` (`kind: repo-registry`) containing explicit connected repo roots, stable ids, and per-repo `.playbook` artifact roots. This observer registry is read-only control-plane support for local/server wrappers and does not replace per-repo runtime artifacts as canonical sources of truth.

Rule: multi-repo observation must start from explicit deterministic registry state rather than implicit filesystem scanning.
Pattern: runtime remains canonical per repo while observer indexing tracks connected repos and artifact roots.
Failure Mode: ambient path-scanning introduces non-deterministic cross-repo visibility and erodes trust.

`playbook observer serve` now adds a thin local-only (`127.0.0.1`/`localhost`) dashboard + API wrapper over the existing observer repo registry (`.playbook/observer/repos.json`), optional observer snapshot artifact (`.playbook/observer/snapshot.json`), and governed per-repo artifacts. v1 keeps observer state canonical in CLI/runtime artifacts while exposing deterministic `GET` endpoints (`/health`, `/repos`, `/snapshot`, `/repos/:id`, `/repos/:id/artifacts/:kind`), local dashboard routes (`/`, `/ui`, `/ui/app.js`), and narrowly scoped registry mutations (`POST /repos`, `DELETE /repos/:id`) only for connect/disconnect actions.

Observer now includes a first-class self-observation presentation for the Playbook repo without introducing a second model: the same repo registry/readiness/artifact APIs provide deterministic `home_repo_id` selection metadata (cwd root match, then `self|home` tags, then `playbook` id/name) and the same governed artifacts feed a specialized UI panel for runtime loop, control-plane evidence, and system-map blueprint status.

Rule: Playbook should observe itself through the same governed observer model it uses for external repos.
Pattern: one observer model, special self-view presentation.
Failure Mode: if self-observation uses hidden or dashboard-only state, operator trust degrades because self-view diverges from governed repo evidence.

Workflow-promotion state is now a first-class cross-layer concern rather than CLI-only output. The shared `workflow-promotion` contract flows through the execution receipt, Observer readiness APIs, and the Observer dashboard so staged candidate paths, validation outcome, promotion result, and committed-target preservation remain queryable without re-deriving state from terminal logs.

Rule: Promotion state must be visible and queryable across system layers.
Pattern: Workflow-promotion metadata flows through CLI -> engine -> API -> UI.
Failure Mode: Hidden promotion state prevents system-level reasoning and safe orchestration.

Observer blueprint surfaces now derive per-node state/activity directly from readiness and governed artifacts (`active`, `available`, `missing`, `stale`, `idle`) and keep self-observation collapsible so repo detail + blueprint remain primary. Node selection is inspection-only and reuses artifact-viewer truth surfaces instead of introducing dashboard-owned state contracts.

Rule: Blueprint state must be derived from governed artifact truth, not UI heuristics.
Pattern: static architecture map -> stateful blueprint -> selected-node inspection.
Failure Mode: if large static summaries dominate the page while live system state remains secondary, operational signal density collapses and operator decisions degrade.

Rule: observer UI/server surfaces must wrap canonical Playbook state, never become a second source of truth.
Pattern: CLI/runtime stays canonical -> local server wraps governed artifacts/registry commands -> UI observes and renders.
Failure Mode: if repo registration or artifact state is tracked independently in UI/server memory, observer state drifts from real Playbook runtime truth.

## Router accuracy telemetry feedback loop

Routing quality is treated as a measurable architecture contract inside `routing_engine` + `telemetry_learning`.

- Planned route shape is captured from `.playbook/execution-plan.json` and `.playbook/workset-plan.json`.
- Realized execution shape is captured from `.playbook/execution-state.json` and `.playbook/outcome-telemetry.json`.
- Deterministic router-fit scoring compares planned vs realized lane parallelism, validation cost fit, execution success, and retry pressure.
- Router accuracy metrics are persisted in `.playbook/process-telemetry.json` and folded into `.playbook/learning-state.json` for conservative routing refinement.
- Cross-run compaction merges `.playbook/process-telemetry.json`, `.playbook/outcome-telemetry.json`, `.playbook/memory/events/*`, and `.playbook/memory/index.json` into `.playbook/learning-compaction.json` to provide stable recurring failure/success summaries before recommendation or promotion flows.
- `playbook telemetry learning` is the deterministic compaction surface for `knowledge_lifecycle`, `repository_memory`, and `telemetry_learning`, with explicit missing-artifact degradation via `open_questions`.
- `playbook improve` now computes proposal-only router recommendations from router accuracy telemetry, lane scoring outcomes, compacted learning summaries, and normalized memory events; recommendations are persisted to `.playbook/router-recommendations.json` and never mutate router behavior without explicit review.

Rule: routing quality must be observable and scored, otherwise route strategy cannot improve deterministically.

## CLI command architecture

- CLI command handlers live in `packages/cli/src/commands/`.
- `packages/cli/src/commands/index.ts` is the central command registry and dispatch surface.
- Shared CLI helpers live in `packages/cli/src/lib/`.
- Engine behavior and rule execution logic should stay in `packages/engine`, not command files.

This separation keeps command modules thin and keeps governance logic reusable/testable.

## Doctor aggregation architecture

`doctor` is the repository health aggregation command. It orchestrates existing command/engine analyzers and normalizes them into a shared diagnostic schema.

Aggregation inputs:

- verify diagnostics (`verify`)
- module risk diagnostics (`query risk`)
- documentation governance diagnostics (`docs audit`)
- repository intelligence availability (`.playbook/repo-index.json`)

This keeps diagnosis logic deterministic while avoiding analyzer duplication in CLI command code.

## Analyze -> verify -> plan -> apply flow

Playbook governance execution follows a staged flow:

1. **`analyze`** detects repository structure and stack signals.
2. **`verify`** executes deterministic governance rules and returns findings.
3. **`plan`** converts verify failures into ordered, machine-safe tasks.
4. **`apply`** executes deterministic auto-fixable tasks from a generated plan.

`fix` remains available as a convenience command for direct local remediation flows, but the canonical machine-safe execution path is `plan -> apply`.

`plan` and `apply` are the machine-safe planning/execution path for remediation.

In the Toroidal Flow overlay, this execution flow is the **forward execution arc** and `apply` is treated as a midpoint for full-cycle architecture framing rather than a terminal endpoint.

## Repo-scoped Stories / Backlog seam

Playbook's current deterministic runtime now includes canonical repo story state, candidate derivation, explicit promotion, and read-only Observer backlog rendering. The Stories / Backlog layer sits **between** detection and execution rather than replacing either side.

Canonical lifecycle:

`Detection -> Candidate Story -> Story -> Plan -> Worker -> Receipt`

Separation of concerns:

- **Detection / findings**: granular evidence emitted by analysis, verify, readiness, observer, or other governed signals.
- **Candidate story**: a read-only proposed durable work item derived from governed evidence and stored separately from canonical backlog truth.
- **Story**: the durable scoped unit of work for one repository and the canonical backlog artifact.
- **Backlog**: the per-repo queue/view over canonical stories.
- **Plan**: deterministic execution strategy generated from a story; plans are execution intent, not backlog truth.
- **Workers**: PR-sized implementation lanes derived from a plan; worker contracts are execution decomposition, not planning state.
- **Receipt**: observed execution outcome tied back to what actually happened; receipts capture realized outcomes, not durable planning intent.

Why this seam is needed:

- findings are often too granular for humans to manage directly.
- deterministic systems can surface many correct warnings without telling operators which related signals should become one durable work item.
- execution artifacts are intentionally transient/planned outputs, while stories must persist across sessions, retries, and alternative execution attempts.

Implemented architecture boundaries today:

- `.playbook/stories.json` is the canonical repo-scoped story/backlog artifact.
- `.playbook/story-candidates.json` is the candidate-derivation artifact and must remain read-only relative to canonical story state until explicit promotion occurs.
- Observer may render backlog state from `.playbook/stories.json`, but Observer is a read-only presentation seam and must not become the canonical story system.
- story-linked routing and execution metadata are additive linking seams; they do not collapse Story, Plan, Worker, and Receipt into one shared artifact.

Pattern: Detection -> Story -> Plan -> Execution -> Receipt.
Pattern: Detection needs durable interpretation.
Rule: Stories must be structured first, narrative second.
Failure Mode: Backlog spam from raw findings.

### Story model and remaining future seams

The canonical story/backlog seam is implemented, but this model still describes the intended durable shape and the fields that should remain queryable as the lifecycle deepens.

```json
{
  "id": "story_...",
  "repo": "repo-id-or-root",
  "title": "Add deterministic docs audit fix flow",
  "type": "governance",
  "source": "detected",
  "severity": "medium",
  "priority": "high",
  "confidence": 0.86,
  "status": "backlog",
  "evidence": [],
  "rationale": "Why this should become durable work.",
  "acceptance_criteria": [],
  "dependencies": [],
  "execution_lane": "safe_single_pr",
  "suggested_route": "verify_plan_apply"
}
```

Minimum structured fields:

- `id`
- `repo`
- `title`
- `type` (`bug`, `architecture`, `governance`, `debt`, `feature`, `docs`, `investigation`)
- `source` (`detected`, `manual`, `imported`)
- `severity`
- `priority`
- `confidence`
- `status` (`backlog`, `ready`, `planned`, `in_progress`, `blocked`, `done`, `archived`)
- `evidence`
- `rationale`
- `acceptance_criteria`
- `dependencies`
- `execution_lane` (`safe_single_pr`, `safe_parallel`, `needs_human`, `blocked`)
- `suggested_route`

Design guardrails:

- story fields should be deterministic and queryable before any narrative summary layer.
- candidate stories derived from findings must support grouping, dedupe, and explicit promotion rather than automatic one-warning-to-one-story conversion.
- story storage should remain repo-scoped and local-first.
- observer/UI surfaces may render backlog state later, but UI wrappers must not become the canonical story source of truth.
- external issue import/export can be additive later, but Playbook should not turn into a generic Jira clone.

Still-future scope:

- deterministic priority scoring for stable backlog ordering.
- dependency-aware story ordering.
- deeper `story -> plan -> worker -> receipt` lifecycle transitions and replay/update integration.
- optional import/export bridges to external issue systems without changing canonical source-of-truth ownership.

Non-goals for this layer:

- no sprint planning, assignees, comments, boards, or generic PM workflow as core architecture scope.
- no automatic promotion of every finding into a first-class story.
- no collapsing of Story, Plan, Worker, and Receipt into one shared artifact.

## Deterministic task and output contracts

The plan/execution pipeline is deterministic by contract:

- Verify findings are sorted before task generation.
- Task fields are stable (`ruleId`, `file`, `action`, `autoFix`).
- Nullable values are normalized (`file: null` when evidence is absent).
- JSON responses are structured for automation, not best-effort prose parsing.

Deterministic JSON output is treated as a public interface for CI, tooling, and agents.

## Worker coordination and lane readiness surfaces

Worker coordination now uses explicit readiness and conflict-surface contracts before execution handoff.

- `workset-plan` lane entries include machine-readable readiness fields:
  - `readiness_status`
  - `blocking_reasons`
  - `conflict_surface_paths`
  - `shared_artifact_risk`
  - `assignment_confidence`
- `workset-plan.validation` surfaces deterministic pre-execution risk findings for:
  - overlapping file domains across lanes
  - conflicting artifact ownership implications
  - dependency-blocked lanes waiting on upstream completion
- `lane-state` carries readiness status and conflict explanation forward so blocked/ready semantics remain explicit across lifecycle transitions.
- `worker-assignments` exposes a `readiness_summary` and per-lane conflict details so `playbook workers` and `playbook workers assign` report ready lanes, blocked lanes, reasons, and conflict surfaces directly.

Rule: **Parallel workers must advertise conflict surfaces before execution starts.**

Pattern: **Readiness before assignment.**

Failure mode: **Hidden overlap** creates merge chaos when lane conflict surfaces are implicit instead of explicit.


## Safe Repository Mutation Model

Playbook provides a deterministic mutation engine with built-in safety guarantees for repository changes. Repository content is always treated as untrusted input, and policy enforcement occurs before any mutation is allowed.

Core guardrails in the mutation engine:

- **Repo Root Security Boundary**: all reads and writes must resolve within the repository root.
- **Remediation Plan Validation**: plans are schema-validated and invariant-checked before execution.
- **Evidence-Linked Plans**: each task must map back to deterministic findings and file-level evidence.
- **Secret Redaction in Logs**: execution and diagnostic logs must avoid leaking secrets or sensitive values.
- **CI Artifact Verification**: automation flows verify remediation artifacts and command contracts in CI.
- **Signed Supply Chain Artifacts**: release and security artifacts are signed and verifiable for provenance integrity.

The engine enforces policy gates before `apply`, ensuring that only approved and validated plan tasks can mutate repository state.

## Security Contracts

Playbook encodes runtime safety guarantees as machine-readable security contracts under `docs/contracts/security/`, and verifies those guarantees with deterministic contract tests under `test/contracts/security/`.

This contract layer maps each guarantee to a concrete runtime guard and test expectation so regressions fail fast in CI.

- Pattern: **Security Contracts** — machine-readable definitions of runtime safety guarantees.
- Pattern: **Contract-Driven Security Tests** — CI verifies engine security behavior through contract definitions.
- Rule: **Apply Scope Enforcement** — apply may only modify files declared in the plan.
- Rule: **Repository Boundary** — file operations must resolve within repo root.
- Rule: **Secret Redaction** — sensitive values must never appear in logs.
- Failure Mode: **Boundary Escape** — path traversal or symlink attacks attempting to escape repo root.

## Long-Term Direction: Automation Synthesis

Automation Synthesis is a future platform direction that extends Playbook's `verify -> plan -> apply` philosophy into recurring-work automation, while preserving deterministic governance.

Separation of concerns should remain explicit:

1. **Trigger ingestion**: collect recurring-work signals from repository workflows and approved remediation history.
2. **Pattern classification/template selection**: map signals to known, policy-backed automation templates.
3. **Prompt generation**: build bounded synthesis prompts from deterministic contracts and template context.
4. **LLM output generation**: produce candidate automation artifacts as draft outputs.
5. **Sandbox verification**: execute and test candidates in isolated environments against deterministic checks.
6. **Approval gates**: require explicit human/policy approval before promotion.
7. **Deployment/orchestration**: publish approved automations to selected orchestration backends through controlled interfaces.
8. **Runtime monitoring/rollback**: track behavior, alert on drift/failures, and support deterministic rollback.

Rule: generated automations are **untrusted by default** and must not execute in trusted environments until verification and approval gates pass.

## Future Direction: Playbook Agents

Playbook's `verify -> plan -> apply` architecture is intentionally designed to enable safe integration with automated agents over time.

Conceptual control flow:

AI reasoning layer
↓
Playbook query/analysis layer
↓
Playbook remediation planning
↓
policy validation
↓
controlled apply execution

Agents should never write directly to the repository. All mutations must pass through the Playbook remediation pipeline so changes remain deterministic, reviewable, and policy-enforced.

## Future direction: embeddable runtime/API for app-integrated actions

For internal dashboards, CI control planes, admin panels, and product-integrated tooling, Playbook should expose server-side/library integration surfaces over time.

Design direction:

- expose validated server-side actions for capabilities such as `index`, `query`, `ask`, `explain`, and remediation orchestration
- keep repository mutations behind policy-checked server/runtime boundaries
- avoid browser-side arbitrary command execution as the default integration path

Pattern: app-integrated Playbook actions should call a **server-side API/runtime** (or trusted library surface) rather than executing raw CLI commands directly from browser clients.

## Rule: Playbook Analyzes but Does Not Author

Playbook provides structured analysis, diagnostics, and recommendations about repository state and development workflows.

Playbook does **not rewrite developer intent or author pull requests automatically**.

Its role is to provide architecture intelligence that informs developers rather than replacing developer judgment.




## Repository Memory System architecture (first-class, non-runtime-changing)

Playbook now defines an explicit Repository Memory System architecture in `docs/architecture/REPOSITORY_MEMORY_MODEL.md`.

Layering stance:

- structural intelligence: `.playbook/repo-index.json`, `.playbook/repo-graph.json`
- working context: `.playbook/context/*`
- episodic memory: `.playbook/memory/events/*.json`, `.playbook/memory/index.json`
- replay/consolidation: `.playbook/memory/candidates.json`
- doctrine/policy memory: rules, contracts, docs, remediation templates

Rule: `.playbook/repo-graph.json` remains the structural graph contract and must not be repurposed as the full temporal memory store.
Pattern: Structural Graph + Memory Graph/Index.

This addition is architectural doctrine and roadmap/contract clarification only; it does not change current runtime behavior.

## Improvement proposal evidence-gating architecture

Improvement proposals produced by `playbook improve` are deterministically gated using telemetry + normalized repository memory evidence.

Deterministic gating tiers:

- `AUTO-SAFE`: requires strong repeated evidence (`evidence_count` + `supporting_runs`) and no governance-sensitive action shape.
- `CONVERSATIONAL`: review-required proposals with adequate evidence but non-governance-sensitive scope.
- `GOVERNANCE`: explicit trust-boundary/doctrine proposals that always require review.

Each proposal now carries machine-readable gating evidence (`evidence_count`, `supporting_runs`, `confidence_score`), decision metadata (`gating_tier`, `required_review`), and explicit rejection context (`blocking_reasons` for rejected candidates).

Rule: improvement proposals must be evidence-gated before promotion.
Pattern: tiered improvement governance separates automation-safe improvements from review-required changes.
Failure mode: ungated self-modification accumulates noisy/unsafe optimization pressure and erodes trust boundaries.

## Repository graph contract layer

Playbook maintains a deterministic repository graph artifact at `.playbook/repo-graph.json` generated by `pnpm playbook index`.

Current graph contract stance:

- versioned JSON contract (`schemaVersion`) with explicit additive-vs-breaking evolution policy
- deterministic, low-cost edges derived from existing index/rule metadata (`contains`, `depends_on`, `governed_by`)
- read-runtime reuse through additive neighborhood summaries in existing `query`/`explain` paths instead of a broad new graph command family

Contract details and downstream consumer guidance live in `docs/contracts/repository-graph-contract.md`.

The graph feeds a compressed module-runtime layer at `.playbook/context/modules/*.json` generated by `pnpm playbook index`. These digests are layer-relative knowledge units (identity, dependencies/dependents, docs/tests/risk summaries, graph-neighborhood kinds) reused by existing read surfaces (`query impact`, `explain <module>`) to reduce repeated broad inference.

## Playbook Architecture Registry

Playbook architecture is now encoded as a first-class machine-readable registry at `.playbook/architecture/subsystems.json`.

The registry defines subsystem doctrine using deterministic fields:

- `name`: canonical subsystem identifier
- `purpose`: subsystem responsibility statement
- `commands`: CLI commands owned by the subsystem
- `artifacts`: repository artifacts owned by the subsystem

### Subsystem ownership doctrine

Rule: every Playbook artifact must be owned by exactly one subsystem.

This prevents ownership ambiguity and enforces deterministic architecture boundaries between intelligence, governance, orchestration, and learning layers.

Failure mode: **Artifact Drift** — if a single artifact is written or claimed by multiple subsystems, runtime contracts become non-deterministic.

### Architecture verification

Use the dedicated verifier command:

- `pnpm playbook architecture verify`

The verifier validates:

- subsystem registry schema integrity
- artifact-path validity
- duplicate artifact ownership
- command-to-CLI mapping integrity

The command reports a deterministic architecture integrity verdict:

- `Architecture integrity: PASS`
- `Architecture integrity: FAIL`

## Execution Supervisor

Execution Supervisor is the runtime subsystem positioned between orchestration planning and worker coordination.

Flow position:

`Orchestration Planner -> Execution Supervisor -> Workers`

Runtime responsibilities:

- start deterministic execution runs from `.playbook/workset-plan.json`
- initialize and update `.playbook/execution-state.json`
- track lane lifecycle transitions (`ready`, `running`, `completed`, `failed`, `blocked`)
- record worker execution outcomes and retries
- emit deterministic telemetry signals to `.playbook/process-telemetry.json`

Execution artifact contract (`.playbook/execution-state.json`) stores run-level status, lane runtime state, and worker metadata so execution remains auditable and deterministic across invocations.


## Repository memory normalized event schema

Repository memory operational events now use one canonical envelope for deterministic indexing and later compaction/promotion:

- `event_id`, `event_type`, `timestamp`
- `subsystem`, `subject`, `related_artifacts`
- `payload` (event-specific body)
- optional `run_id`

Operational event types in this normalized stream:

- `route_decision`
- `lane_transition`
- `worker_assignment`
- `execution_outcome`
- `improvement_signal`

Rule: operational memory must use one event schema.
Pattern: normalized event stream enables deterministic replay/query/compaction workflows.
Failure mode: memory shape drift fragments retrieval and promotion quality.

Query/inspection surface:

- `playbook memory query` provides deterministic normalized filtering by `event_type`, `subsystem`, `run_id`, `subject`, and `related_artifact`.
- deterministic summary views expose recent route decisions, lane transitions for a run, worker assignments for a run, and artifact-scoped improvement signals.
- JSON mode remains contract-stable for automation and agent consumption.


- `playbook knowledge portability` provides deterministic cross-repo portability inspection views (`overview`, `recommendations`, `outcomes`, `recalibration`, `transfer-plans`, `readiness`, `blocked-transfers`) so transfer recommendations, planning state, and target readiness remain auditable.
- Transfer planning views read governed artifacts `.playbook/transfer-plans.json` and `.playbook/transfer-readiness.json` and expose stable fields for `pattern`, `source_repo`, `target_repo`, `portability_confidence`, `readiness_score`, `touched_subsystems`, `required_validations`, `blockers`, and `open_questions`.


## Learning evidence loop ownership and determinism

The implemented learning loop is deterministic and artifact-owned by one authoritative subsystem per artifact:

`execution_supervisor` → `telemetry_learning` → `repository_memory` → `telemetry_learning` compaction → `improvement_engine` recommendations → `knowledge_lifecycle` inspection/promotion.

Canonical ownership highlights:

- `.playbook/execution-state.json` → `execution_supervisor`
- `.playbook/process-telemetry.json` / `.playbook/outcome-telemetry.json` / `.playbook/learning-compaction.json` → `telemetry_learning`
- `.playbook/memory/events/*` / `.playbook/memory/index.json` → `repository_memory`
- `.playbook/router-recommendations.json` / `.playbook/improvement-candidates.json` → `improvement_engine`

Determinism invariants for this loop:

- JSON artifacts are written with stable key ordering.
- Artifact writes use atomic replace semantics.
- Memory events remain append-only while memory index is deterministic and rewrite-safe.
- Missing upstream artifacts degrade gracefully rather than causing non-deterministic fallback behavior.

## Deterministic doctrine promotion pipeline

Playbook now includes a deterministic, recommendation-first doctrine pipeline that composes compacted learning summaries, router recommendations, improvement proposals, and normalized repository memory evidence into governed knowledge lifecycle candidates.

- Artifact: `.playbook/knowledge-candidates.json`
- Artifact: `.playbook/knowledge-promotions.json`
- Lifecycle stages: `candidate -> compacted -> promoted -> retired`
- Governance behavior: governance-tier promotion remains gated and never mutates doctrine autonomously.
