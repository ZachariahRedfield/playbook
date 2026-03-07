# Playbook Command Status Index

This is the authoritative command-state snapshot for Playbook product docs.

## Product-facing command surface (current)

The following section is generated from shared CLI command metadata.
Do not hand-edit entries inside the managed markers.

<!-- PLAYBOOK:DOCS_COMMAND_STATUS_START -->

| Command / Artifact | Purpose | Status | Example |
| --- | --- | --- | --- |
| `analyze` | Analyze project stack | Current (implemented) | `playbook analyze --json` |
| `verify` | Verify governance rules | Current (implemented) | `playbook verify --ci --json` |
| `plan` | Generate a structured fix plan from rule findings | Current (implemented) | `playbook plan --json` |
| `apply` | Execute deterministic auto-fixable plan tasks | Current (implemented) | `playbook apply --from-plan .playbook/plan.json` |
| `doctor` | Repository health entry point for architecture, governance, and issues | Current (implemented) | `playbook doctor --fix --dry-run` |
| `diagram` | Generate deterministic architecture Mermaid diagrams | Current (implemented) | `playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` |
| `rules` | List loaded verify and analyze rules | Current (implemented) | `playbook rules --json` |
| `schema` | Print JSON Schemas for Playbook CLI command outputs | Current (implemented) | `playbook schema verify --json` |
| `context` | Print deterministic CLI and architecture context for tools and agents | Current (implemented) | `playbook context --json` |
| `ai-context` | Print deterministic AI bootstrap context for Playbook-aware agents | Current (implemented) | `playbook ai-context --json` |
| `ai-contract` | Print deterministic AI repository contract for Playbook-aware agents | Current (implemented) | `playbook ai-contract --json` |
| `index` | Generate machine-readable repository intelligence index | Current (implemented) | `playbook index --json` |
| `query` | Query machine-readable repository intelligence from .playbook/repo-index.json | Current (implemented) | `playbook query modules --json` |
| `deps` | Print module dependency graph from .playbook/repo-index.json | Current (implemented) | `playbook deps workouts --json` |
| `ask` | Answer repository questions from machine-readable intelligence context | Current (implemented) | `playbook ask "where should a new feature live?" --json` |
| `explain` | Explain rules, modules, or architecture from repository intelligence | Current (implemented) | `playbook explain architecture --json` |
<!-- PLAYBOOK:DOCS_COMMAND_STATUS_END -->

## Additional implemented CLI utility commands

The CLI registry currently also exposes utility commands not treated as part of the product-facing command set above:

<!-- PLAYBOOK:DOCS_UTILITY_COMMANDS_START -->

- `demo`
- `init`
- `fix`
- `status`
- `upgrade`
- `session`
<!-- PLAYBOOK:DOCS_UTILITY_COMMANDS_END -->

Source of truth: shared command metadata in `packages/cli/src/lib/commandMetadata.ts`.

## Product-state anchoring rule

When command/workflow state changes, update these surfaces in the same change (or immediately after):

- `README.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/commands/README.md` and related command docs
- demo docs/contracts (`docs/ONBOARDING_DEMO.md`, `playbook demo` contract)
- `docs/CHANGELOG.md`

Pattern: **AI Anchor Drift**.

If docs and implementation disagree, treat implementation as source of truth and realign docs.
