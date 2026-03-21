# `pnpm playbook docs consolidate`

`pnpm playbook docs consolidate` is the proposal-only consolidation seam for protected singleton narrative docs.

It reads the worker fragment artifacts emitted under `.playbook/orchestrator/workers/*/worker-fragment.json` plus the protected-surface registry from `.playbook/orchestrator/orchestrator.json`, then produces:

- `.playbook/docs-consolidation.json`
- one compact lead-agent integration brief embedded in the artifact and printed in text mode

## Usage

```bash
pnpm playbook docs consolidate
pnpm playbook docs consolidate --json
```

## Guarantees

1. Deterministic fragment ordering by `ordering_key`, then `fragment_id`.
2. Deterministic duplicate/conflict detection by stable `conflict_key` grouping.
3. Compact human-facing integration guidance without mutating protected docs.
4. No new mutation executor: v1 stops at the consolidation artifact and brief.

## Governance

- Rule: Consolidation planning may prepare reviewed writes, but `apply` remains the only mutation boundary.
- Pattern: Workers propose, consolidator compiles, apply executes.
- Failure Mode: Letting docs consolidation mutate directly creates a shadow executor and breaks the single reviewed write boundary.
- Pattern: Workers propose; consolidator integrates.
- Failure Mode: Parallel docs work without consolidation becomes a merge-management problem, not a productivity gain.

## Follow-on reviewed execution

After review, run `pnpm playbook docs consolidate-plan --json` to compile approved bounded managed-write tasks, then choose whether to cross the mutation boundary with `pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json`.
