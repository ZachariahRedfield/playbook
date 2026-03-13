# Contract Registry (v1)

`pnpm playbook contracts` emits a deterministic, machine-readable registry that allows humans, CI, and agents to discover command schema surfaces, runtime artifact defaults, and tracked roadmap contract status from a single stable output.

## Contract scope

- Command: `pnpm playbook contracts --json`
- Schema version: `1.0`
- JSON Schema target: `pnpm playbook schema contracts --json`
- Default artifact path when written: `.playbook/contracts-registry.json`

## Payload shape

Top-level object fields:

- `schemaVersion`: fixed `"1.0"`
- `command`: fixed `"contracts"`
- `cliSchemas`:
  - `draft`: fixed `"2020-12"`
  - `schemaCommand`: fixed `"pnpm playbook schema --json"`
  - `commands`: deterministic list of CLI schema targets discoverable via `schema`
- `artifacts`:
  - `runtimeDefaults`: deterministic runtime artifact contract defaults and producers
  - `contracts`: deterministic list of selected docs contract files with structured availability
- `roadmap`:
  - `path`: fixed `docs/roadmap/ROADMAP.json`
  - `availability`: structured availability state
  - `schemaVersion`: roadmap schema version when available, otherwise `null`
  - `trackedFeatures`: deterministic subset of tracked roadmap features (`featureId`, `status`)


## Schema registrations

The `schemas.commandOutputs` array includes additive command-output schema registrations. Current file-backed entries include:

- `packages/contracts/src/knowledge.schema.json`
- `packages/contracts/src/pattern-graph.schema.json`

## Determinism guarantees

The contract registry is deterministic by design.

- No timestamps are emitted by the `contracts` command itself.
- No absolute paths are emitted.
- No environment-volatile fields are emitted.
- Arrays are stably ordered before emission.
- Tracked roadmap features are sorted by `featureId`.

## Availability semantics

Optional sections degrade to structured availability states instead of failing in consumer repos or partial repos.

Availability object variants:

- Available:
  - `{ "available": true }`
- Unavailable:
  - `{ "available": false, "reason": "missing" | "not_applicable" | "parse_error" | "not_initialized" }`

Current usage:

- Contract document entries under `artifacts.contracts[*].availability`
- Roadmap availability under `roadmap.availability`

## Versioning and compatibility policy

- The registry follows additive compatibility expectations for `schemaVersion: "1.0"`.
- Breaking output changes require a schema version bump.
- New optional fields may be added in a backward-compatible manner.
- Contract changes must update:
  - `packages/engine/src/schema/cliSchemas.ts`
  - contract snapshots under `tests/contracts/`
  - this document and command documentation.
