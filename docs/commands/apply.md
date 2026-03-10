# `pnpm playbook apply`

Executes deterministic plan tasks from engine `verify -> plan` output.

Examples:

- `pnpm playbook apply`
- `pnpm playbook apply --help`
- `pnpm playbook apply --json`
- `pnpm playbook apply --from-plan .playbook/plan.json`
- `pnpm playbook apply --from-plan .playbook/plan.json --task <task-id>`
- `pnpm playbook apply --from-plan .playbook/plan.json --task <task-a> --task <task-b>`

Contract rules:

- Reads the canonical `plan.remediation` object and maps status explicitly:
  - `ready` → proceed with task execution.
  - `not_needed` → no verify failures require remediation; `apply` no-ops with explicit message and success exit code.
  - `unavailable` → fail clearly and deterministically before execution.

- `not_needed` does not guarantee that the paired plan artifact has zero tasks. Plans may still include advisory or hygiene tasks that are not required to resolve verify failures.

- Executes only tasks with `autoFix: true`.
- Marks non-auto-fix tasks as `skipped`.
- Marks missing handlers as `unsupported`.
- Reports handler failures as `failed`.
- Does not invent or guess fixes.

Serializable execution contract:

- `--from-plan` executes a previously exported `pnpm playbook plan --json` payload without recomputing intent.
- Plan payload must declare `schemaVersion: "1.0"` and `command: "plan"`.
- `--task` selection is exact and deterministic by stable `task.id` (no fuzzy matching by text/path/rule).
- Repeated `--task` ids are deduplicated deterministically, and selected tasks preserve original artifact order.
- Unknown `--task` ids fail clearly; invalid selection does not fall back to applying all tasks.
- Every task must include `id`, `ruleId`, `file`, `action`, `autoFix`.
- Handler contract is explicit: handlers must return `applied`, `skipped`, or `unsupported`; thrown errors are reported as `failed` and contract violations are treated as failures.
- `applied` handler results must include changed files and a non-empty summary; `skipped`/`unsupported` handler results must include a non-empty message.


## Workflow role
`apply` is the execution step in the canonical remediation loop: `verify -> plan -> apply -> verify`.

Use `--from-plan` when you need automation-safe execution from a reviewed artifact, so execution does not recompute intent at apply time.

Exact Task Selection pattern:

1. `pnpm playbook plan --json > .playbook/plan.json`
2. Review stable task ids in `.playbook/plan.json`
3. Apply only reviewed ids with `pnpm playbook apply --from-plan .playbook/plan.json --task <stable-task-id>`
4. Run `pnpm playbook verify` after apply to validate repository state

## JSON example
```bash
pnpm playbook apply --from-plan .playbook/plan.json --json
```

```json
{
  "schemaVersion": "1.0",
  "command": "apply",
  "ok": true,
  "exitCode": 0,
  "remediation": { "status": "ready", "totalSteps": 1, "unresolvedFailures": 0 },
  "message": "Plan remediation is ready. Applying available tasks.",
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
