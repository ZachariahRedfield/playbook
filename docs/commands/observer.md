# `playbook observer`

Manage a deterministic local observer registry, thin local observer API, and local dashboard UI shell.

## Usage

```bash
pnpm playbook observer repo add <path> [--root <path>]
pnpm playbook observer repo list --json [--root <path>]
pnpm playbook observer repo remove <id> [--root <path>]
pnpm playbook observer serve --port 4300 [--root <path>]
```

## Registry artifact

The repo registry command maintains:

- `<observer-root>/.playbook/observer/repos.json`

Observer root resolution is deterministic:

1. explicit `--root <path>`
2. nearest ancestor directory containing `package.json` with a Playbook package name
3. fallback to current working directory

This prevents split registries when commands are run from incidental nested shell directories.

Contract:

- `schemaVersion: "1.0"`
- `kind: "repo-registry"`
- `repos[]` entries include stable `id`, `name`, absolute `root`, `status`, `artifactsRoot`, and deterministic `tags`.

## Local server (`observer serve`)

`pnpm playbook observer serve` starts a local-only HTTP server bound to `127.0.0.1` by default.

- Dashboard UI shell routes: `GET /`, `GET /ui`, `GET /ui/app.js`

Maintainer note (UI bootstrap safety):

- `GET /ui/app.js` is sourced from `packages/cli/src/commands/observer/dashboard-app.js` and **must remain plain browser JavaScript** (no TypeScript annotations/casts/generics).
- Embedding large browser apps as raw template strings makes accidental TS leakage easier and review harder; dedicated source files reduce this risk and improve maintainability.
- Regression checks live in `packages/cli/src/commands/observer.test.ts` and `packages/cli/scripts/run-observer-tests.mjs` to guard TS-leakage patterns and required bootstrap wiring (`refreshAll`, repo hydration, self-observation refresh).
- Read endpoints: `GET /health`, `GET /repos`, `GET /snapshot`, `GET /repos/:id`, `GET /repos/:id/artifacts/:kind`, `GET /api/readiness/fleet`
- Promotion lineage endpoints: `GET /api/cross-repo/global-patterns`, `GET /api/cross-repo/global-patterns/:id`
- Registry mutation endpoints (local-only, add/remove parity with CLI): `POST /repos`, `DELETE /repos/:id`
- Responses are deterministic envelopes, and artifact state remains sourced from governed observer/runtime artifacts.
- Startup output includes observer root metadata (`observer_root`, `registry_path`, `repo_count`) in both text and `--json` modes for debugging.
- No artifact/runtime mutation routes are provided in v1 beyond repo registration actions.

Self/home selection metadata:

- `GET /repos` and `GET /snapshot` include `home_repo_id` when the connected registry contains a Playbook self repo candidate.
- Home repo selection is deterministic and governed by observer registry data only: exact root match with current server cwd, then `self`/`home` tags, then `playbook` id/name fallback.

Supported `:kind` values:

- `cycle-state`
- `cycle-history`
- `policy-evaluation`
- `policy-apply-result`
- `pr-review`
- `session`
- `system-map`

### Fast debug checklist ("where did my repos go?")

Use JSON mode to verify that commands are sharing one registry:

```bash
pnpm playbook observer repo list --json
pnpm playbook observer repo list --json --root /absolute/path/to/observer-home
```

Confirm these fields match your expectation:

- `observer_root` (resolved home root used for this invocation)
- `registry_path` (exact `<observer-root>/.playbook/observer/repos.json` file)
- `repo_count` (how many repos were loaded from that registry)

If cwd differs across terminals, pass `--root` explicitly to force all add/list/serve invocations to the same observer registry.

## Determinism and scope

- Deterministic ordering is enforced by `id`.
- Duplicate `id` and duplicate `root` values are rejected.
- This is a local/private-first observer index and local wrapper API only.
- Canonical runtime artifacts remain per repository under each repo's `.playbook/` root.

Rule: A Playbook server must wrap governed artifacts and commands, not replace them.
Pattern: Thin local server over canonical runtime artifacts.
Failure Mode: If the server becomes the real source of state instead of a wrapper over repo-local truth, architecture drifts away from CLI-first determinism.

## Candidate → pattern → story lineage

Observer cross-repo view now exposes a read-only lineage chain from global pattern candidates to promoted patterns and then down into repo stories that were promoted from the same candidate provenance.

The operator-facing flow is intentionally progressive:

1. **Global Promotion Layer** shows the compact pattern candidate and promoted pattern surfaces.
2. **Global Pattern Lineage** lists promoted patterns with linked-story counts by repo.
3. **Pattern detail** expands provenance/source refs and the repo stories whose promotion provenance points back to the same global candidate.
4. **Story detail** remains the canonical repo-local drilldown for downstream execution context and now includes the same advisory `pattern_context` that story-backed planning used.
5. **Execution-plan detail** exposes the same `pattern_context` through the existing artifact viewer path for `execution-plan`.

The lineage contract is additive and read-only:

- promoted pattern → story joins are reconstructed from provenance metadata only
- provenance/source refs remain visible on pattern detail
- raw artifact inspection still routes through the existing artifact viewer and deep disclosure panels
- no new canonical write paths are introduced beyond existing explicit promotion actions
- pattern context remains read-only advisory metadata; it never mutates queue or backlog state by itself

Rule: Lineage should be reconstructed from provenance, not maintained through redundant backlinks in v1.
Pattern: Progressive disclosure turns dense deterministic truth into usable operator understanding.
Failure Mode: Promotion data that exists only in files but not in the operator surface becomes effectively non-operational.
Rule: Global knowledge may suggest local work, but only repo-local stories may enter execution planning.
Pattern: Promoted patterns are advisory planning context, not a second planner.
Failure Mode: Letting patterns influence execution outside story-backed plans creates a second control path.

### Readiness and observability status

Observer server endpoints now include additive readiness metadata derived from filesystem presence only (read-only):

- `connected`
- `playbook_detected`
- `playbook_directory_present`
- `repo_index_present`
- `cycle_state_present`
- `cycle_history_present`
- `policy_evaluation_present`
- `policy_apply_result_present`
- `pr_review_present`
- `session_present`
- `last_artifact_update_time`
- `readiness_state` (`connected_only` | `playbook_detected` | `partially_observable` | `observable`)
- `lifecycle_stage` (`playbook_not_detected` | `playbook_detected_index_pending` | `indexed_plan_pending` | `planned_apply_pending` | `ready`)
- `fallback_proof_ready`
- `cross_repo_eligible`
- `blockers[]`
- `recommended_next_steps[]`
- `missing_artifacts`

Readiness fields are available from:

- `GET /repos` (per repo readiness object)
- `GET /repos/:id` (repo-level readiness object)
- `GET /snapshot` (top-level readiness summary by repo id)

Fleet readiness fields are available from:

- `GET /api/readiness/fleet` (compact aggregate fleet summary)
- `GET /snapshot` (`fleet` object for one-call snapshot consumers)

Fleet summary includes deterministic aggregate counts and prioritization:

- `total_repos`, `by_lifecycle_stage`
- `playbook_detected_count`, `fallback_proof_ready_count`, `cross_repo_eligible_count`
- `blocker_frequencies[]`
- `recommended_actions[]`
- `repos_by_priority[]`

Prioritization order is deterministic and adoption-focused:

1. `playbook_not_detected`
2. `index_pending`
3. `plan_pending`
4. `apply_pending`
5. `ready`

Within a stage, repos are sorted by blocker severity then repo id.

### Fleet readiness panel (UI)

Observer cross-repo mode now includes a compact **Fleet Readiness Summary** card that surfaces:

- lifecycle stage counts
- top blocker frequencies
- highest-frequency next actions
- top repos by deterministic priority order

This is additive and does not replace repo-first inspection flows.

### Control-loop summary strip (UI)

Observer now leads both repo view and cross-repo view with a compact **Control-Loop Summary** card so operators can understand the loop in seconds before reading dense artifact-backed panels.

The default summary answers:

- `state`
- `why`
- `next step`

It also surfaces:

- promotion status
- whether the current plan is `blocked`, `stale`, or `ready`
- whether new queue work exists

Progressive disclosure is explicit:

- **Default**: concise narrative, one primary next action, and the key blocker if present
- **Secondary detail**: blocker list, reasoning, promotion/receipt summary, and drift indicators
- **Deep/raw truth references**: raw truth refs, artifact paths, diagnostics, and promotion metadata refs

The existing artifact detail viewer remains the canonical raw drilldown for governed artifacts.

Pattern: Observer should behave like a runtime inspector with interpretation, not a second source of truth.
Pattern: Default control-plane views should compress state into state / why / next step.
Pattern: Observer behavior tests should target stable semantic surfaces, not fragile display strings.
Failure Mode: A data-rich Observer that defaults to dense artifact text increases operator friction even when the underlying control system is correct.
Failure Mode: Copy-coupled UI tests fail during presentation refactors even when deterministic behavior is unchanged.

### Self-observation cockpit (UI)

Observer UI keeps **Playbook Self-Observation** available as a collapsible panel so blueprint/repo detail surfaces remain primary by default. The panel still presents read-only summaries for the selected home repo:

- repo readiness and missing-artifact guidance
- control-plane/runtime loop availability summaries
- blueprint status from governed `.playbook/system-map.json` with explicit missing-artifact guidance when absent
- observer server health status from `GET /health`

Rule: Playbook should observe itself through the same governed observer model it uses for external repos.
Pattern: One observer model, special self-view presentation.
Failure Mode: If self-observation uses a separate hidden state path, the dashboard becomes inconsistent and harder to trust.

Rule: An observer UI must distinguish registration state from actual observability state.
Pattern: Connected repo → readiness detection → artifact observation.
Failure Mode: If empty repos look the same as fully observed repos, operators will misread what Playbook actually knows.

## System blueprint artifact behavior

Observer never generates a system-map artifact. It only reads `.playbook/system-map.json` if present in a connected repo and exposes it through `/snapshot` and `/repos/:id/artifacts/system-map`.

Playbook command flows should keep the artifact fresh (for example `playbook index` and `playbook diagram system`) so the UI can remain a pure renderer.

### Stateful system blueprint behavior

System blueprint rendering is now read-only but stateful:

- Node states are derived deterministically from governed observer artifacts/readiness only (`active`, `available`, `missing`, `stale`, `idle`).
- Runtime/review flow edges are visually emphasized when required artifact paths are available.
- Node selection is click-based and shows node id, layer, derived state, and linked artifact kind.
- If a selected node maps to a known artifact kind, the artifact viewer is switched to that governed artifact view.
- If `.playbook/system-map.json` is missing, blueprint rendering degrades to explicit guidance without hidden fallback state.

Rule: Blueprint state must be derived from governed artifact truth, not UI heuristics.
Pattern: Static architecture map -> stateful blueprint -> selected-node inspection.
Failure Mode: If the dashboard emphasizes large static summaries over interactive system state, the UI becomes cluttered and less operationally useful.

## Execution outcome panel

Observer now exposes `/api/readiness/receipt`, `/api/readiness/updated-state`, and `/api/readiness/next-queue`. The dashboard renders separate panels for raw receipt visibility, reconciled updated state, and the downstream next queue derived from updated state, showing:

- latest wave result
- completed prompts
- failed prompts
- observed outcome counts from updated-state reconciliation
- derived next actions (`needs_retry`, `needs_replan`, `needs_review`)
- a `Next Queue (Derived from Updated State)` panel with retry/replan items, wave grouping, and prompt lineage
- planned vs actual drift

These panels are read-only-friendly: the receipt remains the canonical planned-vs-actual contract, observed execution outcomes come only from `.playbook/execution-outcome-input.json`, updated state is derived deterministically from the receipt, and the next queue is then derived from updated state only. Updated state separates what happened from what action is needed next so CLI, Observer, and automation layers do not overload one enum with multiple meanings.

- **Rule**: Observer outcome views must stay evidence-backed and must not auto-execute repo commands.
- **Pattern**: Surface retry/drift summaries next to readiness and queue state so the next prioritization pass stays deterministic.
- **Failure Mode**: Operators can lose remediation continuity when failed prompts are visible in logs but not reflected in the next queue.

Updated-state next-queue routing is deterministic and non-heuristic:

- `partial`, `failed`, and `not_run` re-enter the queue as `retry` items.
- `blocked` remains blocked and does not auto-retry.
- `stale_plan_or_superseded` routes to `replan`.
- `completed_with_drift` stays review-only and does not auto-retry.

- **Rule**: Once updated-state exists, Observer must derive the next queue from updated-state instead of raw receipt parsing.
- **Pattern**: Observer now visualizes `updated state -> next queue` as explicit downstream control-plane stages.
- **Failure Mode**: Mixing readiness-derived and updated-state-derived queue routing creates split-brain fleet execution.
- **Pattern**: Observer should behave like a runtime inspector with interpretation, not a second source of truth.
- **Pattern**: Default control-plane views should compress state into state / why / next step.
- **Failure Mode**: A data-rich Observer that defaults to dense artifact text increases operator friction even when the underlying control system is correct.

## Backlog planning surface

Observer now exposes repo-scoped backlog visibility as a **read-only planning surface** backed by the canonical `.playbook/stories.json` artifact. Repo view adds:

- backlog summary counts by status
- highest-priority ready story
- blocked-story visibility
- one obvious next action when canonical story state makes it clear
- story detail with evidence, rationale, acceptance criteria, dependencies, execution lane, suggested route, and linked repo/readiness status
- deep disclosure for the raw story artifact and linked evidence paths

API additions:

- `GET /repos/:id/backlog`
- `GET /repos/:id/backlog/stories/:storyId`
- `GET /repos/:id` now includes additive `backlog` summary data

Rule: Observer may render backlog state, but it must not become the canonical story source of truth.
Pattern: Story visibility belongs between findings and execution surfaces in the repo control view.
Failure Mode: If the UI becomes the primary story system, deterministic planning state fragments across layers.
