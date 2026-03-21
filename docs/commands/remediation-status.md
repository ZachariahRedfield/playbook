# `pnpm playbook remediation-status`

Inspect the operator-facing remediation read model for recent `test-autofix` runs.

## Usage

```bash
pnpm playbook remediation-status
pnpm playbook remediation-status --json
pnpm playbook remediation-status --latest-result .playbook/test-autofix.json --history .playbook/test-autofix-history.json
pnpm playbook schema remediation-status --json
```

## What it does

`remediation-status` is the inspection/reporting seam for bounded self-repair.
It is read-only and aggregates the canonical remediation artifacts already produced by `test-autofix`:

- the latest `.playbook/test-autofix.json` result
- `.playbook/test-autofix-history.json`
- stable failure signatures across recent runs
- repeat-policy decisions
- latest confidence score, threshold, mode, and confidence reasoning
- preferred repair classes from prior success
- blocked, review-required, and safe-to-retry signatures
- recent final statuses and remediation history

This command does **not** mutate repository state.
It does **not** run `apply`.
It does **not** re-run `test-autofix`.

## Workflow separation

Operator trust depends on keeping the seams explicit:

- `test-triage` = diagnosis
- `test-fix-plan` = planning
- `apply` = execution
- `test-autofix` = orchestration
- `remediation-status` = inspection/reporting

## Output

Text mode highlights:

- latest run status, mode, and confidence
- blocked signatures
- preferred repair guidance
- signatures currently safe to retry
- recent repeated failures
- recent final statuses

JSON mode returns the full machine-readable remediation-status read model for automation.


## CI + PR feedback transport

CI and PR reporting should render deterministic remediation artifacts only.
The repository workflow now uses `remediation-status` as the read-only reporting seam for sticky PR feedback and uploaded CI artifacts.

That transport layer reads:

- `.playbook/ci-remediation-policy.json`
- `.playbook/test-autofix.json`
- `.playbook/test-autofix-history.json`
- `.playbook/remediation-status.json`

The sticky PR summary is therefore an artifact-backed status view, not an independent GitHub-specific analysis layer. The CI policy artifact now also records transport-level retry suppression, explicit override provenance, protected-target dry-run enforcement, and the canonical artifact path set so `remediation-status` outputs, uploaded artifacts, and PR comments stay aligned during soak. Because CI now hydrates and merges prior canonical remediation-history artifacts before running `test-autofix`, the read model can surface cross-run repeat decisions and confidence calibration from durable evidence instead of workflow-local scratch state.

## Missing artifacts

By default the command reads:

- `.playbook/test-autofix.json`
- `.playbook/test-autofix-history.json`

If either artifact is missing or invalid, the command fails clearly instead of inferring state from raw logs.

## Rule / Pattern / Failure Mode

- Rule: Once remediation decisions become stateful, the system needs a first-class readable status surface.
- Pattern: Remediation systems should separate mutation flow from operator-facing inspection/reporting views.
- Failure Mode: Policy-aware automation without a readable status surface becomes hard to trust, debug, and adopt.


`remediation-status` remains read-only, but its latest-run summary now mirrors confidence-aware gating state from the canonical `test-autofix` artifact. That means CI and PR renderers can report whether a run was dry-run vs apply, whether mutation would have occurred, the deterministic confidence score, and whether low confidence blocked mutation without inventing any workflow-local logic.

- Rule: Retry policy is only as trustworthy as the durability of the history it reads.
- Pattern: Transport should hydrate canonical artifacts, not invent workflow-local state.
- Failure Mode: Per-run ephemeral history makes repeat-aware policy look real while silently acting stateless.
