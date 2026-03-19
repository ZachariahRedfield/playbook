# `playbook receipt`

Ingest explicit execution results into the canonical adoption control loop:

`execution result -> receipt -> updated-state -> next queue`

Replay the same canonical execution outcome input through that exact loop to confirm determinism and classify plan drift:

`execution outcome input -> receipt -> updated-state -> next queue -> replay/drift inspection`

## Usage

```bash
pnpm playbook receipt ingest ./execution-results.json --json
pnpm playbook receipt replay --json
pnpm playbook receipt replay --input .playbook/execution-outcome-input.json --json
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

`playbook receipt replay --json` returns deterministic JSON-first replay evidence:

```json
{
  "command": "receipt",
  "mode": "replay",
  "classification": "completed_with_drift",
  "deterministic": true,
  "evidence": {
    "committed_updated_state": { "matches": true },
    "derived_next_queue_from_committed_updated_state": { "matches": true }
  },
  "summary": {
    "what_happened": "Replay completed deterministically but surfaced execution drift or non-terminal execution variance.",
    "matched_plan": false
  }
}
```

Replay classification is limited to deterministic evidence already present in canonical artifacts:

- `completed_as_planned`
- `completed_with_drift`
- `mismatch`
- `stale_plan_or_superseded`

## Artifacts

- `.playbook/execution-outcome-input.json`
- `.playbook/execution-updated-state.json`
- `.playbook/staged/workflow-status-updated/execution-updated-state.json`

Replay is read-only: it reuses the canonical execution outcome input artifact and compares replayed downstream state against committed truth without mutating committed artifacts.

## Pattern

`state -> queue -> execution plan -> execution result -> receipt -> updated-state -> next queue`

- Rule: Replay must derive from canonical execution artifacts rather than alternate simulation state.
- Pattern: Drift visibility should be a first-class signal layered over the receipt/update loop.

## Failure mode

If execution ingestion is modeled separately from receipt reconciliation and queue derivation, the control loop can drift into mismatched semantics and nondeterministic retries.

Without replay and drift classification, closed-loop automation becomes harder to debug, test, and trust.


## Story linkage

When the committed `.playbook/execution-plan.json` includes `story_reference`, `playbook receipt ingest` preserves that linkage in the receipt and updated-state outputs, writes the canonical `.playbook/execution-receipt.json`, and reconciles lightweight linkage fields back into `.playbook/stories.json` through the governed write path only. Story lifecycle updates remain explicit and conservative: blocked receipt evidence may transition the linked story to `blocked`, and fully completed deterministic outcomes may transition it to `done`.

- Rule: Story lifecycle transitions must be driven by linked execution artifacts, not UI-only state.
- Pattern: Story is durable intent; plan is execution shape; receipt is observed outcome.
- Failure Mode: Story status edited independently of receipt/updated-state creates split-brain backlog truth.
