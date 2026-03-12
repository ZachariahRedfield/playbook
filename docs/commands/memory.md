# `pnpm playbook memory`

Manage replay, promotion, and pruning for repository memory artifacts.

## Subcommands

### `memory replay`

Replay episodic repository memory from `.playbook/memory/index.json` and referenced event files into deterministic candidate knowledge artifacts.

### `memory promote --from-candidate <id>`

Promote a reviewed replay candidate into local semantic memory artifacts:

- `.playbook/memory/knowledge/decisions.json`
- `.playbook/memory/knowledge/patterns.json`
- `.playbook/memory/knowledge/failure-modes.json`
- `.playbook/memory/knowledge/invariants.json`

Promotion preserves provenance and writes `supersedes` / `supersededBy` links when fingerprint-equivalent active knowledge already exists.

### `memory prune`

Prune memory artifacts without mutating governance doctrine files (rules/docs/contracts):

- prune stale candidates (expiration by `lastSeenAt`)
- remove superseded knowledge entries
- collapse duplicates by fingerprint

## Guarantees

- Pattern: **Fast Episodic Store, Slow Doctrine Store**.
- Pattern: **Replay Before Promotion**.
- Pattern: **Human-Reviewed Knowledge Promotion**.
- Rule: **Retrieval Must Return Provenance**.
- Rule: **Working Memory Is Not Doctrine**.
- Failure Mode: **Memory Hoarding**.
- Failure Mode: **Premature Canonicalization**.

Promotion into local semantic memory artifacts is not automatic mutation of committed governance docs/rules.

## Examples

```bash
pnpm playbook memory replay --json
pnpm playbook memory promote --from-candidate 9fd4a8be8c3f7d10 --json
pnpm playbook memory prune --json
```
