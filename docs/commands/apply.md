# `playbook apply`

Executes deterministic plan tasks from engine `verify -> plan` output.

Examples:

- `playbook apply`
- `playbook apply --json`

Contract rules:

- Executes only tasks with `autoFix: true`.
- Marks non-auto-fix tasks as `skipped`.
- Marks missing handlers as `unsupported`.
- Reports handler failures as `failed`.
- Does not invent or guess fixes.
