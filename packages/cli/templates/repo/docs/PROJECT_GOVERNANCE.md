# Project Governance

This repository uses Playbook for lightweight, deterministic change governance.

## `.playbook` tracked vs runtime boundary

Playbook keeps the `.playbook/` folder deterministic by default:

- Track canonical governance artifacts in git:
  - `.playbook/managed-surfaces.json`
  - `.playbook/repo-index.json`
  - `.playbook/repo-graph.json`
  - `.playbook/plan.json`
  - `.playbook/policy-apply-result.json`
  - `.playbook/version-policy.json` (when release governance is scaffolded)
- Ignore runtime/generated churn (for example `.playbook/runtime/**`, `.playbook/memory/**`, `.playbook/context/**`, `.playbook/session.json`, and related generated state).

This split keeps reviewed governance state stable while preventing local runtime noise from polluting commits.

## Why Playbook requires notes updates

When code changes without context, teams lose the engineering reasoning behind implementation decisions.
Playbook requires `docs/PLAYBOOK_NOTES.md` updates so each meaningful change records both WHAT changed and WHY.

## Verify rule (v0.1.0)

If code paths change (`src/**`, `app/**`, `server/**`, `supabase/**`), update `docs/PLAYBOOK_NOTES.md` in the same change.

## Quick fix for CI failures

If CI fails with `requireNotesOnChanges`:

1. Open `docs/PLAYBOOK_NOTES.md`.
2. Add or update an entry describing WHAT changed and WHY.
3. Link evidence (PR, issue, or commit) to aid future traceability.
4. Commit the notes update with your code change.
