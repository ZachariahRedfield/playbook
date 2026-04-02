# `pnpm playbook ai-context`

Print deterministic AI bootstrap context for Playbook-aware tooling.

## Usage

```bash
pnpm playbook ai-context
pnpm playbook ai-context --json
```

## Behavior

- Reports repository summary, architecture classification, and local CLI preference.
- Reports repository-intelligence artifact availability (`.playbook/repo-index.json`).
- Includes control-plane artifact pointers and read-only consumed runtime manifest context from `.playbook/runtime-manifests.json`.
- Prints the preferred operating ladder and remediation workflow guidance.
- Includes a curated `productCommands` list for bootstrap/canonical command discovery.
- Includes memory guidance fields that describe preferred memory command surfaces.

## JSON output

`pnpm playbook ai-context --json` returns:

- `schemaVersion`
- `command`
- `repo`
- `repositoryIntelligence`
- `controlPlaneArtifacts`
- `runtimeManifests`
- `operatingLadder`
- `productCommands`
- `guidance`

## Related commands

- `pnpm playbook ai-contract --json`
- `pnpm playbook context --json`
