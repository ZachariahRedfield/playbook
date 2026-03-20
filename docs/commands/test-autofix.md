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

Trust boundary wording stays explicit:

- `test-triage` = diagnosis
- `test-fix-plan` = bounded repair planning
- `apply --from-plan` = reviewed execution
- `test-autofix` = orchestration only

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
- `.playbook/test-autofix.json`

JSON output is the stable `test-autofix` artifact itself.
It records:

- triage and fix-plan source references
- apply summary
- verification summary
- executed verification commands
- applied task ids
- excluded finding summary
- deterministic final status and reason

Use `pnpm playbook schema test-autofix --json` to inspect the machine-readable schema.

## Rule / Pattern / Failure Mode

- Rule: Mutation must always pass through a single governed execution boundary.
- Pattern: New automation capabilities should orchestrate existing diagnosis, planning, execution, and verification seams instead of inventing a parallel executor.
- Failure Mode: Self-repair systems that skip explicit result classification and stop conditions become noisy, unsafe, and hard to trust.
