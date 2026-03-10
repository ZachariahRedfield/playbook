# `pnpm playbook contracts`

Emit a deterministic contract registry payload for schema targets, runtime artifacts, and roadmap status.

## Usage

```bash
pnpm playbook contracts --json
pnpm playbook contracts --out .playbook/contracts-registry.json
pnpm playbook contracts --json --out .playbook/contracts-registry.json
```

## Flags

- `--json`: print the machine-readable registry contract to stdout.
- `--out <path>`: write the same JSON payload to a file. Defaults to `.playbook/contracts-registry.json` when writing is enabled.

Behavior matrix:

- `--json` only: print JSON only (no artifact write).
- `--out <path>` only: write artifact only.
- `--json --out <path>`: print and write.

## Relationship to other commands

- `pnpm playbook schema`: use `pnpm playbook schema contracts --json` to validate the `contracts --json` response shape.
- `pnpm playbook doctor`: the registry gives downstream automation a deterministic map of expected artifacts.
- Roadmap contract validation: `contracts` includes roadmap availability plus a stable tracked feature-status subset when `docs/roadmap/ROADMAP.json` is present.

In consumer repositories where Playbook docs are missing, the command still succeeds and reports structured unavailable states rather than failing.
