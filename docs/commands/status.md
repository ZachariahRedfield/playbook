# `pnpm playbook status`

Deterministic adoption/readiness summary for governed Playbook usage.

## JSON contract highlights

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

## Lifecycle producers

- Detect Playbook: `pnpm playbook init`
- Index stage: `pnpm playbook index --json`
- Plan stage: `pnpm playbook verify --json && pnpm playbook plan --json`
- Apply stage: `pnpm playbook apply --json`

## Examples

```bash
pnpm playbook status --json
pnpm playbook status
```
