# `playbook schema`

Expose JSON Schema contracts for Playbook CLI JSON outputs so tooling can validate response shape.

## Usage

```bash
playbook schema
playbook schema rules
playbook schema explain
playbook schema verify
```

## Supported schema targets

- `rules`
- `explain`
- `index`
- `verify`
- `plan`

This command is designed for CI pipelines, demo repositories, and AI agents that treat Playbook as a structured interface.
