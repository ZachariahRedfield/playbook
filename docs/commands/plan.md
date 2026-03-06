# `playbook plan`

## What it does
Generates a deterministic remediation task list from verify failures.

## Common usage
- `playbook plan`
- `playbook plan --ci`
- `playbook plan --json`

## Contract notes
- JSON output includes `schemaVersion`, `command`, `verify`, and `tasks`.
- `playbook apply --from-plan <artifact>` consumes this JSON artifact as an execution contract.
- Task objects use stable fields: `id`, `ruleId`, `file`, `action`, `autoFix`.
- `id` is deterministic for equivalent findings and safe to persist for later execution.
- Findings are sorted before task generation to keep task order deterministic.

## Workflow role
`plan` is the intent-generation step in the canonical remediation loop: `verify -> plan -> apply -> verify`.

In automation contexts, prefer `playbook plan --json` so the output can be reviewed and then executed via `playbook apply --from-plan <artifact>`.

## JSON example
```bash
playbook plan --json
```

```json
{
  "schemaVersion": "1.0",
  "command": "plan",
  "ok": true,
  "exitCode": 0,
  "verify": { "ok": false, "summary": { "failures": 1, "warnings": 0 }, "failures": [], "warnings": [] },
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
