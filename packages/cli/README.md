# Playbook CLI package

Playbook is a deterministic repository runtime and trust layer for human+AI delivery workflows.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) ![Version](https://img.shields.io/badge/version-v0.1.1-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

This package provides the `playbook` CLI. It is not a general-purpose chat assistant; it executes deterministic repository commands with machine-readable outputs.

## Canonical serious-user quickstart

```bash
pnpm playbook ai-context --json
pnpm playbook ai-contract --json
pnpm playbook context --json
pnpm playbook verify --json
pnpm playbook plan --json
pnpm playbook apply --from-plan .playbook/plan.json
pnpm playbook verify --ci --json
```

Repository-intelligence commands (`index`, `query`, `explain`, `ask --repo-context`) are part of the same canonical ladder between context bootstrap and remediation.

`analyze` remains available as a lightweight compatibility entrypoint, but it is not the primary serious-user governance flow.

For full command inventory and command contracts, use:
- Root repo README: [`README.md`](../../README.md)
- Command docs: [`docs/commands/README.md`](../../docs/commands/README.md)

## Local branch-accurate execution

```bash
pnpm -C packages/cli build
pnpm playbook ai-context --json
pnpm playbook verify --json
```

## Offline/limited-registry tgz test

```bash
pnpm run pack:cli
pnpm playbook verify --json
```

## GitHub Action

Use the published verify action directly from this repository:

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ZachariahRedfield/playbook/actions/verify@v0.1.1
        with:
          playbook_version: "0.1.1"
          args: "--ci"
          node_version: "22"
```

## Quickstart (contributors)

```bash
corepack enable
pnpm install
pnpm -r build
pnpm -r test
```

## Development checks

```bash
pnpm lint
pnpm -r build
pnpm -r test
pnpm smoke
```
