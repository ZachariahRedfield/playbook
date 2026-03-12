# Orchestrate (`pnpm playbook orchestrate`) — Planned Command Contract

Status: **Planned reference (not yet implemented)**.

This document captures the intended contract for a future `orchestrate` command so control-plane and worker-plane integration can be designed deterministically before runtime execution is enabled.

## Purpose

`orchestrate` is intended to generate deterministic lane contracts that split a larger task into bounded execution lanes with explicit ownership, file boundaries, and dependency order.

Primary goals:

- generate machine-readable lane contracts before any worker execution,
- preserve Playbook as the policy and plan authority,
- ensure every lane advertises exactly which files it may mutate,
- enable merge-safe, dependency-aware wave planning.

## Non-goals (Phase 1)

Phase 1 is contract generation only. It does **not**:

- launch Codex workers,
- auto-merge lane outputs,
- evaluate merge guards in CI,
- maintain long-running orchestration runtime state.

## Control-plane vs worker-plane split

`orchestrate` follows a two-plane model:

- **Playbook control-plane**
  - owns task decomposition,
  - validates lane/file policy,
  - emits deterministic orchestration artifacts,
  - remains the source of truth for governance rules.
- **Codex worker-plane**
  - executes a single assigned lane contract,
  - stays inside that lane's approved file set,
  - returns outputs for later control-plane reconciliation.

Rule: worker execution must be policy-constrained by control-plane artifacts, not free-form repository mutation.

## Lane ownership rules

Each lane contract should define:

- `laneId`: stable lane identifier,
- `owner`: assigned worker identity or role,
- `allowedFiles`: explicit write scope,
- `readContext`: allowed supporting context,
- `deliverables`: expected output artifacts/doc changes,
- `dependsOn`: prerequisite lane IDs,
- `status`: deterministic lifecycle marker (`planned`, `ready`, `blocked`, `complete`).

Ownership rules:

- one lane has one owner at a time,
- lane owners may only modify files in `allowedFiles`,
- cross-lane edits require an explicit contract update before execution,
- shared-file edits must be serialized by dependency/wave order.

## Shared-file policy

Shared files (for example roadmap/docs indexes/contracts) must be declared upfront.

Policy:

- shared files are either:
  - assigned to a dedicated integration lane, or
  - protected by wave ordering so only one lane edits them at a time,
- no optimistic concurrent writes to the same shared file,
- reconciliation is deterministic and control-plane-led.

This policy prevents hidden overlap and reduces merge ambiguity.

## Wave and dependency model

Lanes are grouped into deterministic waves:

- **Wave 0**: prerequisite contract/doc prep,
- **Wave N**: independent lanes runnable in parallel,
- **Wave N+1**: lanes blocked on outputs from earlier waves,
- **Final integration wave**: shared-surface alignment (indexes/contracts/changelog/roadmap updates).

Dependency rules:

- a lane may start only when all `dependsOn` lanes are `complete`,
- failed/blocked lanes halt dependent lanes,
- wave planning is artifact-driven (not inferred ad hoc by workers).

## Usage examples (planned)

Generate lane contracts for a task:

```bash
pnpm playbook orchestrate plan \
  --task "add orchestrate docs and roadmap alignment" \
  --lanes 3 \
  --json \
  --out .playbook/orchestration/plan.json
```

Render human-readable lane summary:

```bash
pnpm playbook orchestrate explain \
  --from .playbook/orchestration/plan.json
```

Validate lane-file boundaries before worker execution:

```bash
pnpm playbook orchestrate verify \
  --from .playbook/orchestration/plan.json \
  --json
```

## Generated artifacts (planned)

Expected artifact set (shape may evolve with implementation):

- `.playbook/orchestration/plan.json`
  - lane contracts, ownership, dependencies, wave ordering,
- `.playbook/orchestration/state.json`
  - orchestration lifecycle state snapshot,
- `.playbook/orchestration/merge-guards.json`
  - shared-file and dependency guard evaluation inputs,
- `.playbook/orchestration/run-summary.json`
  - deterministic run summary for CI/automation.

## Phase scope summary

- **Phase 1 (in scope):** deterministic lane contract generation and validation.
- **Future scope (out of Phase 1):** worker launch, merge guards, orchestration state tracking.
