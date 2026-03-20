# `pnpm playbook test-fix-plan`

Generate a bounded remediation plan from a deterministic `test-triage` artifact.

## Usage

```bash
pnpm playbook test-fix-plan --from-triage .playbook/test-triage.json
pnpm playbook test-fix-plan --from-triage .playbook/test-triage.json --json
pnpm playbook test-fix-plan --from-triage .playbook/test-triage.json --out .playbook/test-fix-plan.json
pnpm playbook schema test-fix-plan --json
```

## Scope and governance boundary

`test-fix-plan` is the bounded repair-planning seam between diagnosis and execution.

- `test-triage` stays diagnosis-only: it classifies failure shape and does not mutate repository state.
- `test-fix-plan` stays planning-only: it consumes the first-class `test-triage` artifact instead of raw CI logs and emits executable tasks only for pre-approved low-risk classes.
- `apply` stays reviewed execution: operators must still choose to run `pnpm playbook apply --from-plan .playbook/test-fix-plan.json` before any repository mutation occurs.
- It writes the stable `test-fix-plan` artifact to `.playbook/test-fix-plan.json` by default.
- It preserves risky or unsupported findings as explicit exclusions with provenance and leaves them review-required.
- It keeps the downstream surface apply-compatible without allowing hidden CLI-only mutation behavior.

Rule: every canonical remediation command must expose one stable artifact contract and one authoritative operator doc.

Pattern: add new remediation commands as artifact-producing seams before orchestration wrappers.

Failure Mode: hidden CLI-only behavior without contract/docs coverage drifts faster than engine truth.

## Approved task classes

`test-fix-plan` currently emits apply-compatible tasks only for these deterministic low-risk classes:

- `snapshot_refresh`
- `stale_assertion_update`
- `fixture_normalization`
- `deterministic_ordering_stabilization`

Everything else is recorded under `excluded[]` with a deterministic reason and remains review-required instead of being silently downgraded into executable work.

## Output contract

JSON output is the stable `test-fix-plan` artifact itself.

Key fields:

- `tasks[]` with `id`, `ruleId`, `file`, `action`, `autoFix`, `task_kind`, and `provenance`
- `excluded[]` with deterministic exclusion reasons and preserved evidence
- `summary` with total, eligible, excluded, and auto-fix counts
- `source` proving the command only derived work from a `test-triage` artifact

Use `pnpm playbook schema test-fix-plan --json` to inspect the stable machine-readable schema.
