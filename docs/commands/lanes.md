# Lanes (`pnpm playbook lanes`)

`lanes` derives deterministic active lane-state from `.playbook/workset-plan.json` and writes `.playbook/lane-state.json`.

## Why this exists

Workset plans are static planning artifacts. Lane-state turns those plans into explicit tracked orchestration state without launching workers or mutating branches.

Rule — Lane lifecycle transitions must stay stricter than eventual automation behavior.

Pattern — Readiness snapshots become operationally useful when they support deterministic state progression.

Failure Mode — Static lane-state without lifecycle transitions cannot become a real orchestration layer.

## Usage

```bash
pnpm playbook lanes --json
pnpm playbook lanes start <lane_id>
pnpm playbook lanes complete <lane_id>
```

## Inputs

- Requires `.playbook/workset-plan.json` from `pnpm playbook orchestrate --tasks-file <path>`.
- `start` and `complete` consume `.playbook/lane-state.json` when present to preserve deterministic proposal-only lifecycle history.

## Lifecycle model

Lane status is deterministic and proposal-only:

- `blocked`: prerequisites or dependencies unresolved
- `ready`: lane can be started
- `running`: lane was started via `lanes start <lane_id>`
- `completed`: lane was completed via `lanes complete <lane_id>` but not yet merge-ready
- `merge_ready`: conservative safe-completion state after recomputation and protected-doc consolidation resolution

Dependency gates are strict: if prerequisites become unresolved, the lane remains or returns `blocked` regardless of requested transition.

## Outputs

Writes `.playbook/lane-state.json` with:

- lifecycle groups (`blocked_lanes`, `ready_lanes`, `running_lanes`, `completed_lanes`, `merge_ready_lanes`)
- deterministic per-lane lifecycle status (`status`, `dependencies_satisfied`, `blocked_reasons`)
- compact protected-doc consolidation status with only human summaries in text mode
- conservative merge and verification posture (`merge_readiness`, `verification_status`)

`lanes` remains proposal-only and does not create branches, launch workers, open PRs, or merge code.

Worker-facing prompt thinness depends on `lanes` staying artifact-rich: readiness, dependency gates, and merge posture remain in `.playbook/lane-state.json` instead of being duplicated into human prompts.

Rule — Merge readiness must account for unresolved protected singleton doc consolidation.
Pattern — Shared narrative work is complete only when consolidation is complete.
Failure Mode — Marking lanes merge-ready before protected-doc integration recreates manual merge hotspots under a deterministic-looking surface.
