# `pnpm playbook plan`

## What it does
Generates a deterministic remediation task list from verify failures.

## Common usage
- `pnpm playbook plan`
- `pnpm playbook plan --ci`
- `pnpm playbook plan --json`

## Contract notes
- JSON output includes `schemaVersion`, `command`, `verify`, `remediation`, and `tasks`.
- `pnpm playbook apply --from-plan <artifact>` consumes this JSON artifact as an execution contract.
- Task objects use stable fields: `id`, `ruleId`, `file`, `action`, `autoFix`.
- `id` is deterministic for equivalent findings and safe to persist for later execution.
- Findings are sorted before task generation to keep task order deterministic.
- `remediation` is a canonical status object for automation:
  - `ready`: remediation tasks are available and safe for `apply` to execute.
  - `not_needed`: no verify failures are present; `apply` should no-op with an explicit message.
  - `unavailable`: verify failures exist but no remediation tasks are available; `apply` should fail clearly and deterministically.

`not_needed` is based on verify failure count. Plan output can still include advisory or hygiene tasks that are useful but not required to remediate verify failures.


## Workflow role
`plan` is the intent-generation step in the canonical remediation loop: `verify -> plan -> apply -> verify`.

In automation contexts, prefer `pnpm playbook plan --json` so the output can be reviewed and then executed via `pnpm playbook apply --from-plan <artifact>`.

## JSON example
```bash
pnpm playbook plan --json
```

```json
{
  "schemaVersion": "1.0",
  "command": "plan",
  "ok": true,
  "exitCode": 0,
  "verify": { "ok": false, "summary": { "failures": 1, "warnings": 0 }, "failures": [], "warnings": [] },
  "remediation": { "status": "ready", "totalSteps": 1, "unresolvedFailures": 0 },
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
