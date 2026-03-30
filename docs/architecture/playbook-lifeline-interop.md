# Playbook ↔ Lifeline interop (remediation-first with bounded Fitness seam)

This document defines the deterministic interop seam for bounded remediation work, with one implemented external canonical-contract pilot.

See the canonical layer ownership + closed-loop definition in [`CONTROL_LOOP_AND_LAYER_OWNERSHIP.md`](./CONTROL_LOOP_AND_LAYER_OWNERSHIP.md).

## Scope (v1)

Historically, this runtime was remediation-only. That remains true as baseline doctrine.

Current bounded scope:

- remediation-loop actions:
  - `test-triage`
  - `test-fix-plan`
  - `apply-result`
  - `test-autofix`
  - `remediation-status`
- Fitness mirrored canonical actions (first external canonical-contract consumer pilot):
  - `adjust_upcoming_workout_load`
  - `schedule_recovery_block`
  - `revise_weekly_goal_plan`

Guardrails that still apply:

- all requests require explicit request/receipt/rendezvous boundaries
- no general autonomous execution expansion

## Canonical pause/resume manifest

`.playbook/rendezvous-manifest.json` remains the source of truth for pause/resume/readiness.
Playbook emits bounded Lifeline requests when rendezvous evaluation is `releaseReady: true`.

For the plan-derived Fitness pilot path, emission is also allowed from explicit approved plan state using the same bounded request/receipt runtime seam.

## Interop contract shapes

`packages/core/src/contracts/playbookLifelineInterop.ts` and
`packages/contracts/src/playbook-lifeline-interop.schema.json` define these first-class envelopes:

1. capability registration
2. action request
3. action status
4. execution receipt
5. heartbeat/health snapshot
6. blocked/rejected reason
7. retry/reconcile state

## Fitness contract boundary

Rule:

External app contracts are consumed, not semantically redesigned.

Rule:

External canonical contracts may widen bounded execution only through existing request/receipt/rendezvous seams.

Pattern:

Source contract -> validated mirror -> adapter.

Pattern:

approved state -> bounded request -> receipt -> updated truth.

Failure mode:

Local reinterpretation drifts action/receipt/routing semantics away from the source contract.

Failure mode:

Runtime capabilities evolve faster than architecture docs, creating hidden scope drift and operator confusion.

## Deterministic runtime loop

Pattern:

`approved plan or release-ready rendezvous -> bounded request -> execution -> receipt -> updated truth`

Rule:

No action is considered real until a receipt returns to Playbook.

Failure mode:

Execution without receipts creates silent drift and destroys trust.

## Durable state

Runtime data is persisted at `.playbook/lifeline-interop-runtime.json` and survives restarts.
Reconcile derives request states from durable receipts with explicit states:

- `pending`
- `running`
- `failed`
- `completed`
- `blocked`

Reconcile also materializes `.playbook/interop-updated-truth.json` as a read-first deterministic truth-update artifact derived only from canonical runtime receipts plus the canonical Fitness contract mirror fingerprint/source pointer. Each update entry carries:

- `receiptId`
- `requestId`
- `action`
- `receiptType`
- `sourceHash`
- `canonicalOutcomeSummary`
- bounded state delta (`requestState`, output artifact refs)
- `memoryProvenanceRefs`
- `nextActionHints`

Rule:

Receipts must resolve into explicit truth-update artifacts, not implicit operator interpretation.

Pattern:

bounded request -> receipt -> updated truth -> next action.

Failure mode:

If receipt handling stops at runtime reconciliation, the loop can look complete while truth updates still live in human interpretation.

## Inspect surfaces

CLI command:

- `pnpm playbook interop capabilities --json`
- `pnpm playbook interop requests --json`
- `pnpm playbook interop receipts --json`
- `pnpm playbook interop health --json`
- `pnpm playbook interop followups --json` (reads `.playbook/interop-followups.json`, supports `--type` and `--surface` filters, remains read-only/no execution)

Followup contract note:

- Deterministic followup rows include additive enrichment fields (`action`, `confidence`, `provenanceRefs`, `source.requestId`, `source.receiptId`) derived from updated-truth evidence.
- Rule: Followup artifacts must include provenance and confidence when derived from deterministic updated-truth.
- Pattern: Use partial object matching in tests for forward-compatible artifact evolution.
- Failure Mode: Strict equality assertions on evolving artifacts cause false-negative CI failures during intentional contract expansion.

Mock runtime command family:

- `pnpm playbook interop register --capability lifeline-remediation-v1 --action test-autofix --json`
- `pnpm playbook interop emit --capability lifeline-remediation-v1 --action test-autofix --json`
- `pnpm playbook interop emit-fitness-plan --capability lifeline-remediation-v1 --action schedule_recovery_block --approved-plan --json`
- `pnpm playbook interop run-mock --json`
- `pnpm playbook interop reconcile --json`
