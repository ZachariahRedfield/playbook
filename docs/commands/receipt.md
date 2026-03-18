# `playbook receipt`

Ingest explicit execution results into the canonical adoption control loop:

`execution result -> receipt -> updated-state -> next queue`

## Usage

```bash
pnpm playbook receipt ingest ./execution-results.json --json
```

## Input contract

The ingest command accepts a JSON array of deterministic execution results.

```json
[
  {
    "repo_id": "repo-a",
    "prompt_id": "wave_1:verify_plan_lane:repo-a",
    "status": "failed",
    "observed_transition": {
      "from": "indexed_plan_pending",
      "to": "indexed_plan_pending"
    },
    "error": "verify stayed red"
  },
  {
    "repo_id": "repo-b",
    "prompt_id": "wave_1:apply_lane:repo-b",
    "status": "success",
    "observed_transition": {
      "from": "planned_apply_pending",
      "to": "ready"
    }
  }
]
```

### Rules

- Execution outcomes are consumed **only** from explicit ingest input.
- Playbook does **not** infer execution success/failure from repo state during ingest.
- The canonical receipt input artifact is overwritten at `.playbook/execution-outcome-input.json` using deterministic ordering.
- `updated_state` is reconciled from the receipt, and `next_queue` is derived from `updated_state` only.

## Output

`playbook receipt ingest --json` returns:

```json
{
  "receipt": { "kind": "fleet-adoption-execution-receipt" },
  "updated_state": { "kind": "fleet-adoption-updated-state" },
  "next_queue": {
    "kind": "fleet-adoption-work-queue",
    "queue_source": "updated_state"
  }
}
```

## Artifacts

- `.playbook/execution-outcome-input.json`
- `.playbook/execution-updated-state.json`
- `.playbook/staged/workflow-status-updated/execution-updated-state.json`

## Pattern

`state -> queue -> execution plan -> execution result -> receipt -> updated-state -> next queue`

## Failure mode

If execution ingestion is modeled separately from receipt reconciliation and queue derivation, the control loop can drift into mismatched semantics and nondeterministic retries.
