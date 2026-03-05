# Playbook

AI-aware engineering governance for modern repositories.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) ![Version](https://img.shields.io/badge/version-v0.1.0-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

Playbook is a governance product that is **language-agnostic, agent-agnostic, and platform-agnostic**.

Today, the shipped CLI is implemented in Node.js.

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

## How it works

```text
Developer intent -> AI agent -> Playbook verify -> PR/CI gate -> merge
```

Playbook turns governance into explicit, machine-readable checks so humans and AI agents can collaborate without silent architectural drift.

## Quickstart (contributors)

```bash
corepack enable
pnpm install
pnpm -r build
pnpm -r test
```

CLI runtime note: **Node >= 22 (for current CLI implementation).**

## Try it now

The npm `playbook` package may not be available in all environments yet.

Use a local contributor run path from this repository:

```bash
pnpm --filter playbook build
node packages/cli/dist/main.js analyze
```

## Development checks

```bash
pnpm lint
pnpm -r build
pnpm -r test
pnpm smoke
```

## Documentation spine

### Vision
- [Product Vision](docs/PRODUCT_VISION.md)

### Concepts
- [Policy model](docs/CONCEPTS/policy-model.md)
- [Knowledge pipeline](docs/CONCEPTS/knowledge-pipeline.md)
- [Plugins and adapters](docs/CONCEPTS/plugins-and-adapters.md)

### Reference
- [CLI reference](docs/REFERENCE/cli.md)
- [Config reference](docs/REFERENCE/config.md)
- [Exit codes](docs/REFERENCE/exit-codes.md)

### Roadmap
- [Roadmap overview](docs/ROADMAP.md)
- [Full product roadmap](docs/PLAYBOOK_PRODUCT_ROADMAP.md)

## Trust and community

- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
