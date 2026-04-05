# Playbook Command Status Index

This is the authoritative command-state snapshot for Playbook product docs.

## Operator truth boundary

For live command behavior/status questions, this page is the canonical operator surface.
Roadmap and planning docs may describe sequencing intent, but they are not command-status authority.

## Command truth

- The canonical operator-facing command surface is `pnpm playbook <command>`.
- Direct `node packages/cli/dist/main.js <command>` examples are internal/debug-oriented unless explicitly labeled otherwise.
- `npx`/published-package command examples are not part of current operator guidance unless distribution docs explicitly say so.

## Deterministic governance gates

- High-value doctrine/process doc revisions should follow `docs/architecture/PLAYBOOK_DOCUMENTATION_REVISION_PROTOCOL.md` so fact, interpretation, and narrative changes are reviewable as distinct layers.
- High-value architecture decisions should follow `docs/architecture/PLAYBOOK_CONSTRAINT_DRIVEN_ARCHITECTURE_RUBRIC.md` and use `templates/repo/docs/architecture/PLAYBOOK_ARCHITECTURE_DECISION_TEMPLATE.md` so shape rationale is constraints-first.
- `pnpm docs:check` blocks managed command-state drift (`AGENTS.md`, this command index, and `docs/contracts/command-truth.json`) by regenerating candidate outputs first, validating roadmap/docs governance against the regenerated set, and only then reporting whether promotion would be required.
- `node scripts/validate-roadmap-contract.mjs --ci` blocks roadmap/live-command boundary drift by validating roadmap `commands` against `docs/contracts/command-truth.json`.
- `pnpm playbook docs audit --ci --json` blocks command-truth drift findings marked as errors (for example duplicate command metadata or managed status-table mismatch).
- `pnpm playbook docs consolidate --json` is the proposal-only integration seam for protected singleton narrative docs: workers emit fragments, the consolidator emits one compact brief plus `.playbook/docs-consolidation.json`, and no doc mutation happens automatically in v1. Reviewed writes remain target-locked and execute only through `pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json`.
- `pnpm playbook workers submit --from <path> --json` is the canonical worker-receipt seam: worker execution outputs must enter Playbook through explicit result artifacts, not inferred file diffs.
- `pnpm playbook verify --json` now fails closed for protected singleton-doc governance when existing governed artifacts show unresolved consolidation, reviewed-plan gaps, consolidation conflicts, or guarded-apply drift on reviewed singleton-doc targets. `pnpm playbook verify --policy --json` inherits the same gate through the default `protected-doc.governance` policy rule.
- `pnpm playbook apply` now fails closed against declared `.playbook/change-scope.json` bundles by enforcing `allowedFiles`, `patchSizeBudget`, and required boundary checks before mutation success is reported.
- `pnpm playbook apply --from-plan .playbook/maintenance-plan.json --maintenance-approvals .playbook/maintenance-approvals.json` is the approval-gated bounded maintenance execution bridge: only approved rows with safe policy entries and present evidence refs execute, and deterministic maintenance receipt/state artifacts are persisted.
- Rule: Declared mutation scope must be enforced before apply succeeds.
- Pattern: Declare scope -> enforce scope -> mutate -> receipt.
- Failure Mode: Scope bundles that are not enforced become advisory paperwork instead of real safety boundaries.
- `.playbook/session.json` (including `evidenceEnvelope`) is a canonical runtime truth artifact for continuity + provenance across `verify/plan/apply/policy/receipt` seams; downstream control-plane and memory interpretations should consume this deterministic envelope rather than infer lineage from ad-hoc file deltas.
- `PB-V09-SESSION-EVIDENCE-001` is treated as current runtime truth in command doctrine: session continuity, evidence lineage, approval decisions, and receipt references must resolve through the same deterministic envelope surface before trust-sensitive follow-on actions.
- `docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md` is the canonical architecture truth surface for repo longitudinal state + knowledge promotion; command/runtime additions should align to this contract instead of treating longitudinal state as an implied cross-artifact aggregation.
- `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md` is the canonical architecture truth surface for governed Automation Synthesis input eligibility and output packaging boundaries: allow only promoted/inspectable/provenance-linked inputs, preserve suggestion-only authority, and require provenance plus rollback/deactivation accountability envelopes on generated suggestions.
- Rule: Automation synthesis contracts are suggestion-only until explicit downstream governed approval records exist.
- Failure Mode: Treating synthesis suggestions as executable authority bypasses policy, provenance, and rollback accountability boundaries.
- Deterministic invalidation/staleness handling for trust-sensitive seams should key off explicit envelope evidence state (`present`, stale, contradictory), not implicit assumptions about prior command success.
- Rule: Runtime decisions that claim approval or execution lineage must resolve to explicit session/evidence/receipt references.
- Pattern: session continuity -> evidence lineage -> approval decision -> receipt/update.
- Failure Mode: If approvals or outcomes are detached from the session/evidence envelope, trust state becomes narrative-only and non-replayable.
- `.playbook/pr-review-loop.json` is the canonical PR Review Loop runtime contract. It composes existing canonical surfaces (`analyze-pr`, session/evidence refs, policy gate output, remediation status, verify/preflight state, and available plan/apply/receipt refs) into one deterministic review-loop artifact with explicit escalation + next action.
- Rule: PR review should resolve through one canonical session/evidence/policy loop, not a set of adjacent tools.
- Pattern: trigger -> hydrate evidence -> analyze -> gate -> bounded action -> re-verify -> escalate.
- Failure Mode: When PR review logic is spread across separate commands and comments without one runtime contract, operators see fragments instead of one governed loop.
- Rule: New canonical `.playbook/*` artifacts that alter contract surfaces must update committed contract snapshots in the same PR.
- Pattern: Add artifact -> verify contract ids/versions/paths -> refresh snapshots -> re-run contract gate.
- Failure Mode: Introducing a canonical artifact without updating `tests/contracts/contracts.snapshot.json` causes CI to fail at `contracts:check` even when builds are green.
- Rule: When a new stable schema is added to the contracts registry, `contracts.test.ts` stability assertions must be updated in the same PR.
- Pattern: Add schema -> export/register schema -> update contracts command assertion -> rerun narrow contract tests first.
- Failure Mode: Contract implementation can be correct while CI still fails because a registry stability assertion was left on the pre-expansion shape.
- `pnpm playbook test-triage --input .playbook/ci-failure.log` is the canonical CI/test failure summarization surface: it preserves raw logs while emitting deterministic `.playbook/test-triage.json` / `.playbook/failure-summary.md` artifacts and a copy-paste-ready markdown brief for GitHub step summaries.
- `pnpm playbook rendezvous create|status|release --dry-run` is the canonical read-first artifact rendezvous seam for remediation pause/resume/release decisions: text mode stays brief (decision, status, missing artifacts, blockers, next action) while full detail remains in JSON plus `.playbook/rendezvous-manifest.json`.
- `pnpm playbook interop fitness-contract` is the canonical read-only inspect seam for the consumed Fitness contract boundary: text mode stays brief-thin (source pointer + canonical names/types), while full detail remains in JSON plus `.playbook/fitness-contract.json`.
- `pnpm playbook interop followups --json` is the canonical thin read-only operator surface for deterministic interop followups: it reads `.playbook/interop-followups.json`, supports additive `--type` / `--surface` filtering, keeps text mode compact (status, affected targets, next action), and introduces no mutation path. Followup rows include enrichment fields such as `action`, `confidence`, `provenanceRefs`, and `source` (`requestId`/`receiptId`) while remaining additive in JSON.
- `pnpm playbook interop followups --json` also exposes additive `automationSynthesis`/`automationSynthesisSuggestions` read models derived from the same runtime followup rows (suggestion count, template type, source promoted knowledge refs, confidence/rationale, next action); text mode remains brief-thin and no new mutation authority is introduced.
- Rule: Followup artifacts must include provenance and confidence when derived from deterministic updated-truth.
- Pattern: Use partial object matching in tests for forward-compatible artifact evolution.
- Failure Mode: Strict equality assertions on evolving artifacts cause false-negative CI failures during intentional contract expansion.
- `pnpm playbook interop draft --json` is the canonical thin compile/read seam for proposal-only Fitness interop request drafts: it reads `.playbook/ai-proposal.json`, validates canonical suggestion/action/input/receipt/routing fields, and writes additive `.playbook/interop-request-draft.json` without executing runtime interop.
- `pnpm playbook interop emit-fitness-plan --from-draft .playbook/interop-request-draft.json` is the canonical explicit emit seam for reviewed request drafts: it only accepts the canonical draft artifact, re-validates target/action/capability/input/receipt/routing against the canonical Fitness contract, and then reuses the existing bounded emit runtime path.
- `pnpm playbook interop reconcile --json` now closes the bounded Fitness loop by materializing deterministic `.playbook/interop-updated-truth.json` from canonical interop receipts plus canonical Fitness contract mirror fingerprint/source metadata, while remaining read-first and non-promotional.
- Rule: Receipts must resolve into explicit truth-update artifacts, not implicit operator interpretation.
- Pattern: bounded request -> receipt -> updated truth -> next action.
- Failure Mode: If receipt handling stops at runtime reconciliation, the loop appears complete but truth updates still depend on human interpretation.
- Rule: AI proposals may be compiled into bounded request drafts, but may not execute them directly.
- Pattern: AI proposal -> request draft -> explicit interop emit -> receipt -> updated truth.
- Failure Mode: Requiring operators to manually re-translate proposal artifacts into runtime requests recreates hidden session state and weakens auditability.
- `pnpm playbook release plan --json --out .playbook/release-plan.json` is now auto-materialized in normal Playbook CI whenever release governance is present or the repository is eligible for it; CI immediately follows with `pnpm playbook verify --phase preflight --json --out .playbook/verify-preflight.json`, fails before `pnpm test` when canonical release/version evidence is already blocking, then still runs the later full `.playbook/verify.json` gate on aligned branches.
- Rule: Diff-based release governance should fail before expensive test execution when canonical preflight evidence is already sufficient.
- Pattern: Release plan -> preflight verify -> tests -> full verify.
- Failure Mode: Late release-governance failures waste CI time and make correct policy failures look like random downstream breakage.

## Product-facing command surface (current)

The following section is generated from shared CLI command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:DOCS_COMMAND_STATUS_START -->

| Command / Artifact | Purpose | Lifecycle | Role | Discoverability | Onboarding | Status | Example |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `analyze` | Analyze project stack | compatibility | compatibility | hidden-compatibility | Later | Current (implemented) | `pnpm playbook analyze --json` |
| `pilot` | Run one-command external baseline analysis workflow for a target repository | canonical | bootstrap | primary | Later | Current (implemented) | `pnpm playbook pilot --repo "./target-repo" --json` |
| `verify` | Detect repository state and extract governance invariants | canonical | governance | primary | P8 | Current (implemented) | `pnpm playbook verify --ci --json` |
| `plan` | Transform findings into a structured remediation model | canonical | remediation | primary | P9 | Current (implemented) | `pnpm playbook plan --json` |
| `lanes` | Derive deterministic lane-state from .playbook/workset-plan.json | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook lanes --json` |
| `workers` | Assign deterministic proposal-only workers, derive launch authorization, and submit worker results from lane-state/workset artifacts | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook workers assign --json` |
| `orchestrate` | Generate deterministic orchestration lane artifacts for a goal or tasks-file workset | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook orchestrate --goal "ship capability" --lanes 3 --format both` |
| `execute` | Execute orchestration lanes through the execution supervisor runtime | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook execute --json` |
| `cycle` | Run the hardened execution primitives as one deterministic cycle orchestration pass | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook cycle --json` |
| `apply` | Enforce and materialize deterministic plan tasks | canonical | remediation | primary | P10 | Current (implemented) | `pnpm playbook apply --from-plan .playbook/plan.json` |
| `commit` | Atomically run release sync, stage all changes, and execute git commit | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook commit -m "chore: update"` |
| `analyze-pr` | Analyze local branch/worktree changes with deterministic PR intelligence | canonical | repo-intelligence | secondary | Later | Current (implemented) | `pnpm playbook analyze-pr --json` |
| `review-pr` | Run governed read-only PR review by composing analyze-pr, improve, and policy evaluate outputs | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook review-pr --json` |
| `doctor` | Diagnose repository health by aggregating verify, risk, docs, and index analyzers | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook doctor --fix --dry-run` |
| `diagram` | Generate deterministic architecture Mermaid diagrams | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` |
| `patterns` | Inspect pattern knowledge graph data and review promotion candidates | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook patterns list --json` |
| `docs` | Audit documentation governance surfaces and contracts | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook docs audit --json` |
| `audit` | Audit deterministic architecture guardrails and platform hardening controls | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook audit architecture --json` |
| `rules` | List loaded verify and analyze rules | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook rules --json` |
| `schema` | Print JSON Schemas for Playbook CLI command outputs | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook schema verify --json` |
| `context` | Print deterministic CLI and architecture context for tools and agents | canonical | bootstrap | primary | P3 | Current (implemented) | `pnpm playbook context --json` |
| `ai-context` | Print deterministic AI bootstrap context for Playbook-aware agents | canonical | bootstrap | primary | P1 | Current (implemented) | `pnpm playbook ai-context --json` |
| `ai-contract` | Print deterministic AI repository contract for Playbook-aware agents | canonical | bootstrap | primary | P2 | Current (implemented) | `pnpm playbook ai-contract --json` |
| `ai` | Emit proposal-only AI artifacts from deterministic context and contract surfaces | canonical | bootstrap | primary | Later | Current (implemented) | `pnpm playbook ai propose --json --out .playbook/ai-proposal.json` |
| `test-triage` | Parse deterministic test failure triage guidance from captured Vitest/pnpm logs | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook test-triage --input .playbook/ci-failure.log --json` |
| `test-fix-plan` | Generate a bounded remediation plan from a deterministic test-triage artifact | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook test-fix-plan --from-triage .playbook/test-triage.json --json` |
| `test-autofix` | Orchestrate deterministic test diagnosis, bounded repair, apply, and narrow-first verification | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook test-autofix --input .playbook/ci-failure.log --json` |
| `remediation-status` | Inspect recent test-autofix remediation history, repeat-policy decisions, and retry guidance | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook remediation-status --json` |
| `rendezvous` | Create/status/release-dry-run artifact rendezvous readiness from canonical remediation artifacts | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook rendezvous create --json` |
| `interop` | Inspect and run remediation-first Playbook↔Lifeline interop contracts from rendezvous artifacts | canonical | remediation | secondary | Later | Current (implemented) | `pnpm playbook interop health --json` |
| `ignore` | Suggest and safely apply ranked .playbookignore recommendations | canonical | remediation | primary | P12 | Current (implemented) | `pnpm playbook ignore suggest --repo ../target-repo --json` |
| `contracts` | Emit deterministic contract registry for schemas, artifacts, and roadmap status | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook contracts --json` |
| `release` | Plan deterministic installable release/version decisions from repo evidence | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook release plan --json --out .playbook/release-plan.json` |
| `index` | Generate machine-readable repository intelligence index | canonical | repo-intelligence | primary | P4 | Current (implemented) | `pnpm playbook index --json` |
| `graph` | Summarize machine-readable repository knowledge graph from .playbook/repo-graph.json | canonical | repo-intelligence | secondary | Later | Current (implemented) | `pnpm playbook graph --json` |
| `query` | Query machine-readable repository intelligence from .playbook/repo-index.json | canonical | repo-intelligence | primary | P5 | Current (implemented) | `pnpm playbook query modules --json` |
| `deps` | Print module dependency graph from .playbook/repo-index.json | canonical | repo-intelligence | secondary | Later | Current (implemented) | `pnpm playbook deps workouts --json` |
| `ask` | Answer repository questions from machine-readable intelligence context | canonical | repo-intelligence | primary | P7 | Current (implemented) | `pnpm playbook ask "where should a new feature live?" --repo-context --json` |
| `explain` | Explain rules, modules, or architecture from repository intelligence | canonical | repo-intelligence | primary | P6 | Current (implemented) | `pnpm playbook explain architecture --json` |
| `receipt` | Ingest explicit execution results into receipt, updated-state, and next-queue | canonical | utility | secondary | Later | Current (implemented) | `pnpm playbook receipt ingest execution-results.json --json` |
| `route` | Classify tasks and emit deterministic proposal-only execution plans for task-specific routing decisions | canonical | repo-intelligence | primary | Later | Current (implemented) | `pnpm playbook route "summarize current repo state" --json` |
| `architecture` | Verify subsystem registry ownership and architecture mapping integrity | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook architecture verify --json` |
| `promote` | Promote reviewed repo-local stories and reusable pattern candidates into canonical artifacts | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook promote story repo/<repo-id>/story-candidates/<candidate-id> --json` |
| `story` | Manage the canonical repo-local story backlog state | canonical | remediation | primary | Later | Current (implemented) | `pnpm playbook story list --json` |
| `learn` | Draft deterministic knowledge candidates from local diff and repository intelligence | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook learn draft --json --out .playbook/knowledge/candidates.json` |
| `memory` | Inspect, review, and curate repository memory artifacts with explicit human-reviewed doctrine promotion | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook memory events --json` |
| `improve` | Generate deterministic improvement candidates from memory events and learning-state signals | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook improve --json` |
| `knowledge` | Inspect read-only knowledge artifacts and provenance surfaces | canonical | repo-intelligence | secondary | Later | Current (implemented) | `pnpm playbook knowledge list --json` |
| `security` | Inspect deterministic security baseline findings and summary | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook security baseline summary --json` |
| `telemetry` | Inspect deterministic repository/process telemetry and compact cross-run learning summaries | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook telemetry learning --json` |
| `policy` | Evaluate improvement proposals against governed runtime evidence (read-only control-plane) | canonical | governance | secondary | Later | Current (implemented) | `pnpm playbook policy evaluate --json` |
| `agent` | Read runtime control-plane records and run plan-backed dry-run previews | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook agent run --from-plan .playbook/plan.json --dry-run --json` |
| `observer` | Manage deterministic local observer registry and read-only local API server | utility | utility | secondary | Later | Current (implemented) | `pnpm playbook observer serve --port 4300` |
<!-- PLAYBOOK:DOCS_COMMAND_STATUS_END -->

## Command docs index

### Implemented command docs

- Core flow: [`verify`](verify.md), [`plan`](plan.md), [`apply`](apply.md), [`pilot`](pilot.md)
- Repository intelligence: [`index`](index.md), [`query`](query.md), [`knowledge`](knowledge.md), [`deps`](deps.md), [`ask`](ask.md), [`explain`](explain.md), [`analyze-pr`](analyze-pr.md), [`test-triage`](test-triage.md), [`test-fix-plan`](test-fix-plan.md), [`test-autofix`](test-autofix.md)
- Knowledge review note: `pnpm playbook knowledge review followups` exposes compiled downstream follow-up suggestions through the existing read-only knowledge review family (`.playbook/review-downstream-followups.json`).
- Memory pressure note: `pnpm playbook memory pressure followups` exposes canonical deterministic pressure followups through the existing read-only memory family (`.playbook/memory-pressure-followups.json`) with thin text output and full JSON detail.
- AI bootstrap/context: [`ai-context`](ai-context.md), [`ai-contract`](ai-contract.md), [`ai`](ai.md), [`context`](overview.md)
- Runtime manifest note: `context` and `ai-context` consume `.playbook/runtime-manifests.json` as a read-only additive control-plane context surface for integrated subapps.
- Module digest note: `index` now emits deterministic `.playbook/module-digests.json` from `.playbook/repo-index.json` + `.playbook/repo-graph.json` (+ optional ownership metadata) as the compact architecture context-transfer artifact consumed by `context`, `ai-context`, and module-scoped `ask`/`explain` flows.
- Rule: Compact architecture context should come from deterministic module digests, not repeated broad scans.
- Pattern: `index/graph -> module digest -> context transfer`.
- Failure Mode: Without module digests, context surfaces either bloat or keep re-deriving the same architecture state expensively.
- Rule: Risk-aware context shaping must reflect canonical repository intelligence artifacts, never ad hoc heuristics.
- Pattern: `module digest -> risk tier -> shaped context` (high-risk modules get richer depth; low-risk modules stay concise).
- Failure Mode: Uniform context payloads either waste tokens on low-risk modules or starve high-risk modules of detail needed for safe reasoning.
- Rule: Cached context snapshots are valid only while canonical intelligence source fingerprints remain unchanged.
- Pattern: `canonical sources -> shaped context -> .playbook/context snapshot -> deterministic invalidation/reuse`.
- Failure Mode: Without cache lifecycle policy, context snapshots either drift stale or are recomputed wastefully on each read.
- Governance and support: [`docs`](docs.md), [`audit`](audit.md), [`rules`](rules.md), [`doctor`](doctor.md), [`schema`](schema.md), [`contracts`](contracts.md), [`release`](release.md), [`ignore`](ignore.md), [`diagram`](diagram.md), [`route`](route.md), [`memory`](memory.md), [`patterns`](patterns.md), [`story`](story.md), [`promote`](promote.md), [`observer`](observer.md), [`receipt`](receipt.md), [`learn`](learn.md), [`fix`](fix.md), [`upgrade`](upgrade.md), [`status`](status.md), [`analyze`](analyze.md)
- Pattern convergence note: `pnpm playbook patterns convergence --json` is the canonical read-only inspection surface for `.playbook/pattern-convergence.json`, with additive filters (`--intent`, `--constraint`, `--resolution`, `--min-confidence`) and compact text output for operator review.
- CSIA overlay note: `pnpm playbook patterns csia --json` is the canonical read-only machine-readable overlay for CSIA mappings; it must not mutate doctrine or expand the Minimum Cognitive Core.
- `status proof` is the canonical external-consumer bootstrap proof surface for proving runtime + CLI + docs/artifact + execution/governance readiness in one read-only flow. It now also reads existing parallel-work artifacts (`lane-state`, `worker-results`, `docs-consolidation-plan`, and guarded-apply outcomes) to emit one compact operator brief while keeping required automation truth in the canonical `proof` payload and deterministic additive detail in JSON, including failure-domain ownership fields (`failureDomains`, `primaryFailureDomain`, `domainBlockers`, `domainNextActions`) mapped to canonical domains (`contract_validation`, `runtime_execution`, `ci_bootstrap`, `sync_drift`, `governance_planning`) plus additive continuity/evidence summary fields under `continuity` and additive longitudinal read-model fields under `longitudinal_state` (unresolved risk summary, recurring cluster summary, verification lineage, lifecycle rollup).
- Enforcement note: `status proof` is report-first (exit 0 for readable proof state), while `status proof --proof-gate` enables fail-closed bootstrap/readiness gating semantics.
- Rule: Proof report mode and proof enforcement mode are separate CLI contracts.
- Pattern: Render proof state first, then apply policy-specific exit behavior.
- Failure Mode: Using `proof.ok` as the sole exit-code source breaks report mode and gate mode in opposite ways.
- Rule: `proofPolicy` must be implemented at the exit-decision boundary, not only in tests/callers.
- Pattern: Add policy fields to the runtime command contract before relying on them in tests.
- Failure Mode: Adding `proofPolicy` to tests before adding it to `StatusOptions` and `runStatus` creates clustered proof-mode failures that look broader than they are.
- Rule: `proofPolicy` is an exit-decision contract, not a payload-shape contract.
- Pattern: Keep proof serialization invariant; vary only final exit behavior.
- Failure Mode: Leaving `proof.ok` as the exit source inside proof result construction prevents report/enforce split and default-report behavior from working.
- Rule: Policy-aware CLI behavior must be introduced at the runtime command boundary before or alongside test expansion.
- Pattern: Keep proof serialization invariant and move policy selection to the final exit boundary.
- Failure Mode: Adding policy-aware tests before wiring policy into the runtime command boundary creates clustered proof-mode failures from one missing seam.
- Rule: Local proof status reporting and proof enforcement are separate contracts even when bootstrap enforcement already passes through another caller path.
- Pattern: Fix the shared local command surface after a specialized external caller turns green.
- Failure Mode: Passing bootstrap enforcement can mask that `runStatus` still hardwires `proof.ok` to process exit behavior.
- Rule: Status proof mode must preserve additive-safe enrichment even when the base status envelope is valid.
- Pattern: Separate “state is bad” from “command failed” so status proof can report blocked/conflicted operator states without turning readable state into a command execution failure.
- Failure Mode: Returning a base status envelope before proof enrichment causes contract shrinkage and incorrect non-zero exits in operator brief rendering paths.
- Rule: Any existing `--json` read surface is a contract surface and must not drift silently.
- Pattern: For CLI read surfaces, update implementation + contract schema + focused regression test in the same PR.
- Failure Mode: Adding longitudinal/state metadata to an existing JSON surface without reconciling the registered schema causes late CI failure in contract snapshot generation.

### Implemented control-plane command docs

- [`orchestrate`](orchestrate.md) (implemented v0 lane-contract artifact generation)
- [`lanes`](lanes.md) (implemented deterministic lane-state tracking from workset plans)
- [`workers`](workers.md) (implemented deterministic proposal-only worker assignment from lane-state readiness)

## External repository targeting (`pnpm playbook --repo <path> <command>`)

- Canonical local invocation remains `pnpm playbook <command>`.
- Use `pnpm playbook --repo <path> <command>` to execute against an external repository without changing directories.
- Global `--repo` is parsed only from the argv prefix before the command token.
- Any `--repo` flags after the command token are command-local options and are left untouched for command parsers.
- External analysis writes deterministic runtime artifacts into the target repo's `.playbook/` directory.

Canonical one-command baseline flow:

```bash
TARGET_REPO_PATH="../my-repo"
pnpm playbook pilot --repo "$TARGET_REPO_PATH"
```

Optional convenience alias:

```bash
pnpm pilot "$TARGET_REPO_PATH"
```

`playbook pilot` deterministically executes `context -> index -> query modules -> verify -> plan`, writes machine-readable artifacts directly (`.playbook/findings.json`, `.playbook/plan.json`, `.playbook/pilot-summary.json`), and records one top-level runtime cycle with child phases.

Minimal external onboarding contract:

- `playbook.config.json` is optional and missing config must degrade gracefully to defaults.
- `.playbookignore` is optional and should be added when scan scope needs tuning.
- `.playbook/` is runtime-generated and owned by Playbook in the target repository.

Rule - External Runtime Writes Belong to the Target Repo
When a repo-intelligence CLI analyzes an external repository, all generated runtime artifacts must land in the target repo, not the tool repo.

Pattern - Coexistence-First External Runtime
When introducing a new repo runtime into a real project with legacy tooling, run alongside the old system first and isolate outputs under deterministic artifact boundaries.

Failure Mode - Tool-Repo Gravity
If external analysis still reads from or writes to the tool's own repo context, the system is not actually operating as an external runtime.

Failure Mode - Positional Parse Regression
Adding global options before positional subcommands can silently break commands like `query modules` unless argv normalization is handled centrally and tested.

Rule - Repeated Multi-Step Operator Flows Deserve a First-Class Command.

Pattern - Orchestrated Baseline Analysis.

Failure Mode - Manual Workflow Drift.

Failure Mode - Helper Script Becomes Shadow Product Surface.

- Change-scope note: `plan`, `analyze-pr`, `workers launch-plan`, and `ai propose` now emit deterministic `.playbook/change-scope.json` bundles with explicit mutation-scope declarations (`allowedFiles`, `patchSizeBudget`, `boundaryChecks`) for downstream governed consumption.
- Rule: Governed work must declare mutation scope explicitly before execution.
- Pattern: understand -> bound scope -> propose/apply within declared boundaries.
- Failure Mode: Without explicit change-scope bundles, safe systems still drift because mutation boundaries live only in human interpretation.
- Rule: AI must remain a proposal-only layer within deterministic systems.
- Pattern: AI -> proposal artifact -> route/plan/review -> apply -> verify.
- Failure Mode: Allowing AI to mutate state directly collapses auditability and reproducibility.

## Additional implemented CLI utility commands

The CLI registry currently also exposes utility commands not treated as part of the product-facing command set above:

<!-- PLAYBOOK:DOCS_UTILITY_COMMANDS_START -->

- `demo`
- `init`
- `fix`
- `status`
- `upgrade`
- `session`
<!-- PLAYBOOK:DOCS_UTILITY_COMMANDS_END -->

Installable workflow note: `pnpm playbook init` now seeds the full trusted/manual release-governance loop for eligible publishable pnpm/node repositories by installing `.playbook/version-policy.json`, `.playbook/managed-surfaces.json`, `.github/workflows/release-prep.yml`, and `docs/CHANGELOG.md` with the managed `PLAYBOOK:CHANGELOG_RELEASE_NOTES` seam. `pnpm playbook upgrade --apply` retrofits only manifest-approved Playbook-managed surfaces, fails closed on mixed/protected targets, and preserves repo-local product truth by default.

- Rule: Installable workflow policy is incomplete until the trusted/manual mutation path is installable too.
- Pattern: Seed policy, seed reviewed executor, keep normal CI plan-only.
- Failure Mode: Shipping only the policy file makes release governance look portable while leaving the actual release path repo-specific.
- Rule: Version governance should be auto-materialized as an artifact, not inferred late by humans.
- Pattern: Plan everywhere, apply only through reviewed boundaries.
- Failure Mode: Release logic that exists only as a command and never enters CI becomes optional in practice.
- Rule: Human CI surfaces should summarize canonical artifacts, not mirror every artifact one-to-one.
- Pattern: Many machine artifacts, one operator brief.
- Failure Mode: Accurate but fragmented CI reporting creates review drag even when each artifact is correct.

Source of truth: shared command metadata in `packages/cli/src/lib/commandMetadata.ts` and generated truth contract `docs/contracts/command-truth.json`.

- Rule: One canonical command matrix per lifecycle seam.
- Pattern: Prefer one explicit promotion surface over many near-synonyms.
- Failure Mode: Promotion surface sprawl makes governance legible in code but confusing to operators.
- Rule: Consolidation is the only write boundary for protected singleton narrative docs.
- Rule: Merge readiness must account for unresolved protected singleton doc consolidation.
- Pattern: Workers propose; consolidator integrates.
- Pattern: Shared narrative work is complete only when consolidation is complete.
- Failure Mode: Parallel docs work without consolidation becomes a merge-management problem, not a productivity gain.
- Failure Mode: Marking lanes merge-ready before protected-doc integration recreates manual merge hotspots under a deterministic-looking surface.

## Artifact workflow governance

Artifact-producing pipelines in this repository follow one sequencing rule: generate candidate state, validate the regenerated candidate, then promote approved outputs into committed locations.

- Rule: All artifact-producing pipelines must validate regenerated candidate state, not stale committed outputs.
- Pattern: Use isolated candidate generation plus gated promotion for deterministic artifact workflows.
- Failure Mode: Writing or validating committed outputs too early causes false failures, drift, and unsafe partial promotion.

Implementation note: shared staging helpers live in `scripts/staged-artifact-workflow.mjs` and are used by managed docs refresh, contract snapshot refresh, template sync, and fallback release asset packaging so sequencing logic stays consistent across pipelines.

- Rule: Generated artifacts must be produced in staging and promoted only after validation succeeds.
- Rule: Durable workflow outputs must expose normalized staged-promotion metadata when they write repo-visible state.
- Rule: Promotion must emit a deterministic receipt whenever canonical knowledge is mutated or mutation is attempted.
- Rule: Advisory planning may consume only active promoted knowledge by default.
- Pattern: Promotion should be inspectable with the same rigor as execution.
- Pattern: Lifecycle state is part of knowledge truth, not presentation metadata.
- Failure Mode: Knowledge writes without receipts create invisible drift and undermine trust in promotion history.
- Failure Mode: Stale or superseded patterns leaking into planning context creates silent guidance drift.
- `pnpm playbook promote ... --json` writes `.playbook/promotion-receipts.json` in the mutated scope so Observer artifact inspection can review promotion provenance, target fingerprints, and noop/conflict outcomes.
- `pnpm playbook promote pattern-retire|pattern-demote|pattern-recall|pattern-supersede --json` reuses the same audited receipt path as initial promotion and preserves provenance/supersession lineage instead of deleting history.
- `pnpm playbook receipt ingest --json` now writes `.playbook/memory/lifecycle-candidates.json` as a read-only review surface for freshness/demotion/supersession recommendations; outcome evidence may suggest lifecycle changes, but it must not auto-mutate promoted knowledge.
- `promotion-receipts.json` is canonically sorted for deterministic inspection; it is a governed audit artifact, not an append-order event stream.
- Pattern: Shared staged-artifact orchestration should provide generation isolation, candidate validation, and gated promotion.
- Pattern: Reuse one shared workflow promotion contract instead of command-local promotion result shapes.
- Failure Mode: Environment-sensitive generation paths and direct committed-output writes undermine deterministic artifact governance.
- Failure Mode: Ad hoc workflow promotion metadata fragments governance semantics and makes Observer/orchestration reasoning inconsistent.
- Snapshot refresh invariant: `node scripts/update-contract-snapshots.mjs` now refreshes snapshots through a built-CLI generator path that avoids Vitest/Vite/esbuild optional-native resolution; the only prerequisite is a current local build (`pnpm -r build`).

## Repo-scoped roadmap/story docs-first contract

Playbook now recommends an optional repo-scoped product-direction contract for consumer repositories:

- `docs/ROADMAP.md` defines pillars, active stories, and lightweight priority
- `docs/stories/<STORY_ID>.md` defines one independently shippable vertical slice
- `pnpm playbook docs audit --json` validates the contract when a repo opts in
- `docs/postmortems/*.md`, `docs/PLAYBOOK_PRODUCT_ROADMAP.md`, and `docs/PLAYBOOK_DEV_WORKFLOW.md` now get a narrow path-scoped revision-layer contract check (Fact/Interpretation/Narrative) so doctrine remains enforceable only on governed docs
- `docs/architecture/decisions/*.md` now gets a narrow path-scoped architecture-rubric check (Constraints, Cost Surfaces, Chosen Shape, Why This Fits, Tradeoffs / Failure Modes, Review Triggers) with stable finding id `docs.architecture-rubric.required-sections`
- `pnpm playbook ask ... --repo-context` can answer lightweight story/pillar mapping prompts

This remains a documentation contract first, not a new heavy workflow command surface.

Rule: Only governed docs should carry enforced revision-layer structure.
Pattern: Path-scoped docs audit keeps doctrine enforceable without turning docs audit into noise.
Failure Mode: Broad unscoped docs rules create compliance churn and push teams away from the process.
Rule: Only governed architecture-decision docs should carry enforced rubric structure.
Pattern: Path-scoped architecture-rubric audit makes doctrine enforceable without widening documentation noise.
Failure Mode: Broad docs rules create compliance churn; no rubric rules leave architecture decisions style-driven and inconsistent.

## Product-state anchoring rule

When command/workflow state changes, update these surfaces in the same change (or immediately after):

- `README.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/commands/README.md` and related command docs
- demo docs/contracts (`docs/ONBOARDING_DEMO.md`, `pnpm playbook demo` contract)
- `docs/CHANGELOG.md`

Pattern: **AI Anchor Drift**.

If docs and implementation disagree, treat implementation as source of truth and realign docs.

Command reference: [`pnpm playbook docs audit`](docs.md).

## Test failure triage (`pnpm playbook test-triage`)

`pnpm playbook test-triage --input <path> --json` converts captured Vitest / pnpm recursive failure logs into a deterministic diagnosis artifact with repeatable failure classes, low-risk repair planning guidance, and prioritized rerun commands.

- Rule: Automate diagnosis first, repair second, merge never.
- Pattern: Repeated CI failures can be bucketed into deterministic repair classes.
- Failure Mode: Manual re-triage of the same test failure shapes wastes operator time and hides reusable automation.

## Execution command-surface normalization (verify / route / orchestrate / execute / telemetry / improve)

These command surfaces now align on deterministic behavior for:

- side-effect-free `--help`
- stable JSON failure envelopes for command-surface/missing-artifact errors
- explicit owned artifact declarations in command help/docs
- consistent text/JSON semantic alignment for success and failure states

For orchestration surfaces (`orchestrate`, `lanes`, `workers`), operator prompts are intentionally prompt-thin and artifact-rich:

- human prompts carry bounded execution instructions only
- `.playbook` artifacts retain full machine state, dependencies, and protected-doc fragment metadata
- protected singleton narrative docs are fragment-only surfaces during parallel worker execution
- compact text surfaces should report only pending/blocking summary plus next command while `.playbook` artifacts retain raw consolidation detail
- Managed execution is now fail-closed on explicit launch authorization: `execute` (and `cycle` paths that run `execute`) require `.playbook/worker-launch-plan.json` and only launch lanes with `launchEligible: true`.
- Launch authorization is incomplete until each launch-eligible lane's required runtime capabilities are explicitly registered in `.playbook/lifeline-interop-runtime.json`.
- Managed execution now writes durable orchestration run-state at `.playbook/execution-runs/<run-id>.json` and treats that artifact as canonical state for inspect/reconcile/resume.
- `execute` reconciles run-state deterministically from launch-plan fingerprint + existing lane receipts/state so interrupted runs can resume without relaunching completed lanes.
- `execute` / `cycle` now gate launch-eligible lanes against registered runtime capabilities (`interop-capability:*`) and required action families (`interop-action-family:*`), failing closed for missing, stale/conflicted, or family-mismatched registrations.
- `cycle` now carries execution run refs in `.playbook/cycle-state.json` so cycle reporting points to canonical orchestration run-state instead of ephemeral in-process step summaries.
- Managed execution now emits deterministic merge-guard evaluation at `.playbook/execution-merge-guards.json` and fails closed on release-readiness reporting when required lanes, receipts, protected-doc consolidation, or run-state coherence remain unresolved.
- Rule: Managed execution may begin only from explicit launch authorization, never from worker intent alone.
- Rule: Managed execution is not restart-safe until orchestration run-state is explicit and durable.
- Pattern: `assign -> launch-plan -> execute -> receipt -> submit -> consolidate`.
- Pattern: `launch-plan -> capability check -> execute -> receipt -> reconcile`.
- Pattern: `launch-plan -> execute -> per-lane receipt/state -> reconcile/resume -> merge-guard -> release-ready`.
- Failure Mode: If execute bypasses launch authorization, managed subagents can skip the same governance gates already enforced for humans.
- Failure Mode: A lane can look launch-eligible on paper while runtime capability registration cannot honor the bounded action contract.
- Failure Mode: If execution state lives only in process memory, restarts or partial failures break the same trust boundaries that launch authorization was meant to enforce.
- Failure Mode: Launch authorization without runtime merge guards can make partially completed or governance-blocked runs appear releasable.

## Learn draft (`pnpm playbook learn draft`)

`pnpm playbook learn draft` generates deterministic knowledge-candidate drafts from local git diff context plus indexed repository intelligence.

- Requires `.playbook/repo-index.json` (run `pnpm playbook index` first when missing).
- Writes machine-readable candidates to `.playbook/knowledge/candidates.json` by default.
- Supports `--out <path>` to redirect artifact output.
- Supports `--append-notes` to append a human-readable draft section to `docs/PLAYBOOK_NOTES.md`.
- Candidate evidence contains only changed file paths (no raw source content), and dedupe markers are deterministic MVP placeholders (`kind: none`).

Examples:

```bash
pnpm playbook learn draft --json --out .playbook/knowledge/candidates.json
pnpm playbook learn draft --base main --json
pnpm playbook learn draft --append-notes --json
```

Artifact intent:

- `.playbook/knowledge/**` is runtime draft state and should stay gitignored by default.
- Promote/commit knowledge artifacts only when intentionally reviewed for upstream inclusion.

### Learn doctrine (`pnpm playbook learn doctrine`)

`pnpm playbook learn doctrine` is the first-class post-merge doctrine extraction flow for turning merged change summaries into reusable report-only learning.

- Accepts `--input <path>` for text/JSON fixture summaries or `--summary <text>` for inline summaries.
- Produces a deterministic report-only payload with concise change summary, Rule / Pattern / Failure Mode extraction, suggested notes updates, and candidate future checks.
- Does not mutate the repository in report-only mode.
- Keeps doctrine promotion manual; it does not auto-update source-of-truth docs.

Examples:

```bash
pnpm playbook learn doctrine --input tests/contracts/fixtures/doctrine-extraction-summary.json --json
pnpm playbook learn doctrine --summary "artifact governance / staged promotion hardened the workflow-promotion contract" --json
```

Doctrine summary anchors:

- Pattern: Post-merge learning should extract reusable doctrine from real code changes.
- Failure Mode: Valuable engineering doctrine remains trapped in conversations and PR context unless extracted into reusable system knowledge.

## Memory inspection surfaces (`pnpm playbook memory ...`)

`pnpm playbook memory` exposes thin operator review surfaces for repo-local memory artifacts.

- `memory events` lists episodic events with deterministic filters.
- `memory candidates` lists replay candidates for review from `.playbook/memory/replay-candidates.json` (compat-written to `.playbook/memory/candidates.json`) and now emits additive deterministic `source_metadata` so interop-derived candidates remain visible/identifiable on the existing memory surface; use `--source replay|interop-followup` for narrow filtering.
- replay/consolidation remain candidate-only: replay is derived from memory evidence, and consolidation writes `.playbook/memory/consolidation-candidates.json` for explicit review without auto-promotion.
- `memory knowledge` lists promoted knowledge records.
- `memory outcome-feedback` exposes `.playbook/outcome-feedback.json` as a first-class read-only operator surface with compact text output and additive JSON fields for outcome class, confidence/trigger/stale-knowledge signals, trend updates, provenance refs, and a deterministic next review action.
- `memory pressure` exposes read-only pressure/operator inspection from canonical `.playbook/memory-pressure.json` + `.playbook/memory-pressure-plan.json`, with lightweight `--band` and `--action` filters.
- `memory show <id>` resolves either a candidate id or knowledge id, including provenance expansion for candidates.
- `memory promote <candidate-id>` and `memory retire <knowledge-id>` provide explicit, human-driven lifecycle actions.
- Postmortem reconsolidation stays inside this existing review boundary: incidents/changes should produce a structured postmortem, explicit candidate extraction, and then reviewed movement through `memory` / `promote` surfaces rather than any new command family or auto-promotion path.
- `status` now exposes additive read-only memory pressure inspection (`memory_pressure`) with score, band, hysteresis thresholds, usage totals, recommended actions, and an action-plan summary (`current_band`, highest-priority actions, and counts by action type) sourced from `.playbook/memory-pressure-plan.json`; canonical pressure artifact path remains `.playbook/memory-pressure.json`.
- Rule: Runtime outcome learning must remain candidate-only until explicit review.
- Pattern: execution -> receipt -> updated truth -> outcome feedback -> reviewed learning.
- Failure Mode: Outcome feedback that exists only as an internal artifact never becomes an operator-visible learning loop.
- Rule: Postmortems must separate observed facts from interpretation and promotion candidates.
- Pattern: Recall -> reinterpret -> promote -> restabilize becomes concrete through structured postmortems.
- Failure Mode: Blending fact, explanation, and doctrine in one narrative rewrites history and weakens promotion quality.

Examples:

```bash
pnpm playbook memory events --json
pnpm playbook memory candidates --json
pnpm playbook memory candidates --source interop-followup --json
pnpm playbook memory knowledge --json
pnpm playbook memory outcome-feedback --json
pnpm playbook memory pressure --json
pnpm playbook memory pressure --band pressure --action summarize --json
pnpm playbook memory show <id> --json
```

## Knowledge inspection surfaces (`pnpm playbook knowledge ...`)

Command boundary note:

- `memory` = lifecycle/review/mutation surfaces over raw memory artifacts (events, candidates, promoted records).
- Temporal memory artifacts are scope-first under `.playbook/memory/*` (`index.json`, `events/*.json`, `.playbook/memory/replay-candidates.json`, and `.playbook/memory/consolidation-candidates.json` with replay evidence embedded at `.playbook/memory/replay-candidates.json#replayEvidence`); structural repository intelligence remains separate in `.playbook/repo-index.json` and `.playbook/repo-graph.json`.
- Rule: Pressure policy should be inspectable before it is made more aggressive.
- Pattern: Inspect first, then tighten automation.
- Failure Mode: Hidden memory pressure logic feels random even when the policy is deterministic.
- `knowledge` = normalized, read-only inspection/query surface for governed knowledge retrieval and provenance.

`pnpm playbook knowledge` is the read-only inspection surface for normalized knowledge records.

- `knowledge list` enumerates all record types.
- `knowledge query` filters by type, status, module, rule, or text.
- `knowledge inspect <id>` reads one record.
- `knowledge provenance <id>` resolves direct evidence and related records.
- `knowledge stale` returns stale, retired, and superseded records.
- `knowledge review` materializes and reads `.playbook/review-queue.json` via a compact review surface with deterministic `--action`, `--kind`, cadence-aware `--due now|overdue|all`, trigger-aware `--trigger cadence|evidence|all`, and exact `--trigger-source <source>` filtering (including interop-derived `interop-followup`) while surfacing additive trigger metadata (`triggerType`, `triggerReasonCode`, `triggerSource`, `triggerEvidenceRefs`) plus cadence fields (`nextReviewAt`, `overdue`, `deferredUntil`) in JSON output; text mode stays brief-thin with status, due now, evidence-triggered, interop-triggered, and next action.
- Architecture decisions in `docs/architecture/decisions/*.md` are recalled via explicit `## Review Triggers` lines in canonical format:

  - `- [trigger_id] when <observable condition> -> <required review action>`
  Satisfied triggers enter the same retrieval queue as evidence (`triggerSource=architecture-decision`) instead of introducing a separate workflow surface.
- Rule: Existing review surfaces should absorb architecture-triggered recall before inventing a new workflow silo.
- `knowledge review handoffs` materializes and reads `.playbook/review-handoffs.json` from the same review family with deterministic `--decision revise|supersede` and `--kind knowledge|doc|rule|pattern` filters; text output stays brief (status, affected targets, recommended follow-up, next action) while JSON preserves full detail.
- `knowledge review routes` materializes and reads `.playbook/review-handoff-routes.json` from the same review family with deterministic `--surface story|promote|docs|memory`, `--decision revise|supersede`, and `--kind knowledge|doc|rule|pattern` filters; text output stays brief (status, affected targets, recommended surface, next action) while JSON preserves full routed detail.
- `knowledge review record` records durable review outcomes in `.playbook/knowledge-review-receipts.json` using an explicit queue-entry linkage (`--from <queueEntryId>`) and decision (`--decision <reaffirm|revise|supersede|defer>`), without mutating doctrine or auto-promoting changes.
- Rule: Review surfaces recall governed knowledge without mutating it.
- Rule: Existing review surfaces should expose routed next steps before inventing new command families.
- Pattern: Prefer existing review families before inventing new top-level command families.
- Pattern: Queue + receipt + cadence + evidence + decision triggers = governed review.
- Pattern: Queue -> receipt -> handoff -> routed follow-up, all inside one review family.
- Failure Mode: Architecture review triggers live only in docs and never become operational review signals.
- Failure Mode: Launching retrieval review as a separate command silo fragments operator workflow and weakens command authority.
- Failure Mode: Review handoffs become a dead-end list instead of a governed bridge to action.
- Failure Mode: A review system that cannot say when something should return encourages ad hoc maintenance.

## Memory compaction review surface (`pnpm playbook memory compaction`)

- Compaction review is implemented as a public `memory` subcommand surface (`pnpm playbook memory compaction`) that materializes deterministic `.playbook/memory/compaction-review.json` artifacts for operator inspection.
- The current implemented slice includes canonicalization, deterministic bucketing (`discard | attach | merge | new_candidate`), and deterministic review artifacts layered on top of bucket decisions.
- Review artifacts use canonical reason codes as the machine contract; human-readable rationale is derived deterministically from those codes.
- Promotion workflows and long-lived pattern storage remain future roadmap work.

## Repo-aware ask (`pnpm playbook ask --repo-context`)

`pnpm playbook ask` supports `--repo-context` to inject trusted Playbook-managed repository intelligence into ask context.

- Uses deterministic artifacts (`.playbook/repo-index.json`) and AI contract metadata for context hydration.
- Does **not** trigger broad ad-hoc repository crawling.
- Requires `pnpm playbook index` when `.playbook/repo-index.json` is missing.

Supported question classes (deterministic repository-intelligence scope):

- repository/module placement (for example: "where should a new feature live?")
- architecture and dependency shape grounded in indexed modules
- impact/risk and ownership questions grounded in indexed contracts

Unsupported/bounded question classes:

- broad internet knowledge or non-repository trivia
- speculative future roadmap commitments not present in contracts
- hidden file-system exploration outside indexed/local Playbook artifacts

Deterministic fallback guidance:

- if index context is missing, run `pnpm playbook index` and retry with `--repo-context`
- if the question is outside repository-intelligence scope, pivot to `pnpm playbook query` / `pnpm playbook explain` targets for deterministic answers

Deterministic missing-index guidance:

```text
Repository context is not available yet.
Run `pnpm playbook index` to generate .playbook/repo-index.json and retry.
```

Examples:

```bash
pnpm playbook ask "where should a new feature live?" --repo-context
pnpm playbook ask "how does auth work?" --repo-context --mode concise
pnpm playbook ask "how does this module work?" --module workouts --repo-context
pnpm playbook ask "what modules are affected by this?" --repo-context --json
```

## Structured PR intelligence (`pnpm playbook analyze-pr`)

`pnpm playbook analyze-pr` provides deterministic pull-request/change analysis as machine-readable output.

- Uses trusted local git diff + `.playbook/repo-index.json`.
- Reuses indexed impact/risk/docs/ownership intelligence instead of duplicating logic.
- Reports changed files, affected modules, downstream impact, architecture boundaries touched, docs review suggestions, and merge guidance.
- Keeps `--json` as the canonical analysis contract and applies a single formatter pipeline for `--format text|json|github-comment|github-review`.
- Supports formatter exports, including `--format github-comment` for sticky PR summaries and `--format github-review` for inline review diagnostics on specific files/lines without adding new analysis inference.
- GitHub Actions transport posts the summary formatter output as one sticky Playbook PR comment (`<!-- playbook:analyze-pr-comment -->`) and synchronizes inline diagnostics (`<!-- playbook:analyze-pr-inline -->`) so new findings are added, unchanged findings are not duplicated, and resolved findings are removed.
- GitHub Actions CI also captures failed `pnpm test` output to `.playbook/ci-failure.log`, evaluates explicit mutation gates, suppresses repeated autofix attempts for the same commit SHA after the first workflow-run attempt unless an explicit operator retry override is present, keeps protected branches and protected PR targets dry-run by default, uploads the same canonical artifact set with retention, and renders one sticky Playbook CI Summary comment (`<!-- playbook:ci-summary -->`) plus one step-summary append from canonical artifacts rather than mirroring each artifact one-to-one.
- Artifact contract: `analyze-pr` consumes `.playbook/repo-index.json`, so CI runs `pnpm playbook index` before PR analysis; creating `.playbook/` alone is insufficient.
- Diff contract: CI should pass explicit base refs (for example `--base origin/${{ github.base_ref }}`) and use `fetch-depth: 0` checkout for deterministic PR diff analysis.

Examples:

```bash
pnpm playbook analyze-pr
pnpm playbook analyze-pr --format text
pnpm playbook analyze-pr --json
pnpm playbook analyze-pr --base main --json
pnpm playbook analyze-pr --format github-comment
pnpm playbook analyze-pr --format github-review
```

Pattern: `pnpm playbook analyze-pr` composes local diff context with indexed repository intelligence to produce deterministic pull request analysis.

Rule: Pull request intelligence must rely on trusted local git + Playbook-managed artifacts, not cloud-only or fuzzy repository inference.

Pattern: `ask --diff-context` is conversational change reasoning; `analyze-pr` is the structured review/report surface.

Failure Mode: PR analysis becomes untrustworthy when implementation duplicates diff/impact/risk logic instead of composing shared intelligence helpers.

## Change-scoped ask (`pnpm playbook ask --diff-context`)

`pnpm playbook ask` supports `--diff-context` to narrow repository reasoning to the active local change set.

- Uses deterministic local git diff + `.playbook/repo-index.json` intelligence mapping.
- Hydrates ask context with changed files, affected modules, impact/dependents, changed docs, and indexed risk signals.
- Does **not** silently broaden to full-repo reasoning when diff context cannot be resolved.
- `--module` and `--diff-context` are intentionally incompatible for deterministic scope selection.

Examples:

```bash
pnpm playbook index
pnpm playbook ask "what modules are affected by this change?" --diff-context
pnpm playbook ask "what should I verify before merge?" --diff-context --mode concise
pnpm playbook ask "summarize the architectural risk of this diff" --diff-context --json
pnpm playbook ask "what modules are affected?" --diff-context --base main
```

Pattern: `pnpm playbook ask --diff-context` narrows repository reasoning to the active change set using trusted local diff + index intelligence.

Rule: Change-scoped ask must derive context from Playbook-managed intelligence and explicit diff inputs, not broad ad-hoc repository inference.

Pattern: Module-scoped and diff-scoped reasoning should share the same underlying repository intelligence layer.

Pattern: Change review workflows become much more trustworthy when blast radius is derived from indexed structure and actual changed files together.

Failure Mode: Diff-aware reasoning becomes misleading when the tool silently expands from â€œchanged filesâ€ into full-repo inference without telling the user.

In JSON mode, ask keeps the existing answer payload and includes deterministic provenance metadata in `context.sources` (for example `repo-index`, `module`, `diff`, `docs`, `rule-registry`, and `ai-contract`) plus `repoContext` hydration metadata. Provenance descriptors include only source metadata (paths/names/files), never raw repository file content.

## AI Response Modes for `pnpm playbook ask`

`pnpm playbook ask` supports `--mode <mode>` to control output verbosity.

- `normal` (default): Full explanation with context
- `concise`: Compressed but informative
- `ultra`: Maximum compression

Examples:

```bash
pnpm playbook ask "how does auth work?"
pnpm playbook ask "how does auth work?" --mode concise
pnpm playbook ask "how does this work?" --module workouts
pnpm playbook ask "how do I fix this rule violation?" --mode ultra
```

## Security contract verification

Run `pnpm test:security` to execute security contract tests and regression tests that validate runtime guards.

## Runtime artifact intent by command

Use the following intent model when deciding whether command outputs stay local, are reviewed in automation, or are committed as stable contracts/docs:

- `index`
  - Default intent: **local runtime artifacts** (`.playbook/repo-index.json`, `.playbook/repo-graph.json`, `.playbook/context/modules/*.json`) regenerated as repository intelligence changes.
  - JSON contract note: `pnpm playbook index --json` exposes `contextDir` so automation can discover digest artifact location deterministically.
  - Commit guidance: usually gitignored; commit only when intentionally maintaining a deterministic contract/example snapshot.
- `plan`
  - Default intent: **reviewed automation artifact** (for example `.playbook/plan.json`) used for deterministic remediation workflows and CI/agent handoff.
  - Safe capture examples:
    - bash/zsh: `pnpm playbook plan --json --out .playbook/plan.json`
    - PowerShell: `pnpm playbook plan --json --out .playbook/plan.json`
    - local Playbook repo path: `pnpm playbook plan --json --out .playbook/plan.json`
  - Commit guidance: typically ephemeral; commit only when a repository explicitly treats plan artifacts as stable review contracts.
- `query` / `deps` / `ask` / `explain`
  - Default intent: **runtime reads and derived outputs** from `.playbook/repo-index.json`; results are usually ephemeral unless exported intentionally for docs/contracts.
- `session` memory + cleanup flows
  - Default intent: **local repo-scoped workflow continuity artifacts** (`.playbook/session.json`, pinned findings/plan/run refs) plus optional cleanup reports under `.playbook/`.
  - Recommended continuity commands: `pnpm playbook session show`, `pnpm playbook session pin <artifact>`, `pnpm playbook session resume`, `pnpm playbook session clear`.
  - `session show` now includes compact continuity/evidence operator signals (active refs, pinned evidence refs, latest run/receipt lineage, stale/missing continuity markers), additive JSON fields under `continuity`, and additive `longitudinal_state` JSON + one-line text brief.
  - Commit guidance: keep local unless intentionally preserving an audit example or contract fixture.
- `diagram` and docs-facing flows
  - Default intent: **committed docs/contracts** when repositories choose generated architecture/docs outputs as source-controlled documentation surfaces.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated artifacts on every run causes unnecessary repo-history growth and noisy diffs.

Rule â€” Machine-Consumed Artifacts Must Be CLI-Written
If a CLI expects downstream commands to read generated JSON artifacts, those artifacts must be written by the CLI itself rather than relying on shell redirection.

Pattern â€” First-Class Artifact Emission
Structured runtime artifacts should be emitted through explicit flags with controlled encoding, directory creation, and content boundaries.

Failure Mode â€” Shell Redirection Artifact Corruption
When JSON artifacts are captured through script wrappers and shell redirection, banner text or encoding differences can silently corrupt machine-readable files.

Failure Mode â€” Human-Readable Wrapper Leakage
Operator-friendly wrapper output is acceptable on stdout, but it must never leak into persisted JSON artifacts that are intended for later programmatic reads.

Rule â€” CI Summary Artifacts Are Pure JSON Contracts
Artifacts consumed by CI summary/reporting (for example `.playbook/verify.json`, `.playbook/release-plan.json`, `.playbook/test-triage.json`, `.playbook/remediation-status.json`) must be written through dedicated JSON-only paths such as `--out` or direct file writes, never via redirected wrapper stdout.

Human-facing text surfaces should prefer compact briefs that answer decision/status, affected surfaces, blockers, and next action, while `.playbook/*` artifacts and `--json` preserve machine detail for automation.

Failure Mode â€” Opaque JSON Parse Crash
When corrupted runtime artifacts are parsed without a guardrail, later commands fail far from the original write site, making the real bug harder to diagnose.

Pattern â€” Artifact Consumers Treat Prior JSON as Untrusted Input
Commands that consume prior runtime artifacts should treat those files as untrusted inputs and degrade gracefully when artifacts are missing or malformed.

Failure Mode â€” Hidden Optional Artifact Dependency Crash
A secondary command like index can fail because of a hidden dependency on stale or corrupted `.playbook/*.json` artifacts produced by an earlier workflow step.

`.playbookignore` support is available for repository intelligence scans (`pnpm playbook index` and related repository scans). The file uses `.gitignore`-style syntax and should be used to exclude high-churn directories.

Recommended bootstrap flow:

```bash
pnpm playbook pilot --repo "<target-repo>"
pnpm playbook ignore suggest --repo "<target-repo>" --json
pnpm playbook ignore apply --repo "<target-repo>" --safe-defaults
```

`ignore suggest` reports ranked recommendations, safety level, rationale, expected scan impact, and whether each entry is already covered. `ignore apply --safe-defaults` writes only `safe-default` entries into a deterministic managed block and leaves lower-confidence recommendations in review-only output.
`ignore apply --safe-defaults` also writes explicit ignore outcome telemetry to `.playbook/runtime/current/ignore-apply.json` (and per-cycle copies), and updates `.playbook/runtime/history/ignore-apply-stats.json` as a compact cumulative rollup.

Rule - Apply Only Trusted Ignore Recommendations.

Pattern - Recommendation Before Application, Safe Defaults Before Review.

Failure Mode - Auto-Applying Ambiguous Ignores.

Failure Mode - Non-Idempotent Ignore Management.

## Playbook artifact hygiene diagnostics (`doctor`)

`pnpm playbook doctor` includes a **Playbook Artifact Hygiene** section that reports:

- committed runtime artifacts
- very large generated JSON artifacts
- frequently modified generated artifacts
- missing `.playbookignore` in large repositories

In JSON mode, `doctor --json` includes a structured `artifactHygiene` payload with `classification`, `findings`, and `suggestions` arrays for deterministic automation handling.

Suggested remediation IDs:

- `PB012`: add `.playbookignore`
- `PB013`: update `.gitignore` for runtime artifacts
- `PB014`: move runtime artifacts to `.playbook/`

### Deterministic pattern compaction query

`pnpm playbook query patterns` reads repo-local promoted pattern memory from `.playbook/memory/knowledge/patterns.json` and returns compacted canonical engineering patterns.

- Canonical IDs collapse semantically equivalent observations (for example, module test absence variants).
- Buckets are deterministic: architecture, testing, dependency, documentation, governance.
- Output is stable machine-readable pattern summaries (`id`, `bucket`, `occurrences`, `examples`).

### Cross-repo pattern learning (`patterns`)

`pnpm playbook patterns cross-repo --json` emits a read-only governed comparison artifact at `.playbook/cross-repo-patterns.json` with deterministic `source_repos`, pairwise `comparisons`, and evidence-backed `candidate_patterns`.

- `pnpm playbook patterns portability --pattern <patternId> --json` returns deterministic portability factors and evidence-backed ranking rows.
- `pnpm playbook patterns generalized --json` filters to high-portability read-only/manual-only candidates.
- `pnpm playbook patterns repo-delta --left <repoId> --right <repoId> --json` reports governed artifact deltas between two repositories.
- Cross-repo intelligence in this phase is read-only: no cross-repo mutation and no automatic promotion.

### Multi-repo control-plane read interface (`observer` API)

The first governed multi-repo control-plane interface slice is exposed through existing Observer read surfaces:

- `GET /api/control-plane/interfaces/read?slice=readiness-proof`
- `GET /api/control-plane/interfaces/read?slice=run-state-inspection`
- `GET /api/control-plane/interfaces/read?slice=longitudinal-state-summary`
- `GET /api/control-plane/interfaces/read?slice=cross-repo-pattern-comparison`
- `GET /api/control-plane/interfaces/read?slice=workspace-tenant-governance`

The response is a deterministic read-only envelope (`playbook-multi-repo-control-plane-read-interface`) that preserves explicit per-repo policy/provenance boundaries and introduces no mutation authority.

The workspace/tenant governance slice returns a deterministic `workspace_governance` payload and aligns with `.playbook/workspace-governance.json` contract semantics (workspace id, tenant id, member repos, inherited vs overridden policy refs, accountability boundary metadata, provenance boundary metadata).

### Deterministic test hotspot discovery

`pnpm playbook query test-hotspots` reports likely test inefficiency candidates from test files using deterministic heuristics only.

- Detects candidate patterns such as broad retrieval followed by narrow filtering, repeated fixture setup, repeated CLI runner plumbing, and manual JSON contract plumbing.
- Emits stable text + JSON output for repository intelligence and validation automation workflows.
- Reports findings only (no codemod/apply behavior in MVP).

### Deterministic module impact

`pnpm playbook query impact <module>` converts indexed module/dependency data plus graph/digest context (`.playbook/repo-graph.json`, `.playbook/context/modules/*.json`) into deterministic module blast-radius analysis, including dependencies, reverse dependencies, docs/tests/rules, and risk signals when available.

Rule: Module impact and module-scoped ask rely on Playbook-managed index artifacts, not ad-hoc rescans.

### Architecture role inference visibility

`pnpm playbook query architecture` now exposes indexed architecture role inference using existing read surfaces:

- Text output remains compact with a single `Inferred roles:` summary line.
- JSON output is additive via `architectureRoleInference` (no mutation/policy behavior changes).

## Deterministic Artifact Layer

Rule
Playbook artifacts must only be written via the artifact IO layer to guarantee determinism and pipeline reliability.

Failure Mode
Shell redirection (`>`) may introduce encoding corruption. CLI owned artifact output must always be preferred.

## Execution run state

Managed orchestration execution (`execute` / `cycle`) now persists canonical deterministic run-state at `.playbook/execution-runs/<run-id>.json`, including launch-plan fingerprint, eligible lanes, per-lane status, receipt refs, blocker refs, and reconcile metadata.

Managed execution also writes `.playbook/execution-merge-guards.json`, a read-only merge-eligibility artifact per run (`mergeEligible`, deterministic blocker reasons, unresolved receipts, protected-doc unresolved state, failed/blocked lane refs, pending followups, stale/conflicted run-state).

Use query surfaces to inspect state:

- `pnpm playbook query runs`
- `pnpm playbook query run --id <run-id>`

`query runs` now emits additive continuity evidence in JSON (`continuity.session`, `continuity.lineage`, `continuity.staleSignals`) plus additive `longitudinal_state` JSON, and keeps text output brief with one-line continuity + longitudinal summaries.

`pnpm playbook patterns cross-repo --json` now emits a read-only governed comparison artifact at `.playbook/cross-repo-patterns.json` with deterministic `source_repos`, pairwise `comparisons`, and evidence-backed `candidate_patterns`.

- `pnpm playbook patterns portability --pattern <patternId> --json` returns deterministic portability factors and evidence refs for candidate patterns.
- `pnpm playbook patterns generalized --json` returns high-portability read-only/manual-only candidate recommendations (no auto-promotion).
- `pnpm playbook patterns repo-delta --left <repoId> --right <repoId> --json` reports governed artifact deltas between two repositories.
- `pnpm playbook patterns proposals --json` now groups cross-repo evidence into promotable portable-pattern candidates with explicit memory/story promotion targets and evidence lineage.
- `pnpm playbook patterns proposals promote --proposal <proposal-id> --target memory|story [--repo <repo-id>] --json` keeps cross-repo promotion explicit while writing into governed memory or backlog surfaces.
- Reusable pattern storage is scope-first: repo-local promoted memory stays at `.playbook/memory/knowledge/patterns.json`, cross-repo proposal bridge artifacts stay at `.playbook/pattern-proposals.json`, and global reusable pattern memory is canonically `.playbook/patterns.json` under `PLAYBOOK_HOME` with deterministic compatibility reads from legacy `patterns.json`.
- Cross-repo comparison may suggest promotion, but promotion remains explicit: no automatic doctrine updates, no hidden story mutation, and no non-governed artifact ingestion.

- `playbook story list --json` exposes the canonical repo-local story backlog artifact at `.playbook/stories.json`.
- `playbook story list --json` now includes additive deterministic backlog metadata (`backlog_priority_score`, `backlog_unmet_dependencies`, `backlog_order`, `backlog_score_explanation`) derived from explicit story fields only.
- `playbook story candidates --json` derives and writes the non-canonical inspectable candidate artifact at `.playbook/story-candidates.json` without mutating `.playbook/stories.json`.
- `playbook story promote <candidate-id> --json` explicitly promotes one candidate into the canonical backlog artifact.
- `playbook promote story global/patterns/<pattern-id> --repo <repo-id> --json` explicitly seeds a repo-local story from promoted pattern `storySeed` metadata and records provenance back to `.playbook/patterns.json` under `PLAYBOOK_HOME`.

- Rule: Stories are the durable repo-scoped action unit and must remain structured first, narrative second.
- Rule: Global knowledge may suggest local work, but only repo-local stories may enter execution planning.
- Rule: Compatibility tests must assert stable contract guarantees, not stale pre-enrichment object shapes.
- Rule: Tests for deterministic scoring must match the current canonical scoring model, not historical totals.
- Rule: Story artifact readers must fail closed on invalid schema, but must default optional backward-compatible fields at the normalization boundary.
- Pattern: Backlog state is a canonical repo-local artifact, not a UI-owned construct.
- Pattern: Detection -> Story -> Ordered Backlog -> Plan -> Execution -> Receipt.
- Pattern: When canonical records gain deterministic computed metadata, preserve legacy-field compatibility with partial assertions and assert derived fields separately.
- Pattern: When asserting derived priority scores, assert both the total and the explanation vector so drift is obvious and easy to diagnose.
- Pattern: When deterministic presentation order is introduced, encode that contract explicitly in tests rather than relying on fixture insertion order.
- Pattern: Findings need durable interpretation before they become backlog work.
- Pattern: Candidate stories require grouping, dedupe, and explicit promotion.
- Pattern: Reusable knowledge compounds when it can seed bounded local backlog items.
- Failure Mode: If story state is introduced without a canonical artifact and governed writes, backlog semantics fragment immediately.
- Failure Mode: Raw finding -> automatic story conversion creates backlog spam and weak planning signal.
- Failure Mode: A backlog without deterministic priority and dependency ordering becomes a second manual planning system.
- Failure Mode: Deep-equality assertions against pre-enrichment fixtures break when persisted artifacts evolve to include deterministic derived fields.
- Failure Mode: Updating shape assertions without updating derived numeric expectations leaves compatibility tests half-migrated and still brittle.
- Failure Mode: Write-path schema evolution without read-path normalization causes undefined-access regressions in older fixtures and contract tests.
- Failure Mode: Letting patterns enter execution directly creates a second control path and breaks operator trust.

- `playbook story plan <id> --json`: generate a route/execution plan from canonical story intent while keeping story, plan, worker, and receipt as separate linked artifacts.
- `playbook route --story <id> --json`: derive a deterministic route directly from a story id and stamp stable `story_reference` metadata into the generated execution plan.

## Pattern lifecycle and transfer

- `pnpm playbook promote pattern-retire <pattern-id> --reason <text> --json`
- `pnpm playbook promote pattern-demote <pattern-id> --reason <text> --json`
- `pnpm playbook promote pattern-recall <pattern-id> --reason <text> --json`
- `pnpm playbook patterns transfer export --pattern <id> --target-repo <repo-id> --json`
- Transfer packages are governance-bounded: exports carry provenance, sanitization, compatibility, risk, known failure modes, and recall/demotion lifecycle hooks; imports land as candidate-only input pending local review.
- Rule: Cross-repo transfer moves governed packages, not auto-enforced truth.
- Pattern: Transfer should preserve provenance and local review boundaries.
- Failure Mode: Importing foreign doctrine directly into execution context breaks private-first governance.
- `pnpm playbook patterns transfer import --file <path> --repo <repo-id> --json`
- `playbook route --story <id> --json`: derive a deterministic route directly from a story id and stamp stable `story_reference` metadata plus advisory `pattern_context` into the generated execution plan.
- Promoted global patterns may inform story-backed planning through read-only advisory context, but only repo-local stories remain execution authority.


## Test-fix planning (`pnpm playbook test-fix-plan`)

`pnpm playbook test-fix-plan --from-triage <artifact> --json` converts the stable `test-triage` diagnosis artifact into the bounded `test-fix-plan` remediation artifact, writing `.playbook/test-fix-plan.json` by default and carrying forward explicit exclusions for risky or unsupported findings. When operators choose to cross the mutation boundary, `pnpm playbook apply --from-plan .playbook/test-fix-plan.json` reuses the same reviewed `apply --from-plan` execution seam and task selection rules as ordinary plan artifacts.

Architecture note:

- `test-triage` = diagnosis.
- `test-fix-plan` = bounded repair planning.
- `apply` = reviewed execution.
- Risky findings remain review-required and must not be converted into executable tasks by diagnosis or planning docs.

`pnpm playbook test-autofix --input <path> --json` now includes a repeat-aware remediation policy layer, deterministic `autofix_confidence` scoring, configurable confidence-threshold gating, and `--dry-run` support. Stable failure signatures are still the source of truth for reuse/block/escalation, while CI and PR surfaces only render the resulting artifacts instead of inventing workflow-local heuristics.

`pnpm playbook remediation-status --json` now also exposes confidence-calibration telemetry derived from the existing remediation history artifact: deterministic confidence buckets, failure-class success rates, blocked-low-confidence counts, repeated blocked signatures, dry-run/apply ratios, repeat-policy block counts, and an advisory `confidence_may_be_conservative` signal when blocked-low-confidence runs resemble signatures or failure classes that historically succeeded. This read model remains observation-only; it is meant to validate threshold/weight tuning before relaxing safety gates, not to widen mutation authority or create a second policy engine.

- Rule: trust-boundary docs must evolve at the same time as remediation command surfaces.
- Rule: every canonical remediation command must expose one stable artifact contract and one authoritative operator doc.
- Pattern: diagnosis -> planning -> execution should be documented as separate stages with different mutation authority.
- Pattern: add new remediation commands as artifact-producing seams before orchestration wrappers.
- Failure Mode: operators assume diagnosis commands mutate state if docs blur planning and execution boundaries.
- Failure Mode: hidden CLI-only behavior without contract/docs coverage drifts faster than engine truth.


Docs command references:

- [`pnpm playbook docs audit`](docs.md)
- [`pnpm playbook docs consolidate`](docs-consolidate.md)
- [`pnpm playbook docs consolidate-plan`](docs-consolidate-plan.md)

- Rule: Worker execution outputs must enter Playbook through explicit result artifacts, not inferred file diffs.
- Pattern: Assign -> submit -> consolidate -> plan -> apply is the safe parallel-doc/runtime loop.
- Failure Mode: Parallel workers without a receipt/submit seam force humans to reconstruct state manually and break deterministic orchestration.

## Control-plane state (additive runtime context)

Playbook now emits `.playbook/control-plane.json` as an explicit read-only control-plane contract artifact.

In v1, this state is surfaced additively (without introducing a new top-level command family) through:

- `status proof`
- `query runs`
- `agent run --from-plan ... --dry-run`

Authority remains unchanged: this artifact does not grant new mutation behavior.

- Rule: Any intentional CLI contract surface change must ship with regenerated committed snapshots.
- Pattern: New artifact surfaces are not complete until contract snapshot drift is reconciled and reviewed.
- Failure Mode: Passing build + failing contracts:check usually means schema/contract evolution was intentional but snapshot artifacts were not updated.
- Rule: New read-only control-plane artifacts may extend contract registries, but must not silently change report-vs-enforce CLI exit semantics.
- Pattern: Serialize operator-facing proof/control-plane output first, then apply exit-policy decisions at the final boundary.
- Failure Mode: Early fail-closed branching in shared status/agent helpers can erase expected JSON/text payloads and make report mode behave like enforce mode.
