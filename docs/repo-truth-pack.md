# Repo Truth Pack Standard (Subapps)

## Objective
Create a lightweight, committed source-of-truth surface for subapps that Playbook can ingest without duplicating generated `.playbook/*` runtime artifacts.

## Why this exists
- **Rule:** Important project truth must live in the repo, not only in chat.
- **Pattern:** Lightweight structured context beats scattered undocumented state.
- **Failure Mode:** Chat-only context creates drift, loss of continuity, and weak retrieval.

## Standard truth-pack layout
Each subapp should commit a minimal truth pack rooted at the subapp directory.

```text
<subapp-root>/
  playbook/context.json
  docs/architecture.md
  docs/roadmap.md
  docs/adr/
  playbook/app-integration.json   # required when integrated
```

## `playbook/context.json` required fields
The validator requires these fields:
- `repo_id`
- `repo_name`
- `mission`
- `current_phase`
- `current_focus`
- `invariants`
- `dependencies`
- `integration_surfaces`
- `next_milestones`
- `open_questions`
- `last_verified_timestamp`

## Update cadence
Refresh the truth pack whenever one of these happens:
- milestone boundary
- architecture change
- phase change
- new integration surface

## Validation
`pnpm playbook docs audit --json` now validates subapp truth packs under:
- `subapps/*`
- `examples/subapps/*`

Validation includes:
- required files and `docs/adr/` directory presence
- required context fields in `playbook/context.json`
- JSON validity for optional `playbook/app-integration.json` when present

## Templates and example
- Template: `templates/repo/subapps/_truth-pack-template/`
- Example: `subapps/proving-ground-app/`
