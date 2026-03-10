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
  "modules": ["..."]
}
```

