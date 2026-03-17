# `playbook observer`

Manage a deterministic local observer registry, thin local observer API, and local dashboard UI shell.

## Usage

```bash
pnpm playbook observer repo add <path>
pnpm playbook observer repo list --json
pnpm playbook observer repo remove <id>
pnpm playbook observer serve --port 4300
```

## Registry artifact

The repo registry command maintains:

- `.playbook/observer/repos.json`

Contract:

- `schemaVersion: "1.0"`
- `kind: "repo-registry"`
- `repos[]` entries include stable `id`, `name`, absolute `root`, `status`, `artifactsRoot`, and deterministic `tags`.

## Local server (`observer serve`)

`pnpm playbook observer serve` starts a local-only HTTP server bound to `127.0.0.1` by default.

- Dashboard UI shell routes: `GET /`, `GET /ui`, `GET /ui/app.js`
- Read endpoints: `GET /health`, `GET /repos`, `GET /snapshot`, `GET /repos/:id`, `GET /repos/:id/artifacts/:kind`
- Registry mutation endpoints (local-only, add/remove parity with CLI): `POST /repos`, `DELETE /repos/:id`
- Responses are deterministic envelopes, and artifact state remains sourced from governed observer/runtime artifacts.
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
- `missing_artifacts`

Readiness fields are available from:

- `GET /repos` (per repo readiness object)
- `GET /repos/:id` (repo-level readiness object)
- `GET /snapshot` (top-level readiness summary by repo id)

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
