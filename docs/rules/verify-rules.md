# Verify rules

## `requireNotesOnChanges`

This rule enforces that when application code paths change, `docs/PLAYBOOK_NOTES.md` must be updated in the same change.

Code paths checked by default:

- `src/**`
- `app/**`
- `server/**`
- `supabase/**`

## Example failure output

```text
✖ Verification failed
Base: origin/main

[requireNotesOnChanges] Code changes require a notes update.
Evidence: src/foo.ts
Fix: Update docs/PLAYBOOK_NOTES.md with a note describing WHAT changed and WHY.
```
