# `playbook doctor`

## What it does
Checks local Playbook prerequisites and documentation/config health. Can also preview/apply safe deterministic fixes.

## Common usage
- `playbook doctor`
- `playbook doctor --ai`
- `playbook doctor --ai --json`
- `playbook doctor --fix --dry-run`
- `playbook doctor --fix --yes`
- `playbook doctor --json`

## Notable flags
- `--fix`: enable doctor fix planning/apply mode.
- `--dry-run`: preview fixes without writing changes.
- `--yes`: apply eligible safe fixes.
- `--json` / `--format json`: machine-readable output.


## AI mode contract readiness
`playbook doctor --ai` now validates AI contract readiness as a deterministic gate before future Playbook agent execution.

Checks include:
- AI contract availability (`.playbook/ai-contract.json` file-backed vs generated fallback).
- AI contract validity using shared engine validation.
- Referenced intelligence sources present/missing with required vs optional semantics.
- Required command/query surface availability.
- Remediation workflow readiness (`verify -> plan -> apply -> verify`).

A repository can be AI-capable while still not AI-contract ready when required contract surfaces are missing.

## JSON contract stability

`playbook doctor --json` is a stable machine-readable automation contract.

The output includes:

- top-level diagnosis status, summary, and findings
- `artifactHygiene.classification`
- `artifactHygiene.findings`
- `artifactHygiene.suggestions` (with deterministic IDs `PB012`, `PB013`, `PB014` when applicable)

Rule: `doctor --json` must remain a stable machine-readable contract for automation and repository health diagnostics.
