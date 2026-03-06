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

Establish Playbook as a trusted governance tool in the developer ecosystem.

Target outcomes:

1,000+ GitHub stars
100+ repositories using Playbook in CI
First external contributors
Initial enterprise interest

Revenue is not the priority during Year 1.

Adoption is.

PHASE 1 — FOUNDATION

Months 1–2

Goal:
Transform Playbook from a personal workflow into a clean open-source developer tool.

Deliverables
Repository Architecture
playbook
├ packages
│ ├ cli
│ └ engine
├ templates
│ └ repo
├ docs
│ ├ concepts
│ ├ config
│ └ rules
├ scripts
└ README.md
CLI Commands

Initial commands:

playbook init
playbook analyze
playbook verify
playbook doctor

AI-Aware Engineering Guardrails

AI code generation increases the need for automated verification and architectural guardrails.

Playbook is not a testing framework. It is the governance and verification layer that keeps AI-accelerated development from degrading architectural integrity.

Future capabilities:

AI-Safe Development
- Detect structural risks introduced by AI-generated code.
- Verify repository contracts remain intact after automated code generation.
- Ensure architectural boundaries remain respected.

Test Intelligence
- Detect modules without tests.
- Warn when critical subsystems lack integration tests.
- Surface test coverage gaps through future integrations with coverage tools.

Verification-First CI
- Expand `playbook verify` to support stronger enforcement in CI pipelines.
- Allow teams to fail builds on governance violations.
- Add future GitHub Action support for running `playbook verify` in CI.

Architectural Contracts
- Define repository invariants such as forbidden import paths, layer boundaries, and module ownership.
- Verify these contracts automatically during analysis and verification workflows.

Progress (current)

- [ ] AI-safe structural risk detection for generated code
- [ ] Repository contract verification for automated code generation workflows
- [ ] Test-intelligence signals for missing tests and integration coverage blind spots
- [ ] CI enforcement controls for governance-based build failures
- [ ] Built-in architectural contract definitions (imports, boundaries, ownership)
- [ ] GitHub Action support for verification-first governance in CI
Repository Templates

playbook init baseline scaffold guarantees:

docs/PLAYBOOK_NOTES.md
playbook.config.json (legacy) or .playbook/config.json (modern)

Repository-specific governance docs and workflow files (for example `docs/PROJECT_GOVERNANCE.md`, `docs/ARCHITECTURE.md`, `docs/PLAYBOOK_CHECKLIST.md`, and `.github/workflows/playbook-verify.yml`) are optional and may be created or managed by individual repositories.
CI Integration

Example:

run: playbook verify

CI fails if governance rules are violated.

Tooling & Distribution (Package Manager + Action + Demo Repo)

- [x] Adopt pnpm as the workspace standard; keep `pnpm-lock.yaml` committed and never gitignored.
- [x] Enforce a single pnpm version source via `package.json#packageManager`; CI setup must not pin a conflicting pnpm version (use aligned `pnpm/action-setup` or Corepack behavior).
- [x] Fix CI pnpm cache reliability by installing pnpm via `pnpm/action-setup` and caching the pnpm store with `actions/cache`, while keeping lint/test/smoke as separate visible phases.
- [x] Remove CLI bundler dependency from the critical path (`packages/cli` now builds with `tsc` to `dist/main.js`) to eliminate Rollup optional native module flakiness in CI.
- [x] Remove core/engine/node bundler dependency from the critical path (`packages/core`, `packages/engine`, and `packages/node` now build with `tsc` to `dist/index.js`) to eliminate Rollup optional native module flakiness in CI.
- [x] Bundle CLI templates into `packages/cli/dist/templates/repo` during `packages/cli` build so smoke tests and published tarballs run `playbook init` without extra environment variables.
- [x] Validate packaged CLI artifact correctness in CI by packing local tarballs and smoke-testing local install + `playbook init`/`analyze`/`verify`.
- [ ] Publish CLI to npm as `@fawxzzy/playbook` (scoped org package).
- [ ] Ensure scoped npm publish uses public access (`npm publish --access public`).
- [ ] Ensure Windows compatibility by avoiding `sh`/`bash` lifecycle scripts in published install paths.
- [ ] Define and document 30-second onboarding demo commands using the `npx` path.
- [ ] Provide a first-class GitHub Action distribution path via a composite action that runs `npx @fawxzzy/playbook verify`.

Near-Term Productization Milestones

- [ ] CLI command architecture cleanup: standardize all CLI commands under `packages/cli/src/commands/`, wire `packages/cli/src/commands/index.ts` as the single command registry, and keep shared helpers under `packages/cli/src/lib/`.
- [ ] Command documentation baseline: add `docs/commands/` with short per-command docs for `analyze`, `doctor`, `diagram`, and `upgrade` so contributors and AI agents can quickly discover supported behavior.
- [ ] Docs merge and roadmap cleanup: keep roadmap/checklist/docs language aligned so near-term CLI structure and distribution priorities remain explicit.
- [ ] Playbook Demo Repo milestone (`playbook-demo`): provide a first-class onboarding repository where developers can run `npx --yes @fawxzzy/playbook analyze` immediately and see meaningful governance output.
- [ ] GitHub Action Integration (CI-native adoption): deliver a first-class `uses: playbook/verify` path, with initial implementation via `.github/workflows/playbook-verify.yml`. Initial capabilities should include `playbook verify`, architecture contract checks, and governance rule checks.
- [ ] NPM Package Publishing (public adoption): publish Playbook as an installable CLI with support for `npx --yes @fawxzzy/playbook analyze`, backed by an npm publishing pipeline, clear versioning strategy, and reliable scoped CLI distribution.

## Phase: Developer Experience

- ☑ Docs merge tooling
- ☑ Session merge/import system
- ⬜ CLI command registry as single source of truth
- ⬜ `docs/commands/` baseline documentation
- ⬜ Playbook demo repository (`playbook-demo`)
- ⬜ GitHub Action
- ⬜ Canonical session outputs

Developer Experience focuses on making Playbook immediately useful to developers with minimal setup.
This phase emphasizes demoability, automation, and deterministic workflows so that developers can understand Playbook value in seconds.

- [ ] Dogfood Playbook in FawxzzyFitness (internal adoption gate): run Playbook end-to-end in Zac's own repo to validate reliability before broader rollout.
  - Phase gates (acceptance criteria):
    - Playbook repo CI green (install/build/test/package).
    - Stable install path for consumers validated (`npx` OR `npm pack` tarball OR git-based install).
    - CLI commands run reliably on a real repo (`init`, `analyze`, `verify`, `doctor`).
  - Safe migration plan:
    - Run new and old Playbook in parallel via separate npm scripts.
    - Flip default scripts to the new Playbook once stable in day-to-day use.
    - Keep a legacy alias for one release cycle, then remove it.
  - Dogfooding findings feed CLI/engine improvements and roadmap checkbox updates.

Initial Rule

v0.1 rule:

requireNotesOnChanges

Meaning:

If code changes in:

src/**
app/**
server/**
supabase/**

then:

docs/PLAYBOOK_NOTES.md

must also change.

Success Criteria
CLI works locally
CI integration works
Smoke tests pass
Repo polished and documented

Progress (current)

- [x] Repository architecture established (`packages/cli`, `packages/engine`, `templates/repo`, `docs`, `scripts`)
- [x] Platform architecture (core + adapters + CLI)
- [x] CLI scaffold implemented (`init`, `analyze`, `verify`, `doctor`)
- [x] Repository templates generated by `playbook init`
- [x] CI workflow included for verification
- [x] Initial rule `requireNotesOnChanges` implemented in engine
- [x] Smoke test script and automated tests are present
- [x] pnpm policy explicitly documented and enforced as the toolchain standard
- [x] pnpm version governance consolidated to `packageManager` as the authoritative source
- [x] Lockfile determinism hardened with `pnpm.supportedArchitectures` (`linux`/`darwin`/`win32`, `x64`, `glibc`) so Rollup optional native deps are captured for CI Linux installs.
- [x] Reusable CI action now uses `setup-node` native pnpm cache and split lint/test/smoke steps for clearer, deterministic failure signals with less config drift.
- [x] Docs hygiene tooling exercised with a deterministic `docs:merge` consolidation pass (SAFE mode, canonical pointers/stubs retained).
- [x] Docs merge tooling completed and executed once on the Playbook repo.
- [x] Session tooling implemented (`session import`, `session merge`, `session cleanup`).
- [x] Repository hygiene rules established for `.playbook/`.
- [ ] `examples/demo-repo/` ships as an onboarding path with intentional architecture/doc/governance drift and meaningful analysis output
- [ ] GitHub Action path finalized for `uses: playbook/verify` with verify + architecture + governance checks
- [ ] npm package distribution live with publish pipeline, versioning strategy, and installable Playbook CLI
PHASE 2 — REPOSITORY INTELLIGENCE

Months 3–4

Goal:
Enable Playbook to understand repository architecture automatically.

New Command
playbook analyze

Detect:

framework
database
UI architecture
styling system
Example Output
Detected Stack

Framework: Next.js
Database: Supabase
Styling: Tailwind
Architecture: React Server Components
Architecture Draft Generation

Playbook can insert suggestions into:

docs/ARCHITECTURE.md

using marker:

<!-- PLAYBOOK:ANALYZE_SUGGESTIONS -->
Stack Detectors

Initial detectors:

- [x] Next.js detector
- [x] Supabase detector
- [x] Tailwind detector
- [ ] Express detector
- [ ] Prisma detector
Success Criteria
Analyze detects stack reliably
Architecture draft generation works
Developers see value immediately

Progress (current)

- [x] `playbook analyze` command implemented
- [x] Stack detection for Next.js, Supabase, and Tailwind
- [x] Architecture suggestion marker support in `docs/ARCHITECTURE.md`
- [ ] Stack detector coverage expanded to Express and Prisma
- [ ] Analyze output expanded beyond current detector set
PHASE 3 — GOVERNANCE ENGINE

Months 5–6

Goal:
Transform Playbook into a policy engine for architecture governance.

Rule Engine

Rules become plugin-based.

verify/
  rules/
    requireNotesOnChanges
    forbidLayerCrossing
    requireArchitectureDocs
Example Rule
forbidLayerCrossing
UI cannot import DB directly
UI → Server → DB
Rule Interface
export interface PlaybookRule {
  id: string
  run(context: VerifyContext): VerifyResult[]
}
JSON Output
playbook verify --json

Example:

{
  "ok": false,
  "failures": [
    {
      "rule": "forbidLayerCrossing",
      "file": "src/components/user.ts",
      "message": "UI imported DB layer"
    }
  ]
}
CI Integration

Playbook must work with:

GitHub Actions
GitLab CI
CircleCI
Buildkite
Success Criteria
Rule engine stable
Multiple governance rules implemented
JSON output supported

Progress (current)

- [x] Engine-backed `playbook verify` command implemented
- [x] Deterministic `requireNotesOnChanges` rule is active
- [x] Structured JSON output for verify reports
- [ ] Additional governance rules (for example `forbidLayerCrossing`, `requireArchitectureDocs`) implemented
- [x] Plugin-based rule and detector loading model skeleton implemented
PHASE 4 — KNOWLEDGE ENGINE

Months 7–9

Goal:
Turn Playbook into an engineering knowledge system.

New Command
playbook learn

This command analyzes:

commits
notes
code patterns
architecture decisions
Knowledge Pipeline
Playbook Notes
      ↓
Proposed Doctrine
      ↓
Promoted Doctrine

Example doctrine:

Server loaders should shape view models
Engineering Knowledge Graph

Playbook tracks:

patterns
decisions
architecture boundaries
recurring solutions

Conversation Graph & Session Memory (Branch / Merge)

Playbook will define a deterministic session format and CLI workflow for conversation graphs so teams can branch and merge engineering reasoning with the same governance discipline applied to code. This is a Playbook format + tools capability, not a chat UI change.

The session model will support:

- checkpoints (context snapshots)
- branches (topic explorations)
- merges (reconciliation of parallel work)
- conflict reporting/resolution for decisions and constraints

Deliverables

- [ ] Define a Session Snapshot schema (Decisions, Constraints, Open Questions, Artifacts, Next Steps)
- [ ] Add CLI commands (or equivalent namespace aligned to Playbook conventions):
  - [ ] `playbook session checkpoint`
  - [ ] `playbook session branch`
  - [ ] `playbook session merge`
- [ ] Implement deterministic merge logic for snapshots, including conflict detection
- [ ] Emit merge reports in both human-readable and JSON format
- [ ] Add `docs/concepts` documentation describing Conversation Graph workflows

Why this matters

Conversation-graph workflows prevent drift, enable parallel exploration, and convert chat history into structured engineering knowledge that can be governed, reviewed, and reused.

Success Criteria
Doctrine system implemented
Notes pipeline stable
Knowledge extraction working
PHASE 5 — ORGANIZATION PLAYBOOK

Months 10–12

Goal:
Enable governance across multiple repositories.

Organization Structure
Company Playbook
      ↓
Repo Playbook A
Repo Playbook B
Repo Playbook C

Company defines:

architecture principles
security rules
engineering doctrine

Repositories inherit these rules.

Example Organization Rule
All DB access must go through service layer
Enterprise Features

Optional Playbook Cloud:

playbook.dev

Provides:

multi-repo dashboards
governance metrics
architecture health
doctrine graph
Success Criteria
Multi-repo governance supported
Enterprise interest begins
Early design partners
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


## Phase: AI Repository Intelligence (Future)

This phase is planned and intentionally not implemented in the current stabilization window.

Planned feature: `playbook index`

- Command intent: generate a machine-readable repository intelligence artifact for AI-safe repository understanding.
- Planned output path: `.playbook/repo-index.json`.
- Planned index coverage:
  - modules
  - dependencies
  - database schema
  - framework
  - architecture contracts
- Product purpose: enable AI agents to safely understand repository structure and constraints before making code changes.
- Scope note: this roadmap phase documents intent only; index generation is not part of the current implementation scope.

## Phase: AI-Operable Repository Platform

Feature: playbook plan

Generate machine-readable tasks from verify/analyze findings.

Example:

npx playbook plan --json

Output:

```json
{
  "tasks": [
    {
      "rule": "PB001",
      "file": "docs/ARCHITECTURE.md",
      "action": "update architecture docs",
      "autoFix": true
    }
  ]
}
```

Purpose:

Allow AI agents and automation to determine what actions should be taken.

Feature: playbook apply

Execute a planned fix deterministically.

Example:

npx playbook apply PB001

Purpose:

Allow tools and agents to apply changes safely without editing files directly.

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
- playbook apply
- playbook verify --json

Purpose:

Allow AI coding tools to safely interact with repositories through Playbook.

Feature: GitHub Action

Allow repositories to add:

uses: playbook/verify

Purpose:

Automate governance checks in CI.

