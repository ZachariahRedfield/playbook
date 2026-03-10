# Playbook Engine Spec (Archived 2026)

Archived in 2026.
Retained for historical/reference purposes.
Not an active source of product truth.

## Canonical successors

- [../ARCHITECTURE.md](../ARCHITECTURE.md)
- [../contracts/COMMAND_CONTRACTS_V1.md](../contracts/COMMAND_CONTRACTS_V1.md)
- [../commands/README.md](../commands/README.md)

---

PLAYBOOK ENGINE SPECIFICATION
Purpose

This document defines the internal architecture of the Playbook Engine.

The engine is responsible for:

repository analysis

governance rule execution

stack analysis

structured reporting

The engine powers:

Playbook CLI
CI integrations
IDE integrations
Future Playbook Cloud services

The engine must remain deterministic, fast, and modular.

Engine Overview

The Playbook engine executes a pipeline composed of several modules.

Repository
    ↓
Repository Analyzer
    ↓
Rule Engine
    ↓
Verification Results
    ↓
Reporting Layer

Each module is isolated and composable.

Engine Directory Structure

Inside:

packages/engine

Current structure:

src/
  analyze/
    detectors/
  verify/
    rules/
  report/
  config/
  git/
  util/
Core Concepts
Verify Context

Every rule executes against a context object.

Example:

interface VerifyContext {
  repoRoot: string
  changedFiles: string[]
  config: PlaybookConfig
}

This context provides everything rules need.

Rules must never read from global state.

Repository Analyzer

Location:

engine/analyze/

Purpose:

Detect project structure automatically.

Detectors analyze:

frameworks
database usage
styling systems
folder conventions

Example detectors:

nextjs
supabase
tailwind
prisma
express
Detector Interface

Example:

interface StackDetector {
  id: string
  label: string
  detect(repo: RepoContext): DetectionResult | null
}

Example output:

Framework: Next.js
Database: Supabase
Styling: Tailwind

<!-- docs-merge:duplicate-block -->
> See also canonical block: [docs/EXAMPLES.md:27](EXAMPLES.md#block-27).

Detector results should include structured evidence and confidence metadata, and `pnpm playbook analyze --json` should expose:

- `detectorsRun: string[]`
- `detected: Array<{ id, label, evidence[] }>`

Detectors must:

be fast

avoid heavy parsing

rely on filesystem signals

Governance Rule Engine

Location:

engine/verify/

The rule engine executes governance policies.

Command:

pnpm playbook verify

Execution pipeline:

Load configuration
      ↓
Collect changed files
      ↓
Execute rules
      ↓
Aggregate results
      ↓
Return report
Rule Structure

Rules live in:

engine/verify/rules/

Example rules:

requireNotesOnChanges (implemented)
forbidLayerCrossing (planned)
requireArchitectureDocs (planned)
requireADR (planned)
Rule Interface

Example implementation contract:

export interface PlaybookRule {
  id: string
  run(context: VerifyContext): VerifyResult[]
}
Verify Results

Rules return structured results.

Example:

interface VerifyResult {
  rule: string
  file?: string
  message: string
  severity: "error" | "warning"
}
Rule Execution Model

Rules must follow these constraints:

Deterministic

Rules must always produce the same result given the same repository state.

Fast

Rules should run in milliseconds.

Non-destructive

Rules must never modify files.

They only report violations.

Reporting System

Playbook must support both:

human-readable output
machine-readable output
CLI Output

Example:

✖ Verification failed

[requireNotesOnChanges]
src/foo.ts changed but notes were not updated.

Fix:
Update docs/PLAYBOOK_NOTES.md
JSON Output

Command:

pnpm playbook verify --json

Example output:

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

<!-- docs-merge:duplicate-block -->
> See also canonical block: [docs/PLAYBOOK_AGENT_GUIDE.md:219](PLAYBOOK_AGENT_GUIDE.md#block-219).

This output allows integration with:

CI pipelines
GitHub bots
IDE extensions
Dashboards
Configuration System

Configuration file:

playbook.config.json

Example:

{
  "version": 1,
  "rules": {
    "requireNotesOnChanges": {
      "enabled": true,
      "paths": ["src/**"]
    }
  }
}
Rule Execution Order

Rules run in a defined order:

1. Repository analysis
2. File change detection
3. Rule execution
4. Result aggregation
5. Reporting

This ensures predictable output.

Plugin System (Future)

Playbook will support external plugins.

Example:

pnpm playbook plugins install company-rules

Plugins may add:

custom governance rules
custom analyzers
organization policies
Performance Requirements

The verify command must remain fast.

Target execution time:

< 1 second

for most repositories.

Rules must avoid:

heavy AST parsing
large dependency graphs
full repository scans
Security Considerations

Playbook rules must never:

execute arbitrary code
access external services
modify repository files

Rules operate strictly on repository metadata.

Future Engine Capabilities

Future features may include:

Pattern Detection

Detect repeated engineering patterns.

Example:

Server loaders shaping view models
Doctrine Extraction

Automatically suggest governance rules from recurring notes.

Architecture Drift Detection

Identify changes that deviate from documented architecture.

Engine Stability

The engine should evolve carefully.

Breaking changes to rule interfaces must be versioned.

Example:

engine API v1
engine API v2
Development Philosophy

The Playbook engine prioritizes:

predictability
speed
transparency
extensibility

The engine must remain simple enough that developers can easily understand how governance rules operate.
