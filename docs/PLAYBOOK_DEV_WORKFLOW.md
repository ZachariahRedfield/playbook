PLAYBOOK DEVELOPMENT WORKFLOW
Purpose

This document defines the standard workflow for developing Playbook.

It ensures that:

development remains consistent

governance is applied to the Playbook project itself

contributors understand the expected process

Playbook should use its own governance philosophy internally.

Development Philosophy

Playbook development follows these principles:

Deterministic changes

Every change should be:

intentional

documented

traceable

No “mystery changes.”

Documentation-driven development

Major changes should update:

docs/PLAYBOOK_PRODUCT_ROADMAP.md
docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md
docs/PLAYBOOK_ENGINE_SPEC.md

Documentation is treated as a first-class artifact.

Small, incremental improvements

Changes should be:

focused

minimal

easy to review

Large refactors should be split into multiple pull requests.

Roadmap Alignment

Before implementing new features:

Review the roadmap:

docs/PLAYBOOK_PRODUCT_ROADMAP.md

Identify the relevant roadmap phase.

Example:

Phase 1 — Foundation
Phase 2 — Repository Intelligence
Phase 3 — Governance Engine

Confirm the proposed change aligns with the roadmap.

Roadmap Updates

When features are implemented, the roadmap must be updated.

Example:

### PHASE 1 — FOUNDATION
<!-- docs-merge:canonical-heading -->
> **Docs merge note:** Canonical section lives at [PHASE 1 — FOUNDATION](PLAYBOOK_AGENT_GUIDE.md#phase-1-foundation).


- [x] CLI scaffold
- [x] repository templates
- [x] requireNotesOnChanges rule
- [ ] demo repository

<!-- docs-merge:duplicate-block -->
> See also canonical block: [docs/PLAYBOOK_AGENT_GUIDE.md:108](PLAYBOOK_AGENT_GUIDE.md#block-108).

This keeps progress visible.

Development Loop

Typical development workflow:

Implement change
     ↓
Run tests
     ↓
Run smoke test
     ↓
Update roadmap/docs
     ↓
Open pull request
Local Development Setup

Clone the repository:

git clone https://github.com/<org>/playbook
cd playbook

Install dependencies:

pnpm install

Build packages:

pnpm build
Running Tests

Run the test suite:

pnpm test

Tests should pass before opening a pull request.

Smoke Testing

Playbook includes a smoke test script.

Run:

node scripts/smoke-test.mjs

The smoke test validates that:

CLI commands work

templates generate correctly

verify rule behaves as expected

Working on the CLI

CLI code lives in:

packages/cli

Responsibilities:

command parsing

user interface

scaffolding templates

invoking the engine

The CLI should not contain governance logic.

Working on the Engine

Engine code lives in:

packages/engine

Responsibilities:

repository analysis

rule execution

governance validation

reporting

The engine must remain:

deterministic

modular

testable

Adding New Rules

Rules are implemented in:

packages/engine/src/verify/rules/

Each rule must implement:

export interface PlaybookRule {
  id: string
  run(context: VerifyContext): VerifyResult[]
}

<!-- docs-merge:duplicate-block -->
> See also canonical block: [docs/PLAYBOOK_AGENT_GUIDE.md:172](PLAYBOOK_AGENT_GUIDE.md#block-172).

Rules must:

be deterministic

avoid heavy computation

produce clear error messages

Adding Repository Detectors

Repository detectors live in:

packages/engine/src/analyze/detectors/

Detectors help Playbook understand project structure.

Example detectors:

nextjs
supabase
tailwind
prisma
express

Detectors should rely on filesystem signals, not heavy parsing.

Updating Templates

Templates used by playbook init live in:

templates/repo/

Baseline scaffold outputs include:

docs/PLAYBOOK_NOTES.md
playbook.config.json (legacy) or .playbook/config.json (modern)

Additional repository docs (for example `docs/PROJECT_GOVERNANCE.md`, `docs/ARCHITECTURE.md`, and `docs/PLAYBOOK_CHECKLIST.md`) are optional and can be managed per repository policy.

<!-- docs-merge:duplicate-block -->
> See also canonical block: [docs/PLAYBOOK_CONTRIBUTION_MODEL.md:188](PLAYBOOK_CONTRIBUTION_MODEL.md#block-188).

Template changes must prioritize:

clarity

simplicity

developer usability

Pull Request Guidelines

Pull requests should include:

clear description

reasoning behind the change

documentation updates if applicable

PRs should remain small and focused.

Playbook Notes for Playbook Itself

Major decisions about Playbook should be recorded in:

docs/PLAYBOOK_NOTES.md

Example:

## 2026-03-05

WHAT changed:
Introduced plugin architecture for governance rules.

WHY it changed:
Allow organizations to extend Playbook without modifying core engine.

Evidence:
packages/engine/src/plugins/

This ensures Playbook follows its own governance model.

Release Workflow

Releases follow semantic versioning.

Example:

v0.1.0
v0.2.0
v1.0.0

Typical release steps:

merge feature PRs
update CHANGELOG.md
create release tag
publish release
Continuous Integration

Playbook CI should validate:

build
tests
verify behavior

CI must run:

playbook verify

to ensure governance rules behave correctly.

Future Development Tools

Future developer tools may include:

playbook dev
playbook rule test
playbook analyzer debug

These commands would help contributors build new rules and detectors.

Long-Term Goal

The Playbook development workflow should make it easy for developers to:

propose governance rules

improve architecture analysis

contribute to the ecosystem

Playbook aims to become a community-driven governance platform.
