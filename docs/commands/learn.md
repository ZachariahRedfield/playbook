# `pnpm playbook learn`

Generate report-only learning outputs from diffs and merged-change summaries without auto-promoting doctrine into source-of-truth docs.

## Subcommands

### `learn draft`

Draft deterministic knowledge candidates from local git diff context plus indexed repository intelligence.

### `learn doctrine`

Extract reusable post-merge doctrine from a merged change summary, PR summary, or fixture input.

Default behavior is report-only:

- no repo mutation
- no automatic promotion into docs or knowledge stores
- output focuses on what was learned, what should be documented next, and what future verification checks could be automated

## Examples

```bash
pnpm playbook learn draft --json --out .playbook/knowledge/candidates.json
pnpm playbook learn doctrine --input tests/contracts/fixtures/doctrine-extraction-summary.json --json
pnpm playbook learn doctrine --summary "artifact governance / staged promotion hardened the workflow-promotion contract" --json
```

## Doctrine extraction output

`learn doctrine --json` emits a deterministic report-only payload containing:

- concise change summary
- Rule candidates
- Pattern candidates
- Failure Mode candidates
- suggested notes/docs updates
- candidate future automated verification checks

## Governance note

- Pattern: Post-merge learning should extract reusable doctrine from real code changes.
- Failure Mode: Valuable engineering doctrine remains trapped in conversations and PR context unless extracted into reusable system knowledge.
