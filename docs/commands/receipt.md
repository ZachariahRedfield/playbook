# `pnpm playbook receipt`

Deterministically ingest explicit execution results into the canonical adoption control loop.

## Command

```bash
pnpm playbook receipt ingest <execution-results.json> --json
```

This command converts explicit execution outcomes into:

1. `.playbook/execution-outcome-input.json`
2. `receipt`
3. `updated_state`
4. `next_queue`

Canonical loop:

`state -> queue -> execution plan -> execution result -> receipt -> updated-state -> next queue`

## Execution result input contract

Input must be a JSON array of deterministic `ExecutionResult` objects:

```json
[
  {
    "repo_id": "repo-a",
    "prompt_id": "wave_1:apply_lane:repo-a",
    "status": "success"
  },
  {
    "repo_id": "repo-b",
    "prompt_id": "wave_1:apply_lane:repo-b",
    "status": "failed",
    "error": "apply worker failed"
  }
]
```

Contract:

```ts
type ExecutionResult = {
  repo_id: string
  prompt_id: string
  status: 'success' | 'failed' | 'not_run'
  observed_transition?: {
    from: string
    to: string
  }
  error?: string
}
```

## Deterministic ingestion behavior

- Results are sorted deterministically before artifact generation.
- The command overwrites `.playbook/execution-outcome-input.json`; it does not append.
- `receipt`, `updated_state`, and `next_queue` are derived from the ingested results in one control-loop pass.
- Retry/replan routing is derived only from `updated_state`.
- Playbook does **not** infer execution outcomes from repo state in this command; execution outcomes must be supplied explicitly.

When `observed_transition` is omitted, Playbook uses a deterministic mapping:

- `success` -> planned transition target
- `failed` -> no lifecycle advance
- `not_run` -> no lifecycle advance

## Output shape

```json
{
  "schemaVersion": "1.0",
  "command": "receipt",
  "mode": "ingest",
  "outcome_input_path": ".playbook/execution-outcome-input.json",
  "receipt": { "kind": "fleet-adoption-execution-receipt" },
  "updated_state": { "kind": "fleet-adoption-updated-state" },
  "next_queue": {
    "kind": "fleet-adoption-work-queue",
    "queue_source": "updated_state"
  }
}
```

## Example workflow

```bash
pnpm playbook status execute --json > .playbook/execution-plan.snapshot.json
pnpm playbook receipt ingest .playbook/execution-results.json --json
pnpm playbook status receipt --json
pnpm playbook status updated --json
```

## Governance notes

- **Rule**: Do not infer execution outcomes from repo state — only consume explicit execution results.
- **Pattern**: `state -> queue -> execution plan -> execution result -> receipt -> updated-state -> next queue`
- **Failure Mode**: Building ingestion separate from the control loop leads to mismatched semantics and nondeterministic cycles.
