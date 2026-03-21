# `pnpm playbook docs consolidate-plan`

`pnpm playbook docs consolidate-plan` turns `.playbook/docs-consolidation.json` into an apply-compatible reviewed-write artifact at `.playbook/docs-consolidation-plan.json`.

## Usage

```bash
pnpm playbook docs consolidate --json
pnpm playbook docs consolidate-plan --json
pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json
```

## v1 bounded operations

- replace managed block
- append managed block
- insert under explicit anchor

## Guarantees

1. `consolidate-plan` is proposal/preparation only; `apply` remains the only mutation boundary.
2. Only conflict-free deterministic fragment groups become executable tasks.
3. Ambiguous groups, invalid payloads, markdown-only fragments, and missing anchors stay in `exclusions` with reasons.
4. Workers propose, the consolidator compiles, and `apply` executes.

## Failure mode

Letting docs consolidation mutate directly would create a shadow executor and break the single reviewed write boundary.
