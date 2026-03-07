# `playbook audit architecture`

`playbook audit architecture` runs deterministic architecture guardrail checks for core platform hardening controls.

## Usage

```bash
playbook audit architecture
playbook audit architecture --json
```

## What it checks (v1)

1. artifact evolution policy
2. artifact schema versioning
3. SCM/git context normalization layer
4. remediation trust model
5. AI vs deterministic boundary
6. ecosystem adapter boundaries
7. context/token efficiency strategy
8. roadmap/docs hardening coverage

## Output contract

`--json` returns a stable envelope:

- `schemaVersion: "1.0"`
- `command: "audit-architecture"`
- `ok`
- `summary` (`status`, `checks`, `pass`, `warn`, `fail`)
- `audits[]` (`id`, `title`, `status`, `severity`, `evidence[]`, `recommendation`)
- `nextActions[]`

The contract is deterministic and intended for CI/automation snapshot testing.

## Governance intent

- Added a deterministic `playbook audit architecture` command to detect missing platform hardening guardrails.
- Introduced architecture audit checks for artifact evolution policy, SCM normalization, remediation trust boundaries, AI/determinism boundaries, ecosystem adapters, and context efficiency.
- Standardized architecture audit output with a stable JSON contract for automation and snapshot testing.
