# Report Docs Merge (Archived 2026)

Archived in 2026.
Retained for historical/reference purposes.
Not an active source of product truth.

## Canonical successors

- [../commands/docs.md](../commands/docs.md)
- [../roadmap/README.md](../roadmap/README.md)
- [./REPORT_DOCS_MERGE_2026.md](./REPORT_DOCS_MERGE_2026.md)

---

# Scope Note

This report is a historical documentation-cleanup artifact.
It should not be used as roadmap or backlog planning input.
Planning sources are:
- `docs/PLAYBOOK_IMPROVEMENTS.md` for ideas
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md` for committed direction

# Docs Merge Report

- Mode: APPLY
- Prune: disabled
- Files scanned: 40
- Duplicate headings: 7
- Duplicate blocks: 5

## Files Scanned

- `docs/AI_AGENT_CONTEXT.md`
- `docs/ARCHITECTURE_DIAGRAMS.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/concepts/conversation-graphs.md`
- `docs/concepts/docs-merge.md`
- `docs/concepts/governance-model.md`
- `docs/concepts/what-is-playbook.md`
- `docs/CONCEPTS/knowledge-pipeline.md`
- `docs/CONCEPTS/plugins-and-adapters.md`
- `docs/CONCEPTS/policy-model.md`
- `docs/config/playbook-config.md`
- `docs/contributing.md`
- `docs/decisions/0001-package-manager-pnpm.md`
- `docs/DEVELOPMENT.md`
- `docs/DIAGRAMS.md`
- `docs/EXAMPLES.md`
- `docs/FAQ.md`
- `docs/GITHUB_SETUP.md`
- `docs/GITHUB_TOPICS.md`
- `docs/index.md`
- `docs/OVERVIEW.md`
- `docs/PLAYBOOK_AGENT_GUIDE.md`
- `docs/PLAYBOOK_CONTRIBUTION_MODEL.md`
- `docs/PLAYBOOK_DEV_WORKFLOW.md`
- `docs/PLAYBOOK_ENGINE_SPEC.md`
- `docs/PLAYBOOK_NOTES.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md`
- `docs/PRODUCT_VISION.md`
- `docs/PROJECT_GOVERNANCE.md`
- `docs/REFERENCE/cli.md`
- `docs/REFERENCE/config.md`
- `docs/REFERENCE/exit-codes.md`
- `docs/RELEASING.md`
- `docs/ROADMAP.md`
- `docs/rules/verify-rules.md`
- `docs/UPDATE_ROADMAP_DOCS.md`
- `docs/USE_CASES.md`
- `docs/WHY_PLAYBOOK.md`

## Duplicate Headings

### `pnpm playbook doctor`
- Canonical: `docs/REFERENCE/cli.md:23`
- Duplicates:
  - `docs/REFERENCE/exit-codes.md:17` -> add canonical heading pointer

### Contributing
- Canonical: `docs/contributing.md:1`
- Duplicates:
  - `docs/index.md:18` -> add canonical heading pointer

### Decision
- Canonical: `docs/CONCEPTS/policy-model.md:23`
- Duplicates:
  - `docs/decisions/0001-package-manager-pnpm.md:6` -> add canonical heading pointer

### PHASE 1 — FOUNDATION
- Canonical: `docs/PLAYBOOK_AGENT_GUIDE.md:106`
- Duplicates:
  - `docs/PLAYBOOK_DEV_WORKFLOW.md:78` -> add canonical heading pointer

### Prerequisites
- Canonical: `docs/contributing.md:3`
- Duplicates:
  - `docs/DEVELOPMENT.md:3` -> add canonical heading pointer

### Structure
- Canonical: `docs/ARCHITECTURE_DIAGRAMS.md:3`
- Duplicates:
  - `docs/config/playbook-config.md:5` -> add canonical heading pointer

### Usage
- Canonical: `docs/concepts/docs-merge.md:13`
- Duplicates:
  - `docs/DIAGRAMS.md:25` -> add canonical heading pointer


## Duplicate Blocks

### Block 1
- Canonical: `docs/EXAMPLES.md:27`
- Fingerprint: `Framework: Next.js
Database: Supabase
Styling: Tailwind`
- Duplicates:
  - `docs/PLAYBOOK_CONTRIBUTION_MODEL.md:147` -> append see-also pointer next to duplicate block
  - `docs/PLAYBOOK_ENGINE_SPEC.md:111` -> append see-also pointer next to duplicate block
  - `docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md:130` -> append see-also pointer next to duplicate block

### Block 2
- Canonical: `docs/PLAYBOOK_AGENT_GUIDE.md:108`
- Fingerprint: `- [x] CLI scaffold
- [x] repository templates
- [x] requireNotesOnChange`…
- Duplicates:
  - `docs/PLAYBOOK_DEV_WORKFLOW.md:80` -> append see-also pointer next to duplicate block

### Block 3
- Canonical: `docs/PLAYBOOK_AGENT_GUIDE.md:172`
- Fingerprint: `export interface PlaybookRule {
  id: string
  run(context: VerifyContex`…
- Duplicates:
  - `docs/PLAYBOOK_CONTRIBUTION_MODEL.md:104` -> append see-also pointer next to duplicate block
  - `docs/PLAYBOOK_DEV_WORKFLOW.md:188` -> append see-also pointer next to duplicate block

### Block 4
- Canonical: `docs/PLAYBOOK_AGENT_GUIDE.md:219`
- Fingerprint: `{
  "ok": false,
  "failures": [
    {
      "rule": "requireNotesOnChan`…
- Duplicates:
  - `docs/PLAYBOOK_ENGINE_SPEC.md:226` -> append see-also pointer next to duplicate block
  - `docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md:182` -> append see-also pointer next to duplicate block

### Block 5
- Canonical: `docs/PLAYBOOK_CONTRIBUTION_MODEL.md:188`
- Fingerprint: `docs/ARCHITECTURE.md
docs/PROJECT_GOVERNANCE.md
docs/PLAYBOOK_NOTES.md
d`…
- Duplicates:
  - `docs/PLAYBOOK_DEV_WORKFLOW.md:227` -> append see-also pointer next to duplicate block
  - `docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md:241` -> append see-also pointer next to duplicate block

## Proposed Actions

- Add canonical heading links for repeated headings in non-canonical files.
- Add see-also pointers for exact duplicate blocks.
- Keep all content (SAFE mode default): no duplicate content removals.
