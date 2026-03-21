# Workers (`pnpm playbook workers`)

`workers` assigns deterministic, proposal-only workers to lane-state entries and writes `.playbook/worker-assignments.json`.

It consumes `.playbook/workset-plan.json` and `.playbook/lane-state.json`, then emits lane-level prompt files under `.playbook/prompts/<lane_id>.md` for assigned lanes. Protected singleton narrative work stays artifact-first via worker fragments under `.playbook/` rather than direct shared doc edits.

Rule — Worker assignment must respect lane readiness and dependency edges.
Rule — Workers write fragments for protected singleton docs; they do not edit them directly.

Pattern — Parallel development becomes safe when work is isolated by surface and assigned per lane.
Pattern — Narrative singleton surfaces are consolidated once, not edited in parallel.

Failure Mode — Assigning workers without surface isolation leads to merge conflicts and broken CI.
Failure Mode — Surface-safe worker lanes still collide if singleton docs remain shared write targets.

## Usage

```bash
pnpm playbook workers --json
pnpm playbook workers assign
pnpm playbook workers assign --json
```

## Behavior

- Only lanes with `status: ready` and `dependencies_satisfied: true` are assigned.
- Blocked/dependency-gated lanes remain unassigned and are preserved in output.
- Ordering is deterministic by `lane_id`.
- Output remains proposal-only: no worker launch, no branch creation, no PR automation.
- Assigned prompts stay compact and skimmable; full machine state remains in `.playbook/workset-plan.json`, `.playbook/lane-state.json`, and `.playbook/worker-assignments.json`.
- Protected singleton docs must be treated as fragment-only contribution targets rather than direct-edit surfaces.

Rule — Human prompt surfaces should carry only bounded execution instructions, not full machine state.
Pattern — Artifact-rich, prompt-thin orchestration keeps operators fast.
Failure Mode — Dumping full machine context into worker prompts lowers signal and increases drift.

## Artifacts

Writes:

- `.playbook/worker-assignments.json`
- `.playbook/prompts/<lane_id>.md` for each assigned lane

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
