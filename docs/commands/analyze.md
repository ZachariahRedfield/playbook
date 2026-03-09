# `playbook analyze`

## What it does
Analyzes the current repository and reports stack/governance recommendations.

`analyze` is a compatibility-friendly and lightweight signal command. For the canonical serious-user flow, start with `ai-context`/`ai-contract`/`context`, then `index` + repository intelligence commands, followed by `verify -> plan -> apply -> verify`.

## Common usage
- `playbook analyze`
- `playbook analyze --ci`
- `playbook analyze --json`
- `playbook analyze --explain`

## Notable flags
- `--ci`: CI-friendly output.
- `--json` / `--format json`: machine-readable output.
- `--quiet`: suppress success output in text mode.
- `--explain`: include rationale and remediation context.
