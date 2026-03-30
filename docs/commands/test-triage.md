# `pnpm playbook test-triage`

Parse captured Vitest, pnpm recursive failure output, GitHub Actions annotation lines, saved log files, or stdin into a deterministic failure-summary contract.

## Usage

```bash
pnpm playbook test-triage --input .playbook/ci-failure.log
pnpm playbook test-triage --input .playbook/ci-failure.log --json
cat .playbook/ci-failure.log | pnpm playbook test-triage --json
pnpm playbook schema test-triage --json
```

## Contract intent

`test-triage` is the first-class Playbook failure summarization surface.

- Raw stdout/stderr stays preserved for auditability.
- A deterministic normalized summary is emitted alongside the raw log.
- Default output is copy-paste-ready markdown for CI step summaries, PR comments, or AI remediation prompts.
- `--json` emits the stable machine-readable contract.

Rule: Any Playbook-managed CI/test failure must emit both raw output and a deterministic normalized summary.

Pattern: Failure summarization is a contract surface, not a convenience logger.

Failure Mode: Raw stderr alone creates re-interpretation work and slows remediation across repeated CI loops.

## Supported inputs

- saved log files via `--input <path>`
- piped stdin
- Vitest failure output
- pnpm recursive workspace failure output
- GitHub Actions annotation lines such as `::error file=...,line=...,col=...::...`

## Normalized JSON contract

The JSON artifact now includes these first-class summary fields in addition to the existing `findings`, `rerun_plan`, and `repair_plan` surfaces:

- `schemaVersion`
- `kind`
- `status`
- `summary`
- `failureLayer`
- `primaryFailureClass`
- `automationEligibility`
- `failures[]`
- `crossCuttingDiagnosis[]`
- `recommendedNextChecks[]`

Each `failures[]` entry normalizes the failure into stable copy-paste-ready fields:

- `type`
- `workspace`
- `suite`
- `test`
- `file`
- `line`
- `column`
- `message`
- `likelyCauses[]`

## Classification heuristics

`test-triage` recognizes and normalizes these deterministic classes:

Failure layers:

- `infra_failure`
- `governance_failure`
- `product_failure`

- `snapshot_drift`
- `missing_expected_finding`
- `contract_drift`
- `test_expectation_drift`
- `lint_failure`
- `typecheck_failure`
- `runtime_failure`
- `recursive_workspace_failure`
- existing low-risk repair classes such as `stale_assertion`, `fixture_drift`, and `ordering_drift`

Deterministic infra buckets include:

- `registry_timeout_install_failure`
- `cache_restore_failure`
- `composite_action_manifest_parse_failure`
- `tool_bootstrap_failure`

Deterministic governance buckets include:

- `release_governance_preflight_failure`
- `contracts_snapshot_drift`
- `docs_audit_contract_failure`
- `command_governance_enforcement_failure`

Cross-failure grouping collapses related failures into `crossCuttingDiagnosis[]` when the log suggests one partially integrated feature or shared fixture/contract dependency is producing multiple downstream symptoms.
The contract keeps `failures[]` deterministic, but consumers should treat entries as normalized coverage rather than semantic ranking; use `primaryFailureClass` for rank-like summary decisions instead of array position.

## CI integration

The reusable Playbook CI workflow now writes:

- `.playbook/ci-failure.log`
- `.playbook/failure-summary.json`
- `.playbook/failure-summary.md`
- `.playbook/test-triage.json`

It also appends the markdown summary to the GitHub Actions step summary when available.

## Follow-on remediation boundary

`test-triage` remains diagnosis-first automation.

- It parses repeated CI failure shapes into deterministic repair classes.
- It emits the smallest rerun commands first.
- It generates repair planning guidance and a Codex-ready prompt for low-risk test-only classes.
- It can feed a first-class `test-fix-plan` artifact that turns only pre-approved low-risk findings into apply-compatible remediation tasks.
- It does **not** auto-edit production logic in this slice.
- It preserves the governance boundary: diagnosis first, repair planning second, and no blind merge-time mutation.

Rule: Automate diagnosis first, repair second, merge never.
Rule: Schema or contract drift is always classified as `governance_failure`.

Pattern: Most repeated CI failures cluster into a small set of deterministic repair classes that can be parsed from test output.
Pattern: Classify first -> summarize clearly -> route the correct next action.
Pattern: Failure classification must reflect system ownership, not symptom surface.

Failure Mode: Teams waste time manually re-deriving the same failure classification logic instead of encoding it as reusable automation.
Failure Mode: Treating all red CI runs as the same kind of failure causes repeated wrong fixes and wasted cycles.
Failure Mode: Treating contract drift as runtime failure misroutes remediation to product layer.
Rule: Infra failures, governance failures, and product failures must be classified separately before remediation is attempted.
