# Playbook

AI-aware engineering governance for modern repositories.

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg) ![Version](https://img.shields.io/badge/version-v0.1.0-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-green) ![Node](https://img.shields.io/badge/node-%3E%3D22-339933)

## Keywords

Playbook is related to:

- AI engineering governance
- repository analysis
- developer tooling
- AI coding agent guardrails
- engineering architecture contracts
- documentation governance
- CLI developer tools

## What Playbook Does

Playbook analyzes a repository and enforces engineering governance such as architecture contracts, documentation discipline, and AI-agent guardrails.

Core commands:

- `playbook init`
- `playbook analyze`
- `playbook verify`

## Why Playbook Exists

Modern repositories are complex and often lack enforceable engineering governance.

Playbook introduces machine-readable governance rules so both humans and AI coding agents can safely modify large codebases without architectural drift.

## Quick Start

```bash
npx playbook init
npx playbook analyze
npx playbook verify
```

- `playbook init` scaffolds governance docs and configuration in your repository.
- `playbook analyze` detects repository stack signals and produces architecture guidance.
- `playbook verify` runs deterministic governance checks for CI and local development.

## Development

Install:

```bash
pnpm install
```

Lint:

```bash
pnpm lint
```

Build:

```bash
pnpm -r build
```

Test:

```bash
pnpm -r test
```

Smoke (recommended):

```bash
pnpm smoke
```

## CI

- CI runs the Playbook composite action at `.github/actions/playbook-ci`.
- CI runs: install → lint → build → test → smoke.
- CI is strict: missing CLI dist output fails smoke checks, and install must pass with a frozen lockfile.
- If `pnpm install` fails due to proxy/network runner constraints, reproduce locally or fix runner networking rather than weakening CI guarantees.

### Reusable verify action

Use the published Playbook CLI from this repository as a reusable action in any repo:

```yaml
name: Playbook Verify

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: <OWNER>/playbook/actions/verify@v0.1.0
        with:
          playbook_version: latest
          node_version: "22"
          args: --ci
```

## Example Output

```text
$ npx playbook analyze
Playbook Analyze
Repo: /repo
Signals: 2 stack signal(s): Next.js, Supabase

Recommendations (3)
[RECOMMEND] Run governance verification  (id: analyze-run-verify)
  Why: Analyze surfaces signals while verify enforces deterministic governance rules.
  Fix: Run `playbook verify` before opening a pull request.

[INFO] Next.js detected  (id: analyze-detected-nextjs)
  Why: Next.js detection helps tailor architecture-aware guidance.
  Fix: Review generated architecture suggestions and keep docs aligned with implementation.
  Files: package.json

[INFO] Supabase detected  (id: analyze-detected-supabase)
  Why: Supabase detection helps tailor architecture-aware guidance.
  Fix: Review generated architecture suggestions and keep docs aligned with implementation.
  Files: package.json

Next: Run `playbook verify` before opening a pull request.
```

Flags:
- `--json` outputs stable machine-readable JSON (`ok`, `signals`, `recommendations[]`).
- `--ci` emits low-noise CI output and exits non-zero when WARN recommendations exist.

```text
$ npx playbook analyze --ci
playbook analyze: PASS  (warns=0 recommends=1 info=2)
[RECOMMEND] Run governance verification  (id: analyze-run-verify)
  Why: Analyze surfaces signals while verify enforces deterministic governance rules.
  Fix: Run `playbook verify` before opening a pull request.
```

```text
$ npx playbook verify
PASS  requireNotesOnChanges
All governance checks passed.
```

## How It Works

Playbook treats repository governance as machine-readable contracts. Rules are explicit, deterministic, and designed to run locally, offline, and in CI.

## Project Structure

- `/packages` — monorepo packages for the Playbook CLI and governance engine.
- `/docs` — product, architecture, governance, and contributor documentation.
- `/scripts` — development and maintenance scripts for this repository.
- `/Playbook` — generated governance workspace in repositories initialized with Playbook templates.

## Additional Docs

- [`docs/USE_CASES.md`](docs/USE_CASES.md)
- [`docs/EXAMPLES.md`](docs/EXAMPLES.md)
- [`docs/FAQ.md`](docs/FAQ.md)
- [`docs/GITHUB_TOPICS.md`](docs/GITHUB_TOPICS.md)
- [`docs/GITHUB_SETUP.md`](docs/GITHUB_SETUP.md)

## Roadmap

See [`docs/PLAYBOOK_PRODUCT_ROADMAP.md`](docs/PLAYBOOK_PRODUCT_ROADMAP.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, workflow, and contribution expectations.
