# `pnpm playbook contracts`

Emit a deterministic contracts registry for artifact/document/schema surfaces.

## Usage

```bash
pnpm playbook contracts
pnpm playbook contracts --json
pnpm playbook contracts --out .playbook/contracts-registry.json
pnpm playbook contracts --json --out .playbook/contracts-registry.json
```

## Flags

- `--json`: print machine-readable registry JSON to stdout.
- `--out <path>`: write registry JSON to a file.

## Write behavior

- Default output path is `.playbook/contracts-registry.json` when writing.
- `--json` only: prints JSON and does not write by default.
- `--out <path>` only: writes artifact and prints text confirmation.
- `--json --out <path>`: prints JSON and writes artifact.

## Output shape

Registry output includes:

- base contracts registry payload from engine
- `schemas.memoryArtifacts` registrations
- `schemas.commandOutputs` registrations for additive command-output contracts

Use `pnpm playbook schema contracts --json` to validate output shape.

## Replay / consolidation contracts

The registry now includes explicit temporal-memory substrate contracts for:

- `.playbook/memory/replay-candidates.json`
- `.playbook/memory/consolidation-candidates.json`
- `.playbook/memory/replay-candidates.json#replayEvidence`

These artifacts stay candidate-only, preserve provenance end-to-end, and do not imply promotion.
