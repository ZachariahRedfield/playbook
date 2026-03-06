# Playbook

AI-aware engineering governance for modern repositories.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) [![Playbook Diagrams Check](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml/badge.svg)](https://github.com/ZachariahRedfield/playbook/actions/workflows/playbook-diagrams-check.yml) ![Version](https://img.shields.io/badge/version-v0.1.1-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

Playbook is a governance CLI for repositories that keeps checks deterministic for both humans and AI agents. It helps teams inspect current policy status, understand active rules, and apply safe fixes with confidence.

## Quickstart

```bash
npx playbook status
npx playbook rules
npx playbook explain <ruleId>
# optional:
npx playbook fix --yes
npx playbook upgrade
npx playbook --help
```

## How to discover capabilities

The CLI help output is the authoritative source for supported commands and flags.

- Use `playbook rules` to list available rules.
- Use `playbook explain <id>` to see what a rule checks and how to remediate findings.

## Trust and community

- [CHANGELOG.md](CHANGELOG.md)
- [docs/RELEASING.md](docs/RELEASING.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
