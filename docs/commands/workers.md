# Workers (`pnpm playbook workers`)

`workers` assigns deterministic, proposal-only workers to lane-state entries and writes `.playbook/worker-assignments.json`. It also accepts first-class worker-result receipts through `pnpm playbook workers submit --from <path> --json`, persists canonical receipt artifacts under `.playbook/worker-results.json`, and recomputes lane-state deterministically from those receipts.

It consumes `.playbook/workset-plan.json` plus `.playbook/lane-state.json` / `.playbook/worker-results.json`, then emits lane-level prompt files under `.playbook/prompts/<lane_id>.md` for assigned lanes. Protected singleton narrative work stays artifact-first via worker fragments under `.playbook/` rather than direct shared doc edits.

Rule — Worker assignment must respect lane readiness and dependency edges.
Rule — Managed execution may begin only from explicit launch authorization, never from worker intent alone.
Rule — Workers write fragments for protected singleton docs; they do not edit them directly.
Rule — Managed workers may operate only within declared mutation scope.

Pattern — assign -> launch-plan -> execute -> receipt -> submit -> consolidate.
Pattern — Parallel development becomes safe when work is isolated by surface and assigned per lane.
Pattern — Narrative singleton surfaces are consolidated once, not edited in parallel.
Pattern — launch-plan + change-scope determines deterministic launch eligibility and submit acceptance.

Failure Mode — Assigning workers without surface isolation leads to merge conflicts and broken CI.
Failure Mode — Surface-safe worker lanes still collide if singleton docs remain shared write targets.
Failure Mode — Worker authorization without scope enforcement recreates hidden mutation boundaries.

## Usage

```bash
pnpm playbook workers --json
pnpm playbook workers assign
pnpm playbook workers assign --json
pnpm playbook workers submit --from .playbook/worker-result-input.json --json
pnpm playbook workers launch-plan --json
```

## Behavior

- `workers assign` only assigns lanes with `status: ready` and `dependencies_satisfied: true`.
- `workers launch-plan` emits deterministic launch authorization decisions in `.playbook/worker-launch-plan.json` from existing governed artifacts (workset-plan, lane-state, worker-assignments, protected-doc consolidation status, and optional verify/policy findings).
- `workers launch-plan` consumes `.playbook/change-scope.json` when present, exposes per-lane scoped write surfaces, and fail-closes lanes that exceed scope/budget boundaries.
- Launch authorization fails closed when protected singleton docs are unresolved, verify/policy blockers exist, required capabilities are missing, or dependency/blocker state is unresolved.
- `workers submit` validates `lane_id`, exact `task_ids`, `worker_type`, `completion_status`, blockers/unresolved items, fragment refs for protected singleton docs, proof/artifact refs, and declared change-scope boundaries before writing canonical receipts.
- Protected singleton docs are fragment-only on submit: workers may reference fragment artifacts for those targets, but they may not mutate singleton docs directly through this command.
- Blocked/dependency-gated lanes remain unassigned and are preserved in output.
- Ordering is deterministic by `lane_id`.
- Output remains proposal-only: no worker launch, no branch creation, no PR automation, and no mutation path outside existing apply/consolidation boundaries.
- Assigned prompts stay compact and skimmable; full machine state remains in `.playbook/workset-plan.json`, `.playbook/lane-state.json`, and `.playbook/worker-assignments.json`.
- Protected singleton docs must be treated as fragment-only contribution targets rather than direct-edit surfaces.
- Lanes carrying protected-doc fragments stay non-merge-ready until consolidation is planned and applied through the reviewed boundary.

Rule — Human prompt surfaces should carry only bounded execution instructions, not full machine state.
Pattern — Artifact-rich, prompt-thin orchestration keeps operators fast.
Failure Mode — Dumping full machine context into worker prompts lowers signal and increases drift.

## Artifacts

Writes:

- `.playbook/worker-assignments.json`
- `.playbook/prompts/<lane_id>.md` for each assigned lane
- `.playbook/worker-results.json` for submitted worker receipts
- `.playbook/worker-launch-plan.json` for deterministic launch authorization decisions

`worker-assignments` includes:

- `schemaVersion`
- `kind = worker-assignments`
- `proposalOnly`
- `generatedAt`
- `lanes`
- `workers`
- `warnings`

Each lane assignment entry includes:

- `lane_id`
- `worker_type`
- `status`
- `task_ids`
- `assigned_prompt`
- `dependencies_satisfied`

When a lane later participates in protected singleton doc consolidation, its worker-local fragment contract must use a stable conflict key of `target_doc + section_key` and deterministic ordering based on wave, target doc, section key, and lane id.
