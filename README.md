# Playbook

AI-aware engineering governance for modern repositories.

[![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg)](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml) ![Version](https://img.shields.io/badge/version-v0.1.0-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-green) ![Node](https://img.shields.io/badge/node-%3E%3D22-339933)

## What Playbook Does

Playbook analyzes a repository and enforces engineering governance such as architecture contracts, documentation discipline, and AI-agent guardrails.

Core commands:

- `playbook init`
- `playbook analyze`
- `playbook verify`

## Quick Start

```bash
npx playbook init
npx playbook analyze
npx playbook verify
```

- `playbook init` scaffolds governance docs and configuration in your repository.
- `playbook analyze` detects repository stack signals and produces architecture guidance.
- `playbook verify` runs deterministic governance checks for CI and local development.

## Example Output

```text
$ npx playbook analyze
Detected Stack

Framework: Next.js
Database: Supabase
Styling: Tailwind
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

## Roadmap

See [`docs/PLAYBOOK_PRODUCT_ROADMAP.md`](docs/PLAYBOOK_PRODUCT_ROADMAP.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, workflow, and contribution expectations.
