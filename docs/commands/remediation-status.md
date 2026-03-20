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

- latest run status
- blocked signatures
- preferred repair guidance
- signatures currently safe to retry
- recent repeated failures
- recent final statuses

JSON mode returns the full machine-readable remediation-status read model for automation.

## Missing artifacts

By default the command reads:

- `.playbook/test-autofix.json`
- `.playbook/test-autofix-history.json`

If either artifact is missing or invalid, the command fails clearly instead of inferring state from raw logs.

## Rule / Pattern / Failure Mode

- Rule: Once remediation decisions become stateful, the system needs a first-class readable status surface.
- Pattern: Remediation systems should separate mutation flow from operator-facing inspection/reporting views.
- Failure Mode: Policy-aware automation without a readable status surface becomes hard to trust, debug, and adopt.
