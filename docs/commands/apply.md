# `playbook apply`

Executes deterministic plan tasks from engine `verify -> plan` output.

Examples:

- `playbook apply`
- `playbook apply --json`
- `playbook apply --from-plan .playbook/plan.json`

Contract rules:

- Executes only tasks with `autoFix: true`.
- Marks non-auto-fix tasks as `skipped`.
- Marks missing handlers as `unsupported`.
- Reports handler failures as `failed`.
- Does not invent or guess fixes.

Serializable execution contract:

- `--from-plan` executes a previously exported `playbook plan --json` payload without recomputing intent.
- Plan payload must declare `schemaVersion: "1.0"` and `command: "plan"`.
- Every task must include `id`, `ruleId`, `file`, `action`, `autoFix`.
- Handler contract is explicit: handlers must return `applied`, `skipped`, or `unsupported`; thrown errors are reported as `failed` and contract violations are treated as failures.
- `applied` handler results must include changed files and a non-empty summary; `skipped`/`unsupported` handler results must include a non-empty message.


## Workflow role
`apply` is the execution step in the canonical remediation loop: `verify -> plan -> apply -> verify`.

Use `--from-plan` when you need automation-safe execution from a reviewed artifact, so execution does not recompute intent at apply time.

## JSON example
```bash
playbook apply --from-plan .playbook/plan.json --json
```

```json
{
  "schemaVersion": "1.0",
  "command": "apply",
  "ok": true,
  "exitCode": 0,
  "results": [
    {
      "id": "<stable-task-id>",
      "ruleId": "requireNotesOnChanges",
      "file": "docs/PLAYBOOK_NOTES.md",
      "action": "append notes entry",
      "autoFix": true,
      "status": "applied"
    }
  ],
  "summary": {
    "applied": 1,
    "skipped": 0,
    "unsupported": 0,
    "failed": 0
  }
}
```
