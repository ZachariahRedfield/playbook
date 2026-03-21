# `pnpm playbook docs consolidate-plan`

`pnpm playbook docs consolidate-plan` turns the proposal-only `.playbook/docs-consolidation.json` artifact into an apply-compatible reviewed-write plan for protected singleton docs.

## Usage

```bash
pnpm playbook docs consolidate-plan
pnpm playbook docs consolidate-plan --json
pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json
```

## Contract

- Input: `.playbook/docs-consolidation.json`
- Output: `.playbook/docs-consolidation-plan.json`
- Execution: `apply --from-plan` is the only mutation boundary

The v1 planner emits tasks only for bounded managed-write operations:

- replace managed block
- append managed block
- insert under explicit anchor

Anything ambiguous stays excluded with a machine-readable reason. Examples include conflicting fragments, mixed write strategies, missing target files, and missing anchors.

## Governance

- Rule: Consolidation planning may prepare reviewed writes, but `apply` remains the only mutation boundary.
- Pattern: Workers propose, consolidator compiles, apply executes.
- Failure Mode: Letting docs consolidation mutate directly creates a shadow executor and breaks the single reviewed write boundary.
