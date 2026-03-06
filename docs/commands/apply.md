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
- Handler results must explicitly report changed files and a non-empty summary; vague handler responses fail the task.
