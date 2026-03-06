# Playbook

AI-aware engineering governance for modern repositories.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) [![Playbook Diagrams Check](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml/badge.svg)](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml) ![Version](https://img.shields.io/badge/version-v0.1.1-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

Playbook is a governance CLI for repositories that keeps checks deterministic for both humans and AI agents. It helps teams inspect current policy status, understand active rules, and apply safe fixes with confidence.

## Try Playbook in 30 seconds

The fastest way to experience Playbook is the demo repository.

git clone https://github.com/ZachariahRedfield/playbook-demo
cd playbook-demo

npm install
npx playbook verify

## Canonical remediation workflow

Playbook's canonical remediation loop is:

`verify -> plan -> apply -> verify`

- `verify` detects deterministic policy findings.
- `plan` generates a reviewable remediation artifact (including JSON output for automation).
- `apply` executes deterministic auto-fixable tasks from a fresh plan or a serialized plan artifact.
- the final `verify` confirms the repository returns to policy-compliant state.

`fix` remains available as a convenience direct-remediation path (for example `--dry-run`, `--yes`, `--only`) when you want a single-command local workflow instead of explicit plan/apply steps.

## Quickstart

```bash
npx playbook status
npx playbook rules
npx playbook explain <ruleId>
# canonical remediation flow:
npx playbook verify
npx playbook plan --json > .playbook/plan.json
# optional review/edit gate on .playbook/plan.json
npx playbook apply --from-plan .playbook/plan.json
npx playbook verify
# optional convenience path:
npx playbook fix --yes
# other commands:
npx playbook plan
npx playbook apply
npx playbook upgrade
npx playbook --help
```

## How to discover capabilities

The CLI help output is the authoritative source for supported commands and flags.

- Use `playbook rules` to list available rules.
- Use `playbook explain <id>` to see what a rule checks and how to remediate findings.

## Init Scaffold Contract

Running:

```bash
npx playbook init
```

guarantees the following baseline project artifacts:

- Playbook configuration (`playbook.config.json` or `.playbook/config.json`)
- `docs/PLAYBOOK_NOTES.md`

Other documentation such as `docs/PROJECT_GOVERNANCE.md` may be present depending on repository governance policies, but it is not required by the default scaffold.

## Trust and community

- [CHANGELOG.md](CHANGELOG.md)
- [docs/RELEASING.md](docs/RELEASING.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
