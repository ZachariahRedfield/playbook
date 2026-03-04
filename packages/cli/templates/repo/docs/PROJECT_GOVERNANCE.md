# Project Governance

This repository uses Playbook for lightweight, deterministic change governance.

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
