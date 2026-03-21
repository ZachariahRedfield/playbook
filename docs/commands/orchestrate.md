# Orchestrate (`pnpm playbook orchestrate`)

`orchestrate` is an **implemented v0 deterministic control-plane command** that compiles one high-level goal into merge-safe lane contracts for parallel Codex plan-mode workflows.

## Control-plane boundary

Playbook orchestration is governance-first:

- Defines lane ownership, dependencies, and shared-file risk.
- Generates deterministic artifacts for workers, including machine-facing worker-fragment contracts for protected singleton docs.
- **Does not** launch workers, create branches, open PRs, merge code, or run autonomous execution loops.

Codex workers are expected to execute lane prompts within the contracts produced by this command.

## Usage

```bash
pnpm playbook orchestrate \
  --goal "Implement query risk and docs audit improvements in parallel" \
  --lanes 3 \
  --out .playbook/orchestrator \
  --format both
```

## Command-surface guarantees

- `--help` is side-effect free and does not generate orchestration artifacts.
- Missing or invalid `--tasks-file` inputs fail deterministically with stable JSON/text semantics.
- Artifact ownership is explicit: goal mode writes `.playbook/orchestrator/**`; tasks-file mode writes `.playbook/workset-plan.json` and `.playbook/lane-state.json`.

## Flags

- `--goal <string>` (required when `--tasks-file` is not set)
- `--tasks-file <path>` (optional, compiles a multi-task workset into lane plans)
- `--lanes <number>` (optional, default `3`)
- `--out <dir>` (optional, default `.playbook/orchestrator`)
- `--format <md|json|both>` (optional, default `both`)

Notes:

- `--lanes` must be a positive integer (`>= 1`).
- global `--json` output mode forces artifact format to `json`.

## Deterministic decomposition model (v0)

`orchestrate` currently uses fixed lane categories and deterministic merges:

1. CLI / command surface
2. Engine / domain logic
3. Tests / validation
4. Docs / command-truth integration

If requested lane count is lower than available categories, categories are merged deterministically.
If safe isolation is not possible, lane count is reduced rather than inventing unsafe parallelism. Requested lane counts above 4 are capped to 4 with a warning.

## Output artifacts written today

Default output directory: `.playbook/orchestrator`

- `orchestrator.json` (written when `--format json` or `--format both`)
- `lane-1.prompt.md`, `lane-2.prompt.md`, ... (written when `--format md` or `--format both`)
- `.playbook/orchestrator/workers/<lane_id>/worker-fragment.template.json` (written for lanes that may contribute to protected singleton docs)

`orchestrator.json` includes:

- Goal and requested/produced lane counts
- Explicit shared-file conflict hubs
- Warnings for deterministic degradations
- Lane contracts with allowed/forbidden paths, wave/dependency ordering, prompt file mapping, protected singleton doc registry, and worker-fragment metadata

## Current limitations (v0)

- No runtime execution plane: command does not launch workers, create branches, open PRs, merge code, or run autonomous loops.
- Lane decomposition is template-based with up to four deterministic ownership buckets.
- Lane contracts are generated from static ownership blueprints; this is not a dynamic graph-aware lane compiler yet.
- Prompt artifacts are markdown files only; no native task-execution protocol is emitted.

## Shared-file policy

The following conflict hubs are always surfaced explicitly:

- `README.md`
- `docs/CHANGELOG.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`

These files are treated as shared-risk surfaces and should be integrated with explicit coordination.

Protected singleton docs are a stricter subset of narrative surfaces that workers must not edit directly:

- `docs/CHANGELOG.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/commands/orchestrate.md`
- `docs/commands/workers.md`

Rule — Workers write fragments for protected singleton docs; they do not edit them directly.
Pattern — Narrative singleton surfaces are consolidated once, not edited in parallel.
Failure Mode — Surface-safe worker lanes still collide if singleton docs remain shared write targets.

## Worker prompt contract

Each generated lane prompt includes:

- Objective
- Why the lane exists
- Allowed direct-edit files
- Fragment-only protected singleton docs
- Forbidden files
- Shared-file policy
- Dependency / wave info
- Implementation plan
- Verification steps
- Documentation updates
- Merge notes

Rule — Human prompt surfaces should carry only bounded execution instructions, not full machine state.
Pattern — Artifact-rich, prompt-thin orchestration keeps operators fast.
Failure Mode — Dumping full machine context into worker prompts lowers signal and increases drift.

This keeps worker execution bounded and lane ownership explicit while preserving the full lane contract in `.playbook/orchestrator/**`.

## Worker fragment contract

When a lane touches protected singleton docs, the worker bundle includes a machine-facing `worker-fragment.template.json` contract under `.playbook/orchestrator/workers/<lane_id>/`.

The fragment contract is intentionally artifact-first:

- `kind = worker-fragment`
- `artifactPath` stays under `.playbook/`
- `conflictKey = target_doc + "::" + section_key`
- `orderingKey = <zero-padded-wave>:<target_doc>::<section_key>::<lane_id>`

Identical inputs therefore produce identical fragment ordering and stable conflict keys without granting workers any new mutation authority over singleton docs.

## Future scope (not implemented in this command)

Future-oriented orchestration subcommand concepts such as `orchestrate plan`, `orchestrate explain`, or `orchestrate verify` are not implemented on the current branch.

For live behavior and options, use `pnpm playbook orchestrate --help` and treat this page as the authoritative v0 contract.


## Workset lane compilation (Phase 8 slice)

Use `--tasks-file` to compile multiple routed tasks into deterministic, proposal-only worker lanes:

```bash
pnpm playbook orchestrate --tasks-file ./fixtures/tasks.json --json
```

This writes `.playbook/workset-plan.json` and `.playbook/lane-state.json` with:

- `input_tasks`, `routed_tasks`, `lanes`, `blocked_tasks`
- deterministic `dependency_edges` and `merge_risk_notes`
- deterministic lane-state (`blocked_lanes`, `ready_lanes`, `merge_readiness`, `verification_status`)
- compact protected-doc consolidation state per lane/workset so merge readiness stays false until protected singleton docs are consolidated
- one worker-ready `codex_prompt` per lane

Why this exists:

- lane planning is the safety layer between single-task routing and autonomous orchestration
- unsupported/ambiguous tasks stay explicit in `blocked_tasks` instead of being silently forced into lanes
- proposal-only posture is preserved end-to-end


## Workset-plan -> lane-state progression

`workset-plan` is deterministic planning intent. `lane-state` is deterministic readiness tracking for that intent.

This progression is required before any future autonomous orchestration slice because it keeps unsupported/ambiguous work explicit, blocks unresolved dependency chains, and exposes conservative merge readiness rather than inferring optimistic execution state.

Rule — Merge readiness must account for unresolved protected singleton doc consolidation.
Pattern — Shared narrative work is complete only when consolidation is complete.
Failure Mode — Marking lanes merge-ready before protected-doc integration recreates manual merge hotspots under a deterministic-looking surface.
