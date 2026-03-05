# Playbook

AI-aware engineering governance for modern repositories.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) ![Version](https://img.shields.io/badge/version-v0.1.1-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

Playbook is a governance product that is **language-agnostic, agent-agnostic, and platform-agnostic**.

## What Playbook does

Playbook analyzes a repository and enforces deterministic governance checks, including:

- architecture and stack signal analysis,
- documentation discipline,
- CI-friendly policy verification.

Current CLI commands:

- `playbook init`
- `playbook analyze`
- `playbook verify`
- `playbook doctor`
- `playbook diagram`

## 30-second demo

```bash
npx --yes @fawxzzy/playbook analyze
npx --yes @fawxzzy/playbook verify --ci
```

Local dev fallback:

```bash
pnpm --filter @fawxzzy/playbook build
node packages/cli/dist/main.js analyze
```

Offline/limited-registry tgz test (self-contained CLI bundle):

```bash
pnpm run pack:cli
npx --yes ./packages/cli/fawxzzy-playbook-<version>.tgz analyze
```

## How it works

```text
Developer intent -> AI agent -> Playbook verify -> PR/CI gate -> merge
```

Playbook turns governance into explicit, machine-readable checks so humans and AI agents can collaborate without silent architectural drift.

## Installation

CLI: Node.js >= 22 (for now).

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

## Trust and community

- [CHANGELOG.md](CHANGELOG.md)
- [docs/RELEASING.md](docs/RELEASING.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
