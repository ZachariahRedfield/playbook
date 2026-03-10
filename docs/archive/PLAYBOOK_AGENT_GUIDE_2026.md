# Playbook Agent Guide (Archived 2026)

Archived in 2026.
Retained for historical/reference purposes.
Not an active source of product truth.

## Canonical successors

- [../../AGENTS.md](../../AGENTS.md)
- [../ARCHITECTURE.md](../ARCHITECTURE.md)
- [../commands/README.md](../commands/README.md)
- [../SECURITY_PRINCIPLES.md](../SECURITY_PRINCIPLES.md)

---

PLAYBOOK AGENT GUIDE
Purpose

This document defines how AI coding agents should interact with the Playbook repository.

Agents include:

ChatGPT

Codex

Copilot

other autonomous development tools

The goal is to ensure AI-generated changes remain:

aligned with the Playbook roadmap

consistent with architecture

properly documented

Agent Operating Principles

AI agents must follow these rules when working in the Playbook repository.

1. Always reference the product roadmap

Before proposing or implementing features, agents must review:

docs/PLAYBOOK_PRODUCT_ROADMAP.md

The roadmap defines:

development phases

current priorities

long-term direction

Agents should align work with the current roadmap phase.

2. Respect the system architecture

Agents must follow the architecture defined in:

docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md

Key architectural constraints:

CLI
 ↓
Engine
 ↓
Rules

Rules:

CLI contains no governance logic

Engine contains core functionality

Rules implement policy checks

Agents should not introduce architecture that violates this structure.

3. Follow the engine specification

All engine-related changes must comply with:

docs/PLAYBOOK_ENGINE_SPEC.md

Important rules:

rules must be deterministic

rules must not modify files

rules must execute quickly

rules must produce structured output

Agents should avoid introducing complex behavior that slows verification.

4. Maintain documentation alignment

Whenever agents implement meaningful changes, they should update relevant documentation.

Potential updates include:

docs/PLAYBOOK_PRODUCT_ROADMAP.md
docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md
docs/PLAYBOOK_ENGINE_SPEC.md
docs/PLAYBOOK_CONTRIBUTION_MODEL.md
docs/PLAYBOOK_DEV_WORKFLOW.md

Documentation should evolve alongside code.

5. Update roadmap progress

When implementing roadmap milestones, agents should update progress indicators.

Example:

### PHASE 1 — FOUNDATION

- [x] CLI scaffold
- [x] repository templates
- [x] requireNotesOnChanges rule
- [ ] demo repository

This ensures the roadmap remains accurate.

Preferred Development Process

Agents should follow this process when making changes.

Review roadmap
     ↓
Review architecture
     ↓
Propose implementation plan
     ↓
Implement code changes
     ↓
Update documentation
     ↓
Update roadmap progress

Agents should avoid implementing large changes without first outlining a plan.

Code Organization Rules

Agents should respect the repository structure.

packages/
  cli/
  engine/

templates/
docs/
scripts/

Guidelines:

CLI logic lives in:

packages/cli

Engine logic lives in:

packages/engine

Rules live in:

packages/engine/src/verify/rules

Analyzers live in:

packages/engine/src/analyze/detectors
Rule Implementation Guidelines

When implementing new rules:

Place the rule inside:

packages/engine/src/verify/rules/

Implement the rule interface:

export interface PlaybookRule {
  id: string
  run(context: VerifyContext): VerifyResult[]
}

Ensure the rule:

is deterministic

executes quickly

produces helpful error messages

Analyzer Implementation Guidelines

When implementing repository detectors:

Location:

packages/engine/src/analyze/detectors/

Analyzers should detect:

frameworks

database usage

folder conventions

Analyzers should rely on:

filesystem signals
config files
dependency manifests

Avoid heavy parsing when possible.

JSON Output Requirements

All Playbook commands should support machine-readable output.

Example:

pnpm playbook verify --json

Example response:

{
  "ok": false,
  "failures": [
    {
      "rule": "requireNotesOnChanges",
      "file": "src/foo.ts",
      "message": "Notes update required"
    }
  ]
}

Agents should preserve compatibility with JSON outputs.

Performance Expectations

Playbook must remain fast.

Target execution time:

pnpm playbook verify < 1 second

Agents should avoid:

large dependency graph parsing
heavy AST analysis
slow filesystem scans
Future Features Agents Should Support

Agents may assist in implementing roadmap features such as:

Repository intelligence
pnpm playbook analyze

Detect project stack automatically.

Governance rule system
pnpm playbook verify

Enforce architecture constraints.

Knowledge extraction
pnpm playbook learn

Extract engineering doctrine from repository history.

Plugin ecosystem
pnpm playbook plugins install <plugin>

Allow organizations to extend governance rules.

Agent Safety Rules

Agents must never introduce code that:

executes arbitrary remote code
sends repository data externally
modifies files during verification

Playbook verification must remain safe and deterministic.

Long-Term Vision

Playbook aims to become:

The governance layer for AI-assisted software development.

Agents should prioritize changes that support this vision.
