# `pnpm playbook schema`

Expose JSON Schema contracts for Playbook CLI JSON outputs so tooling can validate response shape.

## Usage

```bash
pnpm playbook schema
pnpm playbook schema rules
pnpm playbook schema explain
pnpm playbook schema verify
pnpm playbook schema context
pnpm playbook schema ai-context
```

## Supported schema targets

- `rules`
- `explain`
- `index`
- `verify`
- `plan`
- `context`
- `ai-context`

This command is designed for CI pipelines, demo repositories, and AI agents that treat Playbook as a structured interface.
