# Project Governance

## CI Guarantees

- Corepack is disabled in CI, and pnpm is provisioned via `pnpm/action-setup`.
- Dependency install is deterministic: `pnpm install --frozen-lockfile` is required.
- Every pull request runs build, tests, and smoke checks via the Playbook CI composite action.

## Verify / Notes on Changes

- `requireNotesOnChanges` enforces that relevant code changes are paired with an update to `docs/PLAYBOOK_NOTES.md`.
- Diff-base selection prefers `origin/main` when available.
- Otherwise, verify uses `merge-base(main, HEAD)`.
- If `merge-base(main, HEAD) == HEAD`, verify falls back to `HEAD~1` to avoid empty diffs after commits on `main`.
- If verify fails, add a clear WHAT/WHY entry to `docs/PLAYBOOK_NOTES.md`, then rerun:

```bash
pnpm smoke
```
