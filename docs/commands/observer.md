# `playbook observer repo`

Manage a deterministic local observer registry of connected repositories.

## Usage

```bash
pnpm playbook observer repo add <path>
pnpm playbook observer repo list --json
pnpm playbook observer repo remove <id>
```

## Registry artifact

The command maintains:

- `.playbook/observer/repos.json`

Contract:

- `schemaVersion: "1.0"`
- `kind: "repo-registry"`
- `repos[]` entries include stable `id`, `name`, absolute `root`, `status`, `artifactsRoot`, and deterministic `tags`.

## Determinism and scope

- Deterministic ordering is enforced by `id`.
- Duplicate `id` and duplicate `root` values are rejected.
- This is a local/private-first observer index only.
- Canonical runtime artifacts remain per repository under each repo's `.playbook/` root.

Rule: Multi-repo observation must begin from an explicit deterministic registry, not implicit path scanning.
