# `pnpm playbook plan`

Generate a deterministic remediation task plan from current verify findings.

## Common usage

- `pnpm playbook plan`
- `pnpm playbook plan --json`
- `pnpm playbook plan --json --out .playbook/plan.json`
- `pnpm playbook plan --run-id <run-id> --json`

## Implemented behavior

- Produces a plan contract with stable `tasks` ordering derived from verify findings.
- Emits a canonical `remediation.status` (`ready`, `not_needed`, `unavailable`).
- Records plan execution step metadata in runtime session state.
- `--out <path>` writes the JSON artifact when using JSON mode.
- `--run-id <id>` attaches planning to an existing execution run; otherwise a run is created/resolved automatically.

`--ci` is a global option and only affects text-mode verbosity (`--quiet` behavior); it does not change plan semantics.

## Contract notes

- JSON output includes `schemaVersion`, `command`, `ok`, `exitCode`, `verify`, `remediation`, and `tasks`.
- `pnpm playbook apply --from-plan <artifact>` consumes this contract.
- Task objects keep stable fields (`id`, `ruleId`, `file`, `action`, `autoFix`) for deterministic automation.

## JSON example

```json
{
  "schemaVersion": "1.0",
  "command": "plan",
  "ok": true,
  "exitCode": 0,
  "verify": {
    "ok": false,
    "summary": { "failures": 1, "warnings": 0 },
    "failures": [],
    "warnings": []
  },
  "remediation": {
    "status": "ready",
    "totalSteps": 1,
    "unresolvedFailures": 0
  },
  "tasks": [
    {
      "id": "<stable-task-id>",
      "ruleId": "requireNotesOnChanges",
      "file": "docs/PLAYBOOK_NOTES.md",
      "action": "append notes entry",
      "autoFix": true
    }
  ]
}
```
