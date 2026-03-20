# `pnpm playbook test-triage`

Parse captured Vitest and pnpm recursive failure output into a deterministic test-triage artifact.

## Usage

```bash
pnpm playbook test-triage --input .playbook/ci-failure.log
pnpm playbook test-triage --input .playbook/ci-failure.log --json
pnpm playbook schema test-triage --json
```

## Scope and governance boundary

`test-triage` is diagnosis-first automation.

- It parses repeated CI failure shapes into deterministic repair classes.
- It emits the smallest rerun commands first.
- It generates repair planning guidance and a Codex-ready prompt for low-risk test-only classes.
- It does **not** auto-edit production logic in this first slice.
- It preserves the governance boundary: diagnosis first, repair planning second, and no blind merge-time mutation.

Rule: Automate diagnosis first, repair second, merge never.

Pattern: Most repeated CI failures cluster into a small set of deterministic repair classes that can be parsed from test output.

Failure Mode: Teams waste time manually re-deriving the same failure classification logic instead of encoding it as reusable automation.

## Fixture isolation lesson

Stabilizing contract snapshot tests exposed a reusable architecture lesson: isolated fixtures surfaced producer/consumer dependencies that shared fixture state had been masking. `test-triage` exists to classify that kind of failure deterministically before any repair path is chosen.

- Rule: isolated contract fixtures force hidden producer/consumer dependencies into the open.
- Pattern: contract snapshots work best when every consumer command declares its prerequisite artifact producers explicitly.
- Failure Mode: shared fixture state makes snapshots look stable while silently depending on prior command side effects.

## Supported deterministic classes

- `snapshot_drift`
- `stale_assertion`
- `fixture_drift`
- `ordering_drift`
- `missing_artifact`
- `environment_limitation`
- `likely_regression`

Low-risk classes are marked `autofix_plan_only`.
Riskier classes are marked `review_required`.

## Output contract

JSON output includes:

- `findings[]` with `failure_kind`, `confidence`, `package`, `test_file`, `test_name`
- `likely_files_to_modify`
- `suggested_fix_strategy`
- `verification_commands`
- `docs_update_recommendation`
- `rule_pattern_failure_mode`
- `repair_class`
- `rerun_plan.commands` in file → package → workspace order
- `repair_plan.summary`
- `repair_plan.codex_prompt`

Use `pnpm playbook schema test-triage --json` to inspect the stable machine-readable envelope.
