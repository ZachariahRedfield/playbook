# `pnpm playbook test-autofix`

Orchestrate deterministic test failure diagnosis, bounded repair planning, reviewed execution, and narrow-first verification.

## Usage

```bash
pnpm playbook test-autofix --input .playbook/ci-failure.log
pnpm playbook test-autofix --input .playbook/ci-failure.log --json
pnpm playbook test-autofix --input .playbook/ci-failure.log --out .playbook/test-autofix.json
pnpm playbook schema test-autofix --json
```

## What it does

`test-autofix` closes the bounded remediation loop without creating a new mutation executor.

It is an orchestration wrapper over the existing seams:

1. diagnosis via `test-triage`
2. bounded repair planning via `test-fix-plan`
3. reviewed execution via `apply --from-plan`
4. verification via the exact rerun plan already emitted by `test-triage`
5. remediation history capture in `.playbook/test-autofix-history.json`

Trust boundary wording stays explicit:

- `test-triage` = diagnosis
- `test-fix-plan` = bounded repair planning
- `apply --from-plan` = reviewed execution
- `test-autofix` = orchestration only
- `remediation-status` = inspection/reporting

Risky findings remain review-required and do not become executable automatically.
New automation still produces and consumes plan artifacts instead of inventing a direct mutation path.

## Deterministic stop conditions

`test-autofix` stops without mutation when:

- triage yields no findings
- fix-plan yields no executable tasks
- all findings are exclusion-only / review-required only

`test-autofix` classifies the run explicitly when:

- `apply` fails
- narrow-first verification still fails after apply

Final status is deterministic and one of:

- `fixed`
- `partially_fixed`
- `not_fixed`
- `blocked`
- `review_required_only`

## Verification order

Verification reuses the exact rerun commands already emitted by `test-triage`.
It does not invent new rerun commands.
The intended order is narrow-first:

1. file-first
2. package-next
3. workspace-last

## Output artifact

By default the command writes:

- `.playbook/test-triage.json`
- `.playbook/test-fix-plan.json`
- `.playbook/test-autofix-apply.json`
- `.playbook/test-autofix.json`
- `.playbook/test-autofix-history.json`

JSON output is the stable `test-autofix` artifact itself.
It records:

- deterministic `run_id` plus triage / fix-plan / apply source references
- apply summary and files touched provenance via the apply artifact
- verification summary and per-command outcomes
- applied task ids
- excluded finding summary
- deterministic final status, stop reasons, and remediation history path

The remediation history artifact is the trustable evidence layer for bounded self-repair. Each run stores stable failure signatures, triage classifications, admitted vs excluded findings, applied repair classes, verification outcomes, and provenance back to the failure log plus generated artifacts. Repeat detection and any future bounded retry policy must key off those stable signatures and recorded outcomes rather than raw console noise.


Repeat-aware remediation is now the explicit policy layer between history and mutation. Before `apply` runs, `test-autofix` evaluates stable failure signatures against `.playbook/test-autofix-history.json` and emits a deterministic retry decision: `no_history`, `allow_repair`, `allow_with_preferred_repair_class`, `blocked_repeat_failure`, or `review_required_repeat_failure`. That policy prevents replaying known-bad repairs, can surface a previously successful repair class as preferred guidance, and still allows only one bounded repair attempt per run without recursive loops.
Use `pnpm playbook schema test-autofix --json` to inspect the machine-readable schema.

## Rule / Pattern / Failure Mode

- Rule: Mutation must always pass through a single governed execution boundary.
- Pattern: New automation capabilities should orchestrate existing diagnosis, planning, execution, and verification seams instead of inventing a parallel executor.
- Failure Mode: Self-repair systems that skip explicit result classification and stop conditions become noisy, unsafe, and hard to trust.
