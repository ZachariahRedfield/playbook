Playbook System Architecture
Purpose

Define the technical architecture of Playbook so that:

development remains consistent

the system scales cleanly

future contributors understand the design

Playbook is structured around three core layers.

CLI
 ↓
Engine
 ↓
Rules

Optional services (cloud, dashboards, integrations) must always build on top of this core.

Architecture Principles
CLI First

The CLI is the primary interface.

Playbook must always function:

locally

offline

in CI

Cloud services must be optional.

Example usage:

playbook init
playbook analyze
playbook verify
Deterministic Governance

Playbook rules must produce predictable outcomes.

Rules should avoid:

probabilistic AI decisions

non-deterministic enforcement

Instead rules operate on:

file paths

imports

repository structure

configuration

Separation of Concerns

The system is split into two main packages.

packages/
  cli
  engine
CLI

Responsibilities:

command parsing

terminal output

file scaffolding

invoking the engine

The CLI must contain no business logic.

Engine

The engine is the core of Playbook.

Responsibilities:

repository analysis

rule execution

governance validation

structured reporting

The engine must be usable by:

CLI

CI systems

IDE extensions

cloud services

Core Modules
Repository Analyzer

Location:

engine/analyze/

Purpose:

Detect repository structure automatically.

Example detectors:

nextjs
supabase
tailwind
prisma
express

Output example:

Detected Stack

Framework: Next.js
Database: Supabase
Styling: Tailwind

Analyzer may generate suggestions for:

docs/ARCHITECTURE.md
Governance Engine

Location:

engine/verify/

Responsible for running governance rules.

Command:

playbook verify

Runs all configured rules.

Rule System

Rules are modular; the current engine ships with a built-in rule set, and plugin loading is planned for a future phase.

Structure:

engine/verify/rules/

Example rules:

requireNotesOnChanges (implemented)
forbidLayerCrossing (planned)
requireArchitectureDocs (planned)
requireADR (planned)

Each rule implements:

interface PlaybookRule {
  id: string
  run(context: VerifyContext): VerifyResult[]
}
Reporting System

Every command must support machine-readable output.

Example:

playbook verify --json

Output:

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

This enables:

CI integration

dashboards

GitHub bots

IDE extensions

Configuration System

Configuration file:

playbook.config.json

Example structure:

{
  "version": 1,
  "rules": {
    "requireNotesOnChanges": {
      "enabled": true,
      "paths": ["src/**", "server/**"]
    }
  }
}

Configuration must remain:

human-readable

deterministic

versioned

Template System

Templates live in:

templates/repo

Used by:

playbook init

Generated files include:

docs/ARCHITECTURE.md
docs/PROJECT_GOVERNANCE.md
docs/PLAYBOOK_NOTES.md
docs/PLAYBOOK_CHECKLIST.md

Templates are synced into the CLI package.

Future Architecture Extensions
Plugin System

Future support:

playbook plugins install

Allow organizations to add custom governance rules.

IDE Integrations

Example:

VSCode Playbook extension

Shows governance violations in real time.

Playbook Cloud

Optional SaaS layer.

Provides:

governance dashboards

architecture health metrics

organization playbooks

CLI remains fully functional without cloud.

System Diagram
              Playbook Cloud
                     │
        ┌────────────┴────────────┐
        │                         │
      CLI                     GitHub App
        │                         │
        └──────────── Engine ─────┘
                     │
                  Rules
Development Philosophy

Playbook must prioritize:

Developer trust
Predictability
Transparency

Developers should always understand:

why a rule failed

how to fix it

where governance rules are defined

Future Evolution

Playbook may evolve into:

AI Engineering Governance Platform

But the CLI and engine must always remain open source and self-hostable.
