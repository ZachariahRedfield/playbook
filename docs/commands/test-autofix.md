# `pnpm playbook test-autofix`

Orchestrate deterministic test failure diagnosis, bounded repair planning, reviewed execution, and narrow-first verification.

## Usage

```bash
pnpm playbook test-autofix --input .playbook/ci-failure.log
pnpm playbook test-autofix --input .playbook/ci-failure.log --json
pnpm playbook test-autofix --input .playbook/ci-failure.log --dry-run --json
pnpm playbook test-autofix --input .playbook/ci-failure.log --confidence-threshold 0.8 --json
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
5. deterministic confidence scoring and threshold gating
6. remediation history capture in `.playbook/test-autofix-history.json`

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
- confidence falls below the deterministic mutation threshold
- `--dry-run` is enabled

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
- `mode`, `would_apply`, `confidence_threshold`, `autofix_confidence`, and summarized `confidence_reasoning`
- apply summary and files touched provenance via the apply artifact
- verification summary and per-command outcomes
- applied task ids
- excluded finding summary
- deterministic final status, stop reasons, and remediation history path

The remediation history artifact is the trustable evidence layer for bounded self-repair. Each run stores stable failure signatures, triage classifications, admitted vs excluded findings, applied repair classes, verification outcomes, provenance back to the failure log plus generated artifacts, and merge-safe `source_provenance` when history is hydrated from prior CI artifacts. Repeat detection and any future bounded retry policy must key off those stable signatures and recorded outcomes rather than raw console noise.

Repeat-aware remediation is now the explicit policy layer between history and mutation. Before `apply` runs, `test-autofix` evaluates stable failure signatures against `.playbook/test-autofix-history.json` and emits a deterministic retry decision: `no_history`, `allow_repair`, `allow_with_preferred_repair_class`, `blocked_repeat_failure`, or `review_required_repeat_failure`. That policy prevents replaying known-bad repairs, can surface a previously successful repair class as preferred guidance, and still allows only one bounded repair attempt per run without recursive loops. Retry policy is only as trustworthy as the durability of the history it reads, so CI must hydrate prior canonical history rather than pretending a per-run scratch file is stateful memory.
Use `pnpm playbook schema test-autofix --json` to inspect the machine-readable schema.


## GitHub Actions CI transport

The repository CI workflow now treats remediation as a thin transport layer over canonical runtime artifacts.

When `pnpm test` fails, CI captures the raw failure output to `.playbook/ci-failure.log` and then evaluates explicit mutation gates before doing anything else.
If CI mutation is explicitly enabled and all gates pass, the workflow runs only the canonical commands:

```bash
pnpm playbook test-autofix --input .playbook/ci-failure.log --json
pnpm playbook remediation-status --json
```

The workflow does not implement repair logic itself.
It only fetches prior remediation artifacts, deterministically merges canonical `.playbook/test-autofix-history.json` payloads, captures the failure log, invokes the canonical remediation commands, and uploads the resulting `.playbook/` artifacts.

Fail-closed gates keep the trust boundary explicit:

- diagnosis via `test-triage`
- planning via `test-fix-plan`
- execution via `apply --from-plan`
- orchestration via `test-autofix`
- inspection/reporting via `remediation-status`

If policy gates block mutation, CI writes `.playbook/ci-remediation-policy.json` and reports blocked-by-policy state instead of widening the mutation path.

Operational soak guardrails stay in the CI transport layer rather than inside a second policy engine:

- repeated workflow reruns for the same commit SHA are blocked after the first CI autofix attempt by default
- the blocked reason is written into `.playbook/ci-remediation-policy.json` so operators can distinguish retry suppression from core remediation-policy blocks
- explicit retry override signals (workflow-dispatch input or the `playbook:retry-autofix` PR label) may bypass only that transport-level retry suppression
- overrides do **not** bypass event trust, branch trust, clean-worktree checks, protected-branch dry-run behavior, confidence thresholds, or the canonical `test-autofix` / `apply` trust boundary

## Rule / Pattern / Failure Mode

- Rule: Mutation must always pass through a single governed execution boundary.
- Pattern: New automation capabilities should orchestrate existing diagnosis, planning, execution, and verification seams instead of inventing a parallel executor.
- Failure Mode: Self-repair systems that skip explicit result classification and stop conditions become noisy, unsafe, and hard to trust.

## Confidence scoring + dry-run

`test-autofix` now computes a deterministic `autofix_confidence` in `[0,1]` and explains it with ordered `confidence_reasoning`. The score remains stable across equivalent runs because it only uses stable artifacts: failure kinds, repeat-policy output, remediation history, and the admitted/excluded finding ratio.

Scoring rules are intentionally simple and explainable:

- preferred failure classes (`snapshot_drift`, `stale_assertion`, `ordering_drift`) boost confidence
- prior successful repair classes for the same stable failure signature boost confidence
- repeated failed repair attempts penalize confidence
- higher exclusion ratios reduce confidence
- repeat-policy decisions still dominate: `blocked_repeat_failure` forces confidence to `0`, and preferred repair guidance adds a bounded boost

Use `--dry-run` to execute triage, plan generation, repeat-policy evaluation, and confidence gating without calling `apply` or mutating the repository. In dry-run mode, verification commands are still surfaced in the artifact contract but are not executed because they depend on mutation.

## Confidence-based mutation gate

Mutation now occurs only when all of the following are true:

- repeat-policy gates allow mutation
- `--dry-run` is not enabled
- `autofix_confidence >= confidence_threshold`

The default threshold is `0.7`. Override it with `--confidence-threshold <0-1>` or `PLAYBOOK_AUTOFIX_CONFIDENCE_THRESHOLD`. Below threshold, `test-autofix` emits `final_status: blocked_low_confidence`, preserves the trust boundary, and extends `retry_policy_reason` with the confidence explanation instead of mutating.

## GitHub Actions CI transport

The repository CI workflow still acts only as a thin transport and gate over canonical artifacts. Protected branches such as `refs/heads/main`, plus pull requests targeting those protected branches, now run `test-autofix` in `--dry-run` mode by default, while allowed non-protected branches may run in apply mode. Both modes upload the same deterministic artifacts (`ci-failure.log`, `ci-remediation-policy.json`, `test-triage.json`, `test-fix-plan.json`, `test-autofix-apply.json`, `test-autofix.json`, `test-autofix-history.json`, `remediation-status.json`, and PR-comment markdown when rendered), and CI may pass `PLAYBOOK_AUTOFIX_CONFIDENCE_THRESHOLD` to keep mutation thresholds configurable without moving heuristics into workflow scripts.

- Rule: mutation should only occur when confidence exceeds a deterministic threshold and policy gates allow it.
- Pattern: all CI/PR decisions come from remediation artifacts; workflow scripts only transport and gate the runtime.
- Failure Mode: adding confidence heuristics directly to workflow logic creates drift between CI behavior and CLI truth.

- Rule: Retry policy is only as trustworthy as the durability of the history it reads.
- Pattern: Transport should hydrate canonical artifacts, not invent workflow-local state.
- Failure Mode: Per-run ephemeral history makes repeat-aware policy look real while silently acting stateless.
