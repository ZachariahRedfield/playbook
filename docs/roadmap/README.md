# Roadmap Contracts

This directory contains machine-readable roadmap artifacts used by CI and AI automation.

## Canonical files

- `ROADMAP.json`: deterministic roadmap contract entries.
- `IMPROVEMENTS_BACKLOG.md`: idea and enhancement staging backlog.

## Rule

Every delivery change should map to at least one `feature_id` from `ROADMAP.json`.

Each roadmap feature entry must include:

- `feature_id`
- `version`
- `title`
- `goal`
- `commands`
- `contracts`
- `tests`
- `docs`
- `dependencies`
- `package_ownership`
- `verification_commands`
- `status`


## CI modes

- `node scripts/validate-roadmap-contract.mjs --ci`: validates roadmap contract structure.
- `node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id`: additionally requires PR title/body to reference a roadmap `feature_id`.

Planned CLI mirror command surface: `playbook roadmap verify` (backed by the same roadmap-contract validator).
