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

`test-fix-plan` is the remediation seam between diagnosis and mutation.

- It consumes the first-class `test-triage` artifact instead of raw CI logs.
- It emits executable tasks only for pre-approved low-risk classes.
- It writes the stable `test-fix-plan` artifact to `.playbook/test-fix-plan.json` by default.
- It preserves risky or unsupported findings as explicit exclusions with provenance.
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

Everything else is recorded under `excluded[]` with a deterministic reason.

## Output contract

JSON output is the stable `test-fix-plan` artifact itself.

Key fields:

- `tasks[]` with `id`, `ruleId`, `file`, `action`, `autoFix`, `task_kind`, and `provenance`
- `excluded[]` with deterministic exclusion reasons and preserved evidence
- `summary` with total, eligible, excluded, and auto-fix counts
- `source` proving the command only derived work from a `test-triage` artifact

Use `pnpm playbook schema test-fix-plan --json` to inspect the stable machine-readable schema.
