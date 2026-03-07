# CLI

## 1) CLI philosophy

Playbook CLI commands are designed for both humans and automation:

- Support readable text output for local developer workflows.
- Support machine-readable JSON output for CI and tooling.
- Keep output deterministic wherever possible (stable ordering and normalized fields).
- Treat JSON output as a public automation contract.

## 2) Command architecture

Playbook keeps command handling and core logic separate:

- `packages/cli`: argument parsing, command dispatch, rendering, and exit behavior.
- `packages/engine`: analysis, verification, planning, and remediation execution logic (`apply` + `fix`).

Command files should stay thin wrappers around engine functionality so behavior remains reusable and testable.

## 3) JSON output contract

Typical JSON envelope:

```json
{
  "schemaVersion": "1.0",
  "command": "verify",
  "results": []
}
```

Why this contract exists:

- CI compatibility (stable shape for pipelines).
- Reliable integration for AI agents.
- Safer parsing in automation workflows.

## 4) Command pipeline overview

Core Playbook flow:

1. `analyze` → detect repository structure and stack signals.
2. `verify` → detect governance/issues from deterministic rules.
3. `plan` → generate deterministic remediation tasks.
4. `apply` → execute deterministic auto-fixable plan tasks.
5. `verify` (again) → confirm post-remediation governance state.

## 5) Deterministic behavior

Playbook normalizes and orders machine output to reduce drift across runs:

- Findings are sorted before downstream task generation.
- Stable task fields are preserved for contract consumers.
- Nullable/optional fields are normalized for predictable parsing.


## 6) Remediation command roles

- `verify`: detect policy/governance issues.
- `plan`: generate deterministic remediation intent (`tasks`) for review or automation.
- `apply`: execute deterministic plan tasks, especially via serialized artifacts (`--from-plan`).
- `fix`: convenience/direct remediation command for local/manual workflows; overlaps with `apply` intent but keeps operator-friendly flags like `--dry-run`, `--yes`, and `--only`.

For CI and agent workflows, prefer `verify -> plan -> apply -> verify` because the plan artifact is reviewable before execution.


## 7) Repository diagnosis (`doctor`)

`doctor` is a high-level repository health entry point that aggregates existing analyzers instead of re-implementing their logic.

Current diagnosis sources:

- `verify` findings
- `query risk` (per indexed module)
- `docs audit` findings
- repository index presence (`.playbook/repo-index.json`)

`playbook doctor --json` emits a deterministic contract:

```json
{
  "schemaVersion": "1.0",
  "command": "doctor",
  "status": "ok",
  "summary": {
    "errors": 0,
    "warnings": 0,
    "info": 0
  },
  "findings": []
}
```

Default text output prints diagnosis sections for:

- Architecture
- Docs
- Testing
- Risk
