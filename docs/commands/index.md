# `pnpm playbook index`

Generate deterministic repository intelligence and write it to `.playbook/repo-index.json`.

## Usage

- `pnpm playbook index`
- `pnpm playbook index --json`

## Behavior

`pnpm playbook index` performs lightweight heuristic detection for:

- framework
- language
- architecture
- top-level `src` modules
- dependency graph edges (workspace manifests, root manifest, and source imports)
- workspace topology for `packages/*` relationships
- module test presence mapping
- config surface (eslint, tsconfig, jest, vitest, command inventory)
- database technology
- loaded Playbook rule ids

The command always overwrites `.playbook/repo-index.json` with the latest deterministic index payload.

## JSON contract

```json
{
  "command": "index",
  "ok": true,
  "indexFile": ".playbook/repo-index.json",
  "framework": "...",
  "architecture": "...",
  "modules": ["..."],
  "dependencies": [{ "from": "...", "to": "...", "type": "..." }],
  "workspace": [{ "name": "...", "path": "...", "role": "...", "dependsOn": [] }],
  "tests": [{ "module": "...", "tests_present": true, "coverage_estimate": "unknown" }],
  "configs": [{ "name": "tsconfig", "path": "tsconfig.json", "present": true }]
}
```

