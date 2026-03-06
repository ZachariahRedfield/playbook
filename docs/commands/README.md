# Playbook Command Status Index

This is the authoritative command-state snapshot for Playbook product docs.

## Product-facing command surface (current)

| Command / Artifact | Purpose | Status | Example |
| --- | --- | --- | --- |
| `analyze` | Analyze repository stack and architecture signals. | Current (implemented) | `playbook analyze --json` |
| `verify` | Run deterministic governance checks. | Current (implemented) | `playbook verify --ci` |
| `rules` | List loaded analyze/verify rules for humans and agents. | Current (implemented) | `playbook rules --json` |
| `doctor` | Report repository health and diagnostics, with optional safe fix mode. | Current (implemented) | `playbook doctor --fix --dry-run` |
| `diagram` | Generate deterministic architecture diagrams (Mermaid). | Current (implemented) | `playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` |
| `plan` | Generate deterministic remediation tasks from verify findings. | Current (implemented) | `playbook plan --json` |
| `apply` | Execute deterministic auto-fixable plan tasks. | Current (implemented) | `playbook apply --from-plan .playbook/plan.json` |
| `playbook-demo` (artifact) | Official onboarding repository, discoverable via `playbook demo`. | Current (artifact + CLI discovery) | `playbook demo` |
| `index` | Emit machine-readable repository index context for AI workflows. | Current (implemented) | `playbook index --json` |
| `query` | Query machine-readable repository intelligence fields from `.playbook/repo-index.json`. | Current (implemented) | `playbook query modules --json` |
| `ask` | Answer repository guidance questions from machine-readable repository intelligence context. | Current (implemented) | `playbook ask "where should a new feature live?" --json` |

## Additional implemented CLI utility commands

The CLI registry currently also exposes utility commands not treated as part of the product-facing command set above:

- `demo`
- `init`
- `fix`
- `status`
- `upgrade`
- `explain`
- `session`

Source of truth: `packages/cli/src/commands/index.ts`.

## Product-state anchoring rule

When command/workflow state changes, update these surfaces in the same change (or immediately after):

- `README.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/commands/README.md` and related command docs
- demo docs/contracts (`docs/ONBOARDING_DEMO.md`, `playbook demo` contract)
- `docs/CHANGELOG.md`

Pattern: **AI Anchor Drift**.

If docs and implementation disagree, treat implementation as source of truth and realign docs.
