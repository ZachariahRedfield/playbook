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
