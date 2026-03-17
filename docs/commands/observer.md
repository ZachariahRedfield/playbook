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

Rule: An observer UI must distinguish registration state from actual observability state.
Pattern: Connected repo → readiness detection → artifact observation.
Failure Mode: If empty repos look the same as fully observed repos, operators will misread what Playbook actually knows.


## System blueprint artifact behavior

Observer never generates a system-map artifact. It only reads `.playbook/system-map.json` if present in a connected repo and exposes it through `/snapshot` and `/repos/:id/artifacts/system-map`.

Playbook command flows should keep the artifact fresh (for example `playbook index` and `playbook diagram system`) so the UI can remain a pure renderer.
