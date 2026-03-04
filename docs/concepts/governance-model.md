# Governance model

Playbook uses a simple knowledge pipeline:

Code changes  
↓  
Playbook notes  
↓  
Promoted doctrine (future)

In v0.1.0, this means code changes should be accompanied by updates to `docs/PLAYBOOK_NOTES.md` so project knowledge remains current.

## Example Playbook note entry

```md
## 2026-01-15

- WHAT changed: Refactored authentication token parsing into `server/auth/token.ts`.
- WHY it changed: Reduced duplicate validation logic and fixed inconsistent expiry handling.
- Evidence (PR/issue/commit): PR #42
```
