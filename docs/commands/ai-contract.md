# `pnpm playbook ai-contract`

Print the repository AI interaction contract used by Playbook-aware tools.

## Usage

```bash
pnpm playbook ai-contract
pnpm playbook ai-contract --json
```

## Behavior

- Reads `.playbook/ai-contract.json` when present.
- Falls back to a deterministic generated contract when absent.
- JSON output includes:
  - `schemaVersion`
  - `command`
  - `source` (`file` or `generated`)
  - `contract` (the canonical AI contract payload)

## Related commands

- `pnpm playbook ai-context --json`
- `pnpm playbook context --json`
- `pnpm playbook schema ai-contract --json`
