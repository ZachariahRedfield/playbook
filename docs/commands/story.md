# `playbook story`

Manage the canonical repo-local story backlog artifact at `.playbook/stories.json` while keeping derived story candidates in the non-canonical `.playbook/story-candidates.json` artifact.

## Subcommands

- `playbook story list --json`
- `playbook story show <id> --json`
- `playbook story create --id <id> --title <title> --type <type> --source <source> --severity <severity> --priority <priority> --confidence <confidence> [--rationale <text>] [--acceptance <criterion>]... [--evidence <item>]... [--depends-on <story-id>]... [--execution-lane <lane>] [--suggested-route <route>] --json`
- `playbook story status <id> --status ready --json`
- `playbook story plan <id> --json`
- `playbook story candidates --json`
- `playbook story candidates --explain --json`
- `playbook story promote <candidate-id> --json`

Rule: Stories are the durable repo-scoped action unit and must remain structured first, narrative second.

Pattern: Backlog state is a canonical repo-local artifact, not a UI-owned construct.

Pattern: Findings need durable interpretation before they become backlog work.

Pattern: Candidate stories require grouping, dedupe, and explicit promotion.

Failure Mode: If story state is introduced without a canonical artifact and governed writes, backlog semantics fragment immediately.

Failure Mode: Raw finding -> automatic story conversion creates backlog spam and weak planning signal.
