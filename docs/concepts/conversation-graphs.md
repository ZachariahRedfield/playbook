# Conversation Graphs for AI-Assisted Engineering

Playbook can ingest AI chat exports as deterministic `SessionSnapshot` JSON, then merge snapshots into a single canonical view with explicit conflict reporting.

## Agent-facing imports

`playbook session import` supports ChatGPT-style markdown/text exports and applies deterministic extraction rules only (no semantic guessing):

- Heading mode (preferred): parse bullet items under these headings:
  - `Decisions`
  - `Constraints`
  - `Open Questions`
  - `Artifacts`
  - `Next Steps`
- Fallback mode (if headings are absent): extract only
  - file paths / URLs
  - commands (`$ ...`, `pnpm ...`, `npm ...`, `npx ...`, `playbook ...`)
  - decision-like lines prefixed with `Decision:`, `We decided:`, `Final:`, `Chosen:`

Session snapshot IDs and decision IDs are hash-based and stable for equivalent input.

## Deterministic merge model

`playbook session merge` reads multiple snapshots and produces:

- merged canonical snapshot JSON
- deterministic conflict list
- optional markdown/json merge reports

Merge rules:

- exact-match dedupe uses normalized case-insensitive trimmed text
- decisions dedupe by normalized decision text + stable ID regeneration
- constraints/artifacts/tags are set-unioned + stably sorted
- when normalized decision keys match but details diverge, merge emits manual conflicts

Exit codes:

- `0`: merged cleanly (no conflicts)
- `2`: conflicts detected

## Retention & Cleanup Policy

Session artifacts under `.playbook/sessions/` are **ephemeral working data**, not permanent docs.

Policy:

1. Keep local snapshots only for bounded retention.
2. Defaults: keep snapshots within **30 days** and cap to **50 most recent** (whichever is smaller).
3. Durable knowledge must be promoted into real docs:
   - `docs/PLAYBOOK_NOTES.md`
   - `docs/ARCHITECTURE.md`
   - `docs/CHANGELOG.md`

Use `playbook session cleanup` regularly (or in CI/automation) to prevent long-term repository bloat.

## Example workflow

```bash
# 1) Import and store ephemeral snapshot
playbook session import --in exports/chat-a.md --name ci-thread --store

# 2) Import another session export
playbook session import --in exports/chat-b.md --name cli-thread --store

# 3) Merge snapshots into a canonical artifact + reports
playbook session merge \
  --in .playbook/sessions/ci-thread-<hash>.json \
  --in .playbook/sessions/cli-thread-<hash>.json \
  --out .playbook/sessions/merged.json \
  --report .playbook/sessions/merged-report.md \
  --json .playbook/sessions/merged-report.json

# 4) Preview cleanup actions
playbook session cleanup --dry-run

# 5) Apply cleanup with defaults (30 days / 50 files)
playbook session cleanup
```

## Hygiene guardrails

- `.playbook/sessions/` should remain gitignored by default.
- Keep this concept doc concise so policy and workflows stay actionable.
