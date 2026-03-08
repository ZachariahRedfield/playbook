# Command Contracts (v1 Baseline)

This document defines the v1 deterministic contract set for mandatory commands:

- `index`
- `query`
- `explain`
- `ask`
- `plan`
- `apply`
- `analyze-pr`

## Envelope contract

For JSON outputs, commands must emit deterministic objects with:

- `command`: command name
- `ok` (where applicable)
- `schemaVersion` when output is contract-bound
- stable sorting for repeated lists (`findings`, `nextActions`, nodes/edges)

## Command-specific contract requirements

| Command | Required contract behavior |
| --- | --- |
| `index` | Writes `.playbook/repo-index.json` and `.playbook/repo-graph.json` with explicit schema versions and deterministic ordering. |
| `query` | Fails deterministically with actionable guidance when repo index is missing. |
| `explain` | Emits deterministic target classification (`rule`, `module`, `architecture`) and structured explanation payload. |
| `ask` | Preserves deterministic source reporting and validated repo-context hydration from trusted artifacts. |
| `plan` | Derives remediation status only from `verify` failures (not warnings). |
| `apply` | Enforces repository boundary checks and refuses unsafe or out-of-plan task execution. |
| `analyze-pr` | Produces deterministic text/json/github-comment/github-review contracts from the same diff model. |

## CI enforcement hooks

- `node scripts/validate-roadmap-contract.mjs --ci`
- `node packages/cli/dist/main.js docs audit --json`
- `node packages/cli/dist/main.js verify --json`

## Change policy

Any PR changing command JSON fields must update:

1. relevant schema contract outputs,
2. snapshot tests,
3. this command contract document.
