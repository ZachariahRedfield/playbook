PLAYBOOK CONTRIBUTION MODEL
Purpose

This document defines how Playbook evolves as an open-source governance platform.

It explains:

how contributors participate

how governance rules are proposed

how engineering doctrine evolves

how Playbook maintains quality and trust

Playbook is not just a CLI tool.
It is intended to become a community-driven governance system for AI-assisted software development.

Core Philosophy

Playbook development follows three principles.

1. Deterministic Governance

Rules must be:

explicit

predictable

reproducible

Playbook should never enforce behavior that developers cannot understand.

A developer should always know:

why a rule failed

how to fix it

where the rule is defined

2. Governance Over Style

Playbook does not replace linters or formatters.

Those tools already exist:

ESLint

Prettier

Stylelint

Playbook focuses on engineering governance, such as:

architecture boundaries

knowledge capture

documentation discipline

design decisions

3. Knowledge Capture

Playbook treats engineering knowledge as a first-class artifact.

Every meaningful change should produce knowledge.

Example pipeline:

Code Change
     ↓
Playbook Notes
     ↓
Proposed Doctrine
     ↓
Promoted Engineering Knowledge
Types of Contributions

Playbook accepts several categories of contributions.

1. Rule Contributions

Rules define governance policies enforced by:

playbook verify

Rules live in:

packages/engine/src/verify/rules/

Example rules:

requireNotesOnChanges (implemented)
forbidLayerCrossing (planned)
requireArchitectureDocs (planned)

Each rule implements the Playbook rule interface.

Example:

export interface PlaybookRule {
  id: string
  run(context: VerifyContext): VerifyResult[]
}

Rules should be:

deterministic

well documented

easy to understand

fast to execute

2. Repository Analyzers

Analyzers help Playbook understand project structure.

Location:

packages/engine/src/analyze/detectors/

Example detectors:

nextjs
supabase
tailwind
express
prisma

Analyzer responsibilities:

detect frameworks

detect database usage

detect architecture patterns

Output example:

Detected Stack

Framework: Next.js
Database: Supabase
Styling: Tailwind

Analyzers should never modify code directly.

They may suggest architecture updates using markers like:

<!-- PLAYBOOK:ANALYZE_SUGGESTIONS -->
3. Documentation Contributions

Documentation is a core part of Playbook.

Important docs include:

docs/PLAYBOOK_PRODUCT_ROADMAP.md
docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md
docs/PLAYBOOK_CONTRIBUTION_MODEL.md

Contributors may improve:

architecture explanations

governance patterns

rule documentation

onboarding guides

4. Template Improvements

Repository templates are created using:

playbook init

Templates live in:

templates/repo/

Generated files include:

docs/ARCHITECTURE.md
docs/PROJECT_GOVERNANCE.md
docs/PLAYBOOK_NOTES.md
docs/PLAYBOOK_CHECKLIST.md

Template improvements should prioritize:

clarity

minimalism

developer usability

Doctrine System

Playbook evolves through a doctrine system.

Doctrine represents accumulated engineering knowledge.

Step 1 — Notes

Developers record knowledge in:

docs/PLAYBOOK_NOTES.md

Example entry:

## 2026-03-04

WHAT changed:
Moved authentication logic to server layer.

WHY it changed:
Prevent UI layer from accessing database directly.

Evidence:
src/server/auth.ts
Step 2 — Proposed Doctrine

If the same pattern appears multiple times, it may become a proposed doctrine.

Example:

Server loaders should shape view models.
Step 3 — Promoted Doctrine

After validation, proposed doctrine becomes an official Playbook rule or guideline.

Example:

Rule candidate: forbidLayerCrossing
Contribution Workflow

Typical workflow for contributors.

Fork repository
     ↓
Create branch
     ↓
Implement change
     ↓
Run tests
     ↓
Open pull request

Pull requests should include:

clear description

reasoning behind the change

tests if applicable

documentation updates if needed

Rule Acceptance Criteria

New rules should satisfy these conditions:

deterministic

broadly useful

easy to configure

low false-positive rate

Rules that enforce organization-specific policy should instead be implemented as plugins.

Plugin Ecosystem (Future)

Playbook will eventually support plugins.

Example:

playbook plugins install company-security-rules

Plugins may provide:

custom governance rules

organization policies

specialized architecture constraints

Decision Making

Major architectural decisions should be recorded using:

docs/PLAYBOOK_NOTES.md

This ensures that Playbook development itself follows its own governance model.

Community Expectations

Playbook aims to maintain a welcoming open-source environment.

Contributors should:

respect other developers

provide constructive feedback

focus on improving developer experience

Long-Term Vision

Playbook aims to become the governance layer for AI-assisted development.

Equivalent ecosystem role:

Git → version control
CI → builds
Sentry → runtime errors
Playbook → architecture governance
