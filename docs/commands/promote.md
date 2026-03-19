# `pnpm playbook promote`

Make promotion doctrine explicit at the lifecycle seam where inspectable candidates become canonical artifacts.

## What this command owns

`pnpm playbook promote` is the explicit top-level promotion surface for moving reviewed candidates into canonical artifacts when the source and target are already known.

Promotion is intentionally split across two storage scopes:

- **Repo-local story backlog** lives in each target repository's `.playbook/stories.json` and is the only story surface that may feed execution planning.
- **Global reusable pattern memory** lives in Playbook home under `.playbook/memory/knowledge/patterns.json` and represents cross-repo reusable doctrine.

Rule: One canonical command matrix per lifecycle seam.

Pattern: Prefer one explicit promotion surface over many near-synonyms.

Failure Mode: Promotion surface sprawl makes governance legible in code but confusing to operators.

## Canonical promotion matrix

| Command surface | Promotes from | Writes to | Scope | Status | When to use |
| --- | --- | --- | --- | --- | --- |
| `pnpm playbook story promote <candidate-id> --json` | `.playbook/story-candidates.json` in the current repo | `.playbook/stories.json` in the current repo | Repo-local story backlog | **Preferred** for repo-local story candidate review | You already generated repo story candidates and want to adopt one into the same repo backlog. |
| `pnpm playbook promote story repo/<repo-id>/story-candidates/<candidate-id> --json` | A repo-scoped story candidate ref | `.playbook/stories.json` in the referenced repo | Repo-local story backlog | **Preferred** top-level explicit promotion surface | You need one promotion command that works from Playbook home, Observer-style multi-repo context, or across repos. |
| `pnpm playbook promote story global/patterns/<pattern-id> --repo <repo-id> --json` | A promoted reusable pattern | `.playbook/stories.json` in the target repo | Global reusable pattern -> repo-local story backlog | **Preferred** for seeding backlog work from reusable doctrine | You want reusable doctrine to suggest bounded local adoption work without putting global memory directly into execution. |
| `pnpm playbook promote story global/pattern-candidates/<candidate-id> --repo <repo-id> --json` | A global pattern candidate | `.playbook/stories.json` in the target repo | Global candidate -> repo-local story backlog | **Supported legacy bridge** | Use only when an existing workflow still reviews global pattern candidates directly into a repo story. Prefer promoted global patterns or `patterns proposals promote` for new operator guidance. |
| `pnpm playbook patterns promote --id <pattern-id> --decision approve --json` | Repo/global pattern review queue artifacts | `.playbook/patterns-promoted.json` review state artifacts | Pattern review decision state | **Legacy review surface** | Use when operating the existing review queue. This records approve/reject review outcomes, but it is not the canonical cross-repo promotion seam for reusable doctrine. |
| `pnpm playbook patterns proposals promote --proposal <proposal-id> --target memory --json` | `.playbook/pattern-proposals.json` proposal bridge | `.playbook/memory/knowledge/patterns.json` | Global reusable pattern memory | **Preferred** for cross-repo reusable pattern promotion | You are promoting reviewed cross-repo portability proposals into reusable doctrine. |
| `pnpm playbook patterns proposals promote --proposal <proposal-id> --target story --repo <repo-id> --json` | `.playbook/pattern-proposals.json` proposal bridge | `.playbook/stories.json` in the target repo | Cross-repo proposal -> repo-local story backlog | **Preferred** for cross-repo adoption work | You want a reviewed cross-repo proposal to become bounded backlog work in one repo. |

## Preferred vs alias vs legacy doctrine

### Preferred surfaces

- `story promote` is the preferred in-repo promotion surface for **repo-local story candidates**.
- Top-level `promote story ...` is the preferred explicit promotion surface when the operator is crossing repos, promoting from Playbook home, or promoting from global pattern-backed sources.
- `patterns proposals promote` is the preferred cross-repo proposal promotion surface because it makes proposal review, target scope, and destination artifact explicit.

### Legacy / narrower surfaces

- `patterns promote` remains supported as an explicit review-decision surface for existing pattern review queue workflows.
- Treat `patterns promote` as a narrower legacy review surface, not as the preferred general promotion command for new doctrine or backlog guidance.
- `promote story global/pattern-candidates/...` remains supported, but it should be documented as a bridge for existing workflows rather than the preferred future-facing operator path.

### Alias status

There is no exact CLI alias where two commands are guaranteed to be identical in behavior and storage contract.

Instead, Playbook intentionally keeps multiple **promotion seams** with different source artifacts and scopes:

- `story promote` and `promote story repo/.../story-candidates/...` both end in repo-local story backlog promotion, but the first is an in-repo candidate workflow and the second is the explicit multi-repo/top-level surface.
- `patterns proposals promote --target story` and `promote story global/patterns/...` both can end in repo-local stories, but they start from different reviewed inputs (`pattern-proposals.json` vs promoted global pattern memory).

## Storage terminology

Use these terms consistently:

- **Repo-local story backlog**: canonical repo-specific planning state in `.playbook/stories.json`.
- **Story candidates**: non-canonical repo-local derivations in `.playbook/story-candidates.json`.
- **Global reusable pattern memory**: promoted cross-repo doctrine in `.playbook/memory/knowledge/patterns.json`.
- **Pattern proposals**: cross-repo promotion bridge artifacts in `.playbook/pattern-proposals.json`.
- **Pattern review state**: review queue / approval artifacts such as `.playbook/pattern-review-queue.json` and `.playbook/patterns-promoted.json` used by `patterns promote`.

Rule: Global knowledge may suggest local work, but only repo-local stories may enter execution planning.

## Command forms

```bash
pnpm playbook promote story repo/<repo-id>/story-candidates/<candidate-id> --json
pnpm playbook promote story global/patterns/<pattern-id> --repo <repo-id> --json
pnpm playbook promote pattern global/pattern-candidates/<candidate-id> --pattern-id <pattern-id> --json
```

Usage contract from the current CLI:

```text
playbook promote <story|pattern> <candidate-ref> [--repo <repo-id>] [--story-id <id>] [--pattern-id <id>] --json
```

Story refs currently supported by the CLI are:

- `repo/<repo-id>/story-candidates/<candidate-id>`
- `global/pattern-candidates/<candidate-id>`
- `global/patterns/<pattern-id>`

Pattern refs currently supported by the CLI are:

- `global/pattern-candidates/<candidate-id>`

## Promotion receipts

`pnpm playbook promote ... --json` writes `.playbook/promotion-receipts.json` in the mutated scope so promotion remains auditable through a deterministic receipt log.
