# `playbook story`

Manage the canonical repo-local story backlog artifact at `.playbook/stories.json` while keeping derived story candidates in the non-canonical `.playbook/story-candidates.json` artifact. Use `story` for repo-local backlog work; use [`promote`](promote.md) when you need the top-level explicit promotion surface across repos or from global pattern-backed sources.

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
Rule: Story lifecycle transitions must be driven by linked execution artifacts, not UI-only state.

Pattern: Backlog state is a canonical repo-local artifact, not a UI-owned construct.
Pattern: Story is durable intent; plan is execution shape; receipt is observed outcome.

Pattern: Findings need durable interpretation before they become backlog work.

Pattern: Candidate stories require grouping, dedupe, and explicit promotion.

Failure Mode: If story state is introduced without a canonical artifact and governed writes, backlog semantics fragment immediately.
Failure Mode: Story status edited independently of receipt/updated-state creates split-brain backlog truth.

Failure Mode: Raw finding -> automatic story conversion creates backlog spam and weak planning signal.


## Promotion seam

For repo-local story candidates, `pnpm playbook story promote <candidate-id> --json` is the preferred in-repo promotion command.

If you need to promote into a repo backlog from Playbook home, another repo, or a global pattern-backed source, use [`pnpm playbook promote story ...`](promote.md) instead.

Storage terms:

- **Repo-local story backlog**: `.playbook/stories.json`
- **Story candidates**: `.playbook/story-candidates.json`

Rule: Repo-local stories are the only backlog surface that may feed execution planning.
