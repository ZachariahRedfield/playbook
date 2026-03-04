# Playbook — AI Governance for Software Engineering

![CI](https://github.com/ZachariahRedfield/playbook/actions/workflows/ci.yml/badge.svg)

Playbook is a lightweight governance layer that helps teams keep AI-assisted software work aligned with real engineering standards.

## Intro

Playbook's core flow is:

**AI → Playbook → Repository**

Playbook sits between AI-generated changes and your codebase, ensuring work:

- follows architecture expectations
- captures engineering knowledge as changes happen
- keeps documentation synchronized with the code that actually shipped

## What Playbook Does (v0.1.0)

Playbook currently provides four commands:

- `playbook init` — scaffolds Playbook docs, config, and workflow templates into a repository.
- `playbook analyze` — inspects repository signals and appends architecture suggestions to `docs/ARCHITECTURE.md`.
- `playbook verify` — runs deterministic governance rules against git diff changes.
- `playbook doctor` — validates local setup and reports configuration issues.

## Example CI Failure Output

```text
✖ Verification failed
Base: origin/main

[requireNotesOnChanges] Code changes require a notes update.
Evidence: src/foo.ts
Fix: Update docs/PLAYBOOK_NOTES.md with a note describing WHAT changed and WHY.
```

## Usage

### Using Playbook in another repo

```bash
npx playbook init
npx playbook analyze
npx playbook verify
```

> npm package publishing is coming soon. For now, run Playbook from this monorepo during development.

### Developing Playbook (this repo)

```bash
pnpm install
pnpm build
pnpm test
node scripts/smoke-test.mjs
```

## Roadmap

- **v0.2**
  - architecture boundary rules
- **v0.3**
  - smarter repo analysis
- **Future**
  - organization-level governance

## GitHub Topics

Suggested repository topics:

- `ai`
- `devtools`
- `governance`
- `ci`
- `architecture`
- `documentation`
