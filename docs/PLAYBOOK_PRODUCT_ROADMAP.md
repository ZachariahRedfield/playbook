PLAYBOOK – 12 MONTH PRODUCT ROADMAP

AI Governance for Software Engineering

MISSION

Build the governance layer for AI-assisted software development.

Playbook ensures that AI-generated code:

follows architecture

captures engineering knowledge

maintains documentation discipline

prevents architectural drift

Playbook sits between AI coding agents and repositories.

AI Agents
     ↓
Playbook
     ↓
Repository
CORE PRINCIPLES

These rules guide all development decisions.

1️⃣ CLI First

Playbook must always function:

locally

offline

inside CI

Cloud must never be required.

playbook init
playbook analyze
playbook verify

must always work independently.

2️⃣ Deterministic Governance

Rules must be:

explicit

predictable

CI-friendly

Avoid "AI guessing" for core enforcement.

3️⃣ Knowledge Capture

Every meaningful engineering change must produce knowledge.

Example pipeline:

Code change
      ↓
Playbook Notes
      ↓
Proposed Doctrine
      ↓
Promoted Engineering Knowledge

Why this matters

Knowledge capture is governance, not documentation theater. It prevents drift between intent and implementation, enables parallel exploration without losing decision integrity, and turns chat history into structured, reusable engineering knowledge.

4️⃣ Developer Experience Over Features

Adoption depends on:

Install
Run
Understand
Trust

within 5 minutes.

PRODUCT ARCHITECTURE

Playbook evolves through three layers.

Playbook CLI (Open Source)
        ↓
Governance Engine
        ↓
Playbook Cloud (Optional)
YEAR 1 OBJECTIVE

## Product positioning (current)

Playbook is positioned as an **AI-operable development tool**:

- human-usable for local engineering workflows
- machine-readable for CI and automation
- CI-enforceable through deterministic exit codes and contracts
- agent-compatible through stable JSON responses and explicit command surfaces

Current implemented product-facing command/artifact set:

- `analyze`
- `verify`
- `rules`
- `doctor`
- `diagram`
- `plan`
- `apply`
- `playbook-demo` artifact (exposed through `playbook demo`)
- `ai-context`
- repository intelligence (`index`, `query`, `deps`, `ask`, `explain`)
- deterministic architectural risk intelligence (`playbook query risk <module>`)
- deterministic documentation coverage intelligence (`playbook query docs-coverage [module]`)
- deterministic rule ownership intelligence (`playbook query rule-owners [rule-id]`)
- deterministic module ownership intelligence (`playbook query module-owners [module]`)

## Roadmap framing (current baseline + future enhancements)

Current baseline:

- **AI Repository Intelligence (`playbook ai-context`, `index`, `query`, `deps`, `ask`, `explain`)** is implemented and available for deterministic AI bootstrap and repository intelligence workflows.

Future roadmap work should focus on enhancement quality (schema hardening, richer index coverage, CI artifact workflows, and contract durability), not on introducing these commands.


Establish Playbook as a trusted governance tool in the developer ecosystem.

Target outcomes:

1,000+ GitHub stars
100+ repositories using Playbook in CI
First external contributors
Initial enterprise interest

Revenue is not the priority during Year 1.

Adoption is.

PHASE 1 — CLI FOUNDATIONS

Goal:
Ship a reliable local-first CLI with deterministic contracts for human and machine workflows.

Core outcomes:
- Build and distribution reliability (`pnpm -r build`, npm packaging, CI install paths).
- Stable command registry and deterministic JSON outputs.
- Verification-first baseline (`verify`, `plan`, `apply`) for governance enforcement.

PHASE 2 — REPOSITORY INTELLIGENCE

Goal:
Build deterministic repository intelligence artifacts that AI systems and developers can trust.

Primary capability:
- `playbook index` generates `.playbook/repo-index.json` as machine-readable repository context.

Expected artifact shape (example):

```json
{
  "modules": [
    {
      "name": "workouts",
      "dependencies": ["auth", "db"]
    }
  ]
}
```

Intelligence artifacts should include:
- modules
- dependencies
- dependents
- architecture metadata

PHASE 3 — QUERY SYSTEM

Goal:
Enable deterministic repository reasoning through command-surface intelligence queries.

Primary capability:
- `playbook query`

Representative queries:
- `playbook query architecture`
- `playbook query dependencies <module>`
- `playbook query impact <module>`
- `playbook query risk <module>`
- `playbook query docs-coverage`
- `playbook query rule-owners`

This phase establishes contract-driven repository reasoning so AI systems can avoid ad-hoc inference.

PHASE 4 — DEPENDENCY GRAPH + IMPACT ANALYSIS

Goal:
Use repository dependency edges to make change impact deterministic.

Primary capabilities:
- dependency graph in index artifacts
- impact analysis via `playbook query impact <module>`

Expected outcomes:
- identify downstream dependents before edits
- expose architectural blast radius for proposed changes
- prioritize low-impact remediation paths first

PHASE 5 — RISK ANALYSIS

Goal:
Add deterministic module-level risk scoring for safer AI and human remediation planning.

Primary capability:
- `playbook query risk <module>`

Risk model signals should include:
- fan-in
- fan-out
- verification failures
- dependency-hub status

Expected outcome:
- safer prioritization of change sequencing and rollout planning.

PHASE 6 — AI EXECUTION LAYER (PLAYBOOK AGENT RUNTIME)

Goal:
Introduce **Playbook Agent** as an AI execution runtime for repositories.

New command:
- `playbook agent`

Vision:
Instead of AI systems directly editing code without guardrails, Playbook Agent orchestrates deterministic repository workflows so every proposal runs through repository intelligence and remediation contracts.

Example:
- `playbook agent "add pagination to workouts API"`

Deterministic AI execution loop:
1. `playbook index`
2. `playbook query architecture`
3. `playbook query dependencies <module>`
4. `playbook query risk <module>`
5. `playbook plan`
6. `playbook apply`
7. `playbook verify`
8. Repeat remediation cycle until verify is clean.

This phase defines Playbook as an AI governance and execution runtime, not only a repository rule checker.

PHASE 7 — AUTONOMOUS REPOSITORY MAINTENANCE

Goal:
Extend Playbook Agent into recurring and CI-driven repository maintenance modes.

Planned operating modes:
- CI self-healing: `playbook agent --fix-ci`
- maintenance mode: `playbook agent --mode maintain`

Example autonomous tasks:
- documentation drift fixes
- architecture corrections
- rule remediation
- dependency cleanup
- targeted coupling reduction/refactoring flows

Documentation patterns to enforce in this phase:

- Pattern: Contract-Driven AI Execution
  - AI systems must operate through deterministic repository workflows instead of directly modifying code.
- Pattern: AI Execution Loop
  - AI change proposals pass through `plan -> apply -> verify` cycles until repository verification succeeds.
- Pattern: Repository Intelligence Layer
  - Structured repository artifacts (index, dependency graph, risk graph) allow AI tools to reason about codebases deterministically.

Updated product direction:
Playbook evolves from a repository rule checker into an AI-aware repository governance and execution runtime.

Key product pillars:
- Repository intelligence
- Deterministic remediation
- AI-safe execution
- Architecture enforcement

FUTURE DIRECTION — PLAYBOOK PLATFORM VISION

Playbook starts as a CLI-first developer tool, but the platform is intentionally architected so the same analysis engine can power multiple product surfaces.

Architecture Philosophy

packages/engine is the core analysis engine.

Interfaces built on top of it can include:

CLI
GitHub Actions
API services
Web dashboards

This separation allows Playbook to grow from a local CLI workflow into a broader engineering governance platform without fragmenting core logic.

Potential Long-Term Capabilities

- Repository architecture graphs
- Engineering governance scoring
- Cross-repository insights
- Playbook Cloud dashboards
- AI-assisted repository explanation

LONG TERM VISION

Playbook becomes the governance infrastructure for AI-assisted development.

Equivalent ecosystem role:

Git → version control
CI → builds
Sentry → runtime errors
Playbook → architecture governance
NORTH STAR METRICS

Year 1:

1,000 GitHub stars
100 repositories using Playbook
10 external contributors

Year 2:

10,000 developers
1,000 repos using Playbook
first enterprise deployments
FOCUS MANTRA

Every feature must answer one question:

How do we keep AI-generated code aligned with architecture?


## Phase: AI Repository Intelligence (Current + Next Enhancements)

This phase is now implemented in the current product baseline.

Implemented baseline: `playbook index` (paired with `query`, `deps`, `ask`, `explain`, and `ai-context`).

- Command intent: generate a machine-readable repository intelligence artifact for AI-safe repository understanding.
- Output path: `.playbook/repo-index.json`.
- Current index coverage:
  - modules
  - dependencies
  - database schema
  - framework
  - architecture contracts
- Product purpose: enable AI agents to safely understand repository structure and constraints before making code changes.
- Next enhancements: richer intelligence coverage, schema hardening, and stronger CI artifact workflows.

## Phase: AI-Operable Repository Platform (Loop 1 Complete)

Status: the first remediation interface loop is now implemented via `verify`, `plan`, and `apply`.

Canonical flow:

`verify -> plan -> apply -> verify`

- `verify` detects deterministic governance findings.
- `plan` emits deterministic remediation intent (`tasks`) in both human and machine-readable forms.
- `apply` executes deterministic auto-fixable tasks from fresh planning or a serialized `--from-plan` artifact.
- `fix` remains as a convenience/direct remediation path, while `plan` + `apply` is the primary automation contract.

Pattern: **Reviewed Intent Before Execution**

The safest automation model is to generate a machine-readable plan, review it, then execute that exact artifact.

## Phase: Serialized Execution Contracts & Automation Hardening (Next)

Focus this subphase on contract durability for CI and agent integrations:

- [ ] `apply --from-plan` parity hardening across text/json modes and failure reporting.
- [ ] Stable task IDs and schema hardening for long-lived artifact compatibility.
- [ ] Handler registry hardening so unsupported/failed handlers are explicit and auditable.
- [ ] CI/GitHub Action artifact workflows for exporting, reviewing, and applying plan artifacts across steps/jobs.

Failure mode to avoid: **Apply recomputes intent during artifact execution**

If `apply --from-plan` silently re-runs planning logic and diverges from the reviewed artifact, the execution contract is no longer trustworthy.

Feature: Plugin Ecosystem

Support external packages:

- playbook-plugin-react
- playbook-plugin-next
- playbook-plugin-supabase

Plugins provide:

- verify rules
- analyze rules
- fix handlers

Purpose:

Enable a community ecosystem similar to ESLint plugins.

Feature: Agent Interface

Expose machine-readable interfaces:

- playbook analyze --json
- playbook status --json
- playbook plan --json
- playbook apply --json
- playbook fix --json (convenience path)
- playbook verify --json

Purpose:

Allow AI coding tools to safely interact with repositories through Playbook.

Feature: GitHub Action

Allow repositories to add:

uses: playbook/verify

Purpose:

Automate governance checks in CI.



## Rule: Product State Must Be Anchored

When a new command or major workflow ships, update the authoritative product-state surfaces in the same change (or immediately after):

- `README.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- command reference docs
- demo docs/contracts
- `docs/CHANGELOG.md`

Pattern: **AI Anchor Drift**.

Command-state rule for current roadmap framing:

- New command additions must update README, roadmap, command reference, demo docs, and changelog.
- `index` and the AI repository-intelligence surface are implemented; roadmap items should track enhancement quality and automation durability rather than command existence.
- When docs and implementation disagree, code is source of truth.
