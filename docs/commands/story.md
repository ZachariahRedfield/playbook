# `playbook story`

Manage the canonical repo-local story backlog artifact at `.playbook/stories.json`.

## Subcommands

- `playbook story list --json`
- `playbook story show <id> --json`
- `playbook story create --id <id> --title <title> --type <type> --source <source> --severity <severity> --priority <priority> --confidence <confidence> [--rationale <text>] [--acceptance <criterion>]... [--evidence <item>]... [--depends-on <story-id>]... [--execution-lane <lane>] [--suggested-route <route>] --json`
- `playbook story status <id> --status ready --json`

Rule: Stories are the durable repo-scoped action unit and must remain structured first, narrative second.

Pattern: Backlog state is a canonical repo-local artifact, not a UI-owned construct.

Failure Mode: If story state is introduced without a canonical artifact and governed writes, backlog semantics fragment immediately.
