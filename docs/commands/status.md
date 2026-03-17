# `pnpm playbook status`

Deterministic adoption/readiness summary for governed Playbook usage.

## Modes

- `pnpm playbook status --json`: repo-level status/adoption summary.
- `pnpm playbook status fleet --json`: fleet-level aggregate readiness summary using connected Observer repos.
- `pnpm playbook status queue --json`: deterministic read-only adoption work-queue from fleet readiness.

If no Observer registry exists, fleet mode falls back to the current repository as a single-repo fleet.

## Repo readiness JSON contract highlights

- `connection_status`: `connected` | `not_connected`
- `playbook_detected`: whether repo has Playbook config/artifact surface
- `governed_artifacts_present`: validation summary for:
  - `.playbook/repo-index.json`
  - `.playbook/repo-graph.json`
  - `.playbook/plan.json`
  - `.playbook/policy-apply-result.json`
- `lifecycle_stage`:
  - `not_connected`
  - `playbook_not_detected`
  - `playbook_detected_index_pending`
  - `indexed_plan_pending`
  - `planned_apply_pending`
  - `ready`
- `fallback_proof_ready`: requires valid `.playbook/repo-graph.json` and `.playbook/plan.json`
- `cross_repo_eligible`: requires valid `.playbook/repo-index.json`
- `blockers[]`: deterministic blocker code/message/next command
- `recommended_next_steps[]`: exact commands to advance stage

## Fleet summary JSON contract highlights

- `total_repos`
- `by_lifecycle_stage`
- `playbook_detected_count`
- `fallback_proof_ready_count`
- `cross_repo_eligible_count`
- `blocker_frequencies[]` with `blocker_code`, `count`, `repo_ids[]`
- `recommended_actions[]` with `command`, `count`, `repo_ids[]`
- `repos_by_priority[]` with deterministic triage order and first next action

## Fleet prioritization logic

Priority order:

1. `repo_not_connected`
2. `playbook_not_detected`
3. `index_pending`
4. `plan_pending`
5. `apply_pending`
6. `ready`

Within a priority stage, repos are sorted by blocker severity, then `repo_id` to keep output stable and deterministic.


## Adoption work-queue JSON contract highlights

- `kind`: `fleet-adoption-work-queue`
- `generated_at`: queue generation timestamp
- `total_repos`
- `work_items[]`:
  - `repo_id`, `lifecycle_stage`, `blocker_codes[]`
  - `recommended_command`, `priority_stage`, `severity`
  - `parallel_group`, `dependencies[]`, `rationale`, `wave`
- `waves[]`: deterministic wave allocation (`wave_1`, `wave_2`) with repo/action counts
- `grouped_actions[]`: parallel-safe lanes (`init lane`, `index lane`, `verify/plan lane`, `apply lane`)
- `blocked_items[]`: items with unmet dependencies

## Queue wave and grouping logic

- **Wave 1**: work items with no dependencies beyond current observed state.
- **Wave 2**: work items unlocked only after prerequisite items complete.
- Grouping remains action/lane specific so operators can run similar commands in parallel without violating deterministic dependency order.

Playbook notes:

- **Rule**: Work-queue ordering must be deterministic; identical readiness input produces identical queue output.
- **Pattern**: Use lifecycle-derived action lanes (`init` → `index` → `verify/plan` → `apply`) to scale parallel execution safely.
- **Failure Mode**: Queue drift occurs when operators collapse lane boundaries and execute dependent actions out of order.

## Lifecycle producers

- Detect Playbook: `pnpm playbook init`
- Index stage: `pnpm playbook index --json`
- Plan stage: `pnpm playbook verify --json && pnpm playbook plan --json`
- Apply stage: `pnpm playbook apply --json`

## Examples

```bash
pnpm playbook status --json
pnpm playbook status
pnpm playbook status fleet --json
pnpm playbook status queue --json
```
