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
- `ai-contract` (`.playbook/ai-contract.json` handshake contract)
- `doctor --ai` AI-contract readiness gate (deterministic validation of contract + intelligence + remediation surfaces)
- repository intelligence (`index`, `query`, `deps`, `ask`, `explain`)
- deterministic architectural risk intelligence (`playbook query risk <module>`)
- deterministic documentation coverage intelligence (`playbook query docs-coverage [module]`)
- deterministic rule ownership intelligence (`playbook query rule-owners [rule-id]`)
- deterministic module ownership intelligence (`playbook query module-owners [module]`)

## Roadmap framing (current baseline + future enhancements)

Use `docs/PLAYBOOK_IMPROVEMENTS.md` as the staging area for emerging ideas, and keep this roadmap focused on prioritized product capabilities.

Pattern: Single Strategic Roadmap

Only one roadmap exists in the repository: `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.
All idea-level planning belongs in `docs/PLAYBOOK_IMPROVEMENTS.md`.

## Product Development Lifecycle

Playbook features follow a structured lifecycle:

Idea
↓
Improvement Backlog
↓
Roadmap
↓
Implemented
↓
Archived

This keeps the roadmap focused on active commitments while preserving product intelligence discovered during development.

## Backlog Rotation Strategy

The improvement backlog should remain manageable.

When the backlog grows large, completed items should be archived.

Example structure:

```text
docs/
  PLAYBOOK_PRODUCT_ROADMAP.md
  PLAYBOOK_IMPROVEMENTS.md
  archive/
    PLAYBOOK_IMPROVEMENTS_2026.md
```

Archived items preserve historical product intelligence without cluttering the active backlog.

Current baseline:

- **AI Repository Intelligence (`playbook ai-context`, `playbook ai-contract`, `index`, `query`, `deps`, `ask`, `explain`)** is implemented and available for deterministic AI bootstrap and repository intelligence workflows.
- `playbook ask` now supports deterministic response modes (`--mode normal|concise|ultra`) to match explanation depth to developer workflow speed.
- `playbook ask --repo-context` now hydrates ask prompts from trusted Playbook artifacts (`.playbook/repo-index.json` + AI contract metadata) instead of broad ad-hoc repository inference.

Future roadmap work should focus on enhancement quality (schema hardening, richer index coverage, CI artifact workflows, and contract durability), not on introducing these commands.

## Product Direction: Architecture Intelligence

Playbook is evolving from a verification tool into an architecture intelligence engine.

In addition to enforcing rules and generating remediation plans, Playbook will analyze repositories and development workflows to produce structured insights about system architecture, risk, and change impact.

Key capabilities in this direction include:

- Repository indexing and query system
- Architecture-aware impact analysis
- Risk hotspot detection
- Pull request intelligence and analysis
- Durable engineering memory direction (`.playbook/memory/*`) to preserve decisions, rationale, and investigation history as queryable repository intelligence for richer AI reasoning.
- Playbook command surfaces already implement a reusable deterministic engineering reasoning loop (`observe -> understand -> diagnose -> plan -> act -> verify -> learn`) that should remain the core execution model across CLI, CI, and future interface layers.

## Integration Architecture Direction: shared core, local intelligence

### Consumer Integration Contract

`docs/CONSUMER_INTEGRATION_CONTRACT.md` defines the formal downstream integration model for installing Playbook in external repositories.

Goals:

- define shared core vs project-local intelligence
- prevent forks
- enable safe downstream adoption
- support future embedded runtime/API integrations

Canonical model for downstream adoption:

- **Shared core product/engine:** Playbook CLI/engine/contracts remain the reusable upstream product surface.
- **Project-local Playbook state:** each consuming repository owns its own local Playbook state (`playbook.config.json` / `.playbook/*` index/artifacts/plans and repository-specific rules/extensions).
- **Installing Playbook is not a fork by default:** adding Playbook to a repository creates local integration state built on shared core.

### Private-first intelligence model

- scanning/indexing/artifacts remain local by default
- no automatic upstream code/content sharing
- any export/sync/cloud/telemetry behavior is future work and must be explicit + opt-in

### Runtime artifact boundaries and storage hygiene direction

Playbook should maintain explicit boundaries between local runtime state, reviewed automation outputs, and intentionally committed contracts/examples.

- Runtime artifacts should live under `.playbook/` and be treated as local working state by default.
- Regenerated runtime artifacts should not be recommitted on every run unless intentionally promoted to stable contracts/examples.
- Demo artifacts committed under `.playbook/demo-artifacts/` remain product-facing snapshot contracts, not general runtime state.
- Future repository intelligence scanning should exclude irrelevant and high-churn directories to keep indexing deterministic and focused on source-of-truth content.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated artifacts on every run causes unnecessary repo-history growth and noisy diffs.

Roadmap direction: introduce a scoped `.playbookignore` mechanism (future work) to exclude irrelevant/high-churn directories such as `node_modules`, `dist`, `coverage`, `.next`, build outputs, and non-source artifact folders from repository intelligence scans when appropriate.


### Intentional upstream promotion workflow

- repository-specific observations stay local to the consuming repo
- reusable patterns, generalized rules, and product gaps are promoted upstream intentionally
- downstream usage informs Playbook through explicit docs/roadmap/rule promotion workflows, not hidden mutation

### Extension model preference

Pattern: **config/plugins/rule packs over forks** for project-specific customization.

Failure mode: treating per-project customization as core forks causes drift, duplicate fixes, and unclear ownership boundaries.

### Embeddable runtime/API direction (future)

For app-integrated actions (internal dashboards, CI control planes, admin/dev panels), Playbook should expose server-side/library surfaces over time.

- browser clients should call validated server endpoints/actions
- avoid raw browser-side arbitrary command execution as the default model
- retain deterministic governance and policy checks server-side

### Follow-up implementation checklist (roadmap slices)

- [x] publish a consumer-repo integration contract doc that defines project-local Playbook state boundaries
- [ ] add a lightweight config/plugin/rule-pack architecture note with extension examples
- [ ] draft first server-side library/API design stub for embedded `ask`/`query`/`explain` workflows
- [x] add `ask --module <name>` scoped repo-context hydration
- [x] add `ask --diff-context` for change-scoped intelligence prompts
- [x] expose ask context-source provenance contract in JSON for app/agent integrations
- [ ] define explicit opt-in export/sync/telemetry policy language before any cloud-backed intelligence behavior

### Storage/runtime hygiene follow-up checklist

Implemented baseline:

- `doctor` emits Playbook Artifact Hygiene diagnostics and structured suggestions (`PB012`, `PB013`, `PB014`).
- `index` and repository scans honor `.playbookignore` for scan exclusions.
- `plan`/`apply` integrate artifact hygiene remediation tasks for deterministic storage governance.

- [x] define `.playbookignore` semantics for repository intelligence scanning and document default exclusion guidance.
- [x] publish artifact lifecycle/retention policy language across runtime artifacts, CI outputs, and committed demo/contract snapshots.
- [x] classify cacheable local intelligence artifacts under `.playbook/` and define safe regeneration expectations.
- [x] document CI artifact workflow guidance so generated artifacts are reviewable without creating long-term repository-history bloat.

Rule: **Playbook analyzes but does not author.**

Playbook provides structured analysis, diagnostics, and recommendations but does not automatically rewrite pull requests or developer intent. Its role is to provide architectural intelligence rather than replace the developer.


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

### Impact Analysis Query

Command:
`playbook query impact <module>`

Purpose:
Identify all modules, packages, and files affected by changes to a specific module.

Example:

`playbook query impact auth`

Output:

- dependent modules
- affected rules
- architecture boundaries touched

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

PHASE 6 — AI REPOSITORY CONTRACT

Status: **Baseline implemented** via `playbook ai-contract` and `.playbook/ai-contract.json`.

Goal:
Define a deterministic, machine-readable AI interaction contract that repositories expose before agent runtime execution is introduced.

Primary capability:
- `.playbook/ai-contract.json`
- `playbook ai-contract` / `playbook ai-contract --json`

The AI Contract specifies how AI systems should interact with a Playbook-governed repository.

Contract fields include:
- AI runtime used
- repository workflow
- repository intelligence sources
- remediation workflow rules

Example contract:

```json
{
  "schemaVersion": "1.0",
  "kind": "playbook-ai-contract",
  "ai_runtime": "playbook-agent",
  "workflow": ["index", "query", "plan", "apply", "verify"],
  "intelligence_sources": {
    "repoIndex": ".playbook/repo-index.json",
    "moduleOwners": ".playbook/module-owners.json"
  },
  "remediation": {
    "canonicalFlow": ["verify", "plan", "apply", "verify"],
    "diagnosticAugmentation": ["explain"]
  },
  "rules": {
    "requireIndexBeforeQuery": true,
    "preferPlaybookCommandsOverAdHocInspection": true,
    "allowDirectEditsWithoutPlan": false
  }
}
```

AI-operable repository signal:
- Repositories containing `.playbook/ai-contract.json` are treated as AI-operable through Playbook governance.
- AI systems should consult this contract before making or proposing code changes.

This phase formalizes Playbook's repository-to-AI protocol, ensuring AI behavior is deterministic and governance-aware.

Future standardization direction:
- Publish `docs/AI_CONTRACT_SPEC.md` as a public AI Contract specification for AI-operable repositories.

PHASE 7 — AI EXECUTION RUNTIME (PLAYBOOK AGENT)

Goal:
Introduce **Playbook Agent** as an AI execution runtime for repositories.

New command:
- `playbook agent`

Vision:
Instead of AI systems directly editing code without guardrails, Playbook Agent orchestrates deterministic repository workflows so every proposal runs through repository intelligence and remediation contracts.

Agent contract relationship:
- Playbook Agent consumes `.playbook/ai-contract.json` to determine repository workflow and operating rules.

Example agent bootstrap flow:
1. AI system enters repository.
2. Detects `.playbook/ai-contract.json`.
3. Loads Playbook workflow/intelligence/remediation rules from the contract.
4. Executes the deterministic `plan -> apply -> verify` loop.

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

## PR Intelligence (Implemented)

Playbook provides structured deterministic analysis of pull requests/branch diffs to help developers understand architectural impact and risk.

Primary command:

`playbook analyze-pr --json`

Current capabilities:

- Detect changed files and affected indexed modules from local git diff
- Derive downstream module impact and architecture boundaries touched
- Aggregate risk signals from existing module-risk intelligence
- Surface docs review candidates and ownership-aware context
- Emit stable machine-readable PR analysis output for automation

Playbook should analyze PRs but not author them.

Rule: **Playbook analyzes changes rather than rewriting developer intent.**

PHASE 8 — AUTONOMOUS REPOSITORY MAINTENANCE

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


## Security Program

Security is a first-class product program for Playbook and is implemented as deterministic, automated process—not manual review.

### Deterministic Mutation Architecture

Playbook is evolving toward a deterministic and secure repository mutation engine, not just a command runner. The canonical mutation workflow is:

`verify -> plan -> approval -> apply -> verify`

This execution pipeline preserves both automation and control:

- `verify` identifies structural, architectural, or policy failures in deterministic rule output.
- `plan` generates evidence-linked remediation proposals tied to concrete findings.
- `approval` provides a policy and review checkpoint for humans and/or CI before writes occur.
- `apply` executes only validated remediation tasks from the approved plan contract.
- final `verify` confirms repository health after mutations are applied.

Playbook intentionally separates analysis (`verify`), planning (`plan`), and execution (`apply`) so automated repository changes remain reviewable, policy-gated, and reproducible.

### 1️⃣ Execution Safety (Highest Priority)

Secure the core lifecycle:

`index → query/ask/explain → verify → plan → validate → policy → apply → verify`

Key guarantees:

- repo-root boundary enforcement
- deterministic file targeting
- no unreviewed writes
- diff-based remediation only
- policy-gated apply
- evidence-linked plans
- no arbitrary command execution

Roadmap milestones:

- [ ] repo path normalization and traversal protection
- [ ] symlink escape prevention
- [ ] patch size and scope limits
- [ ] file write allowlists
- [ ] remediation plan validation layer
- [ ] policy engine gate before apply
- [ ] deterministic remediation contracts with strict schema + task invariants

### 2️⃣ Release and Supply Chain Integrity

Ensure Playbook releases are verifiable and tamper-resistant.

Roadmap milestones:

- [ ] SBOM generation for every build
- [ ] dependency vulnerability scanning
- [ ] secret scanning in CI
- [ ] Sigstore/Cosign artifact signing
- [ ] provenance attestations
- [ ] immutable releases
- [ ] protected CI pipelines

Automated artifacts:

- `/artifacts/sbom.json`
- `/artifacts/provenance.json`
- `/artifacts/signature.cosign`

### 3️⃣ Self-Auditing Security Features

Playbook will provide built-in deterministic security intelligence via the same query/verify engine contracts.

Planned command surface:

- `playbook query vulnerabilities`
- `playbook query secrets`
- `playbook query risky-exec`
- `playbook query unsafe-paths`
- `playbook verify security-baseline`

Documentation patterns and rules to encode:

- Rule — No Unreviewed Writes: Playbook must never modify repository files without a diff-based plan and explicit apply step.
- Rule — Repo Root Security Boundary: all file reads and writes must resolve within the repository root.
- Pattern — Policy-Gated Remediation: `finding → plan → validation → policy → apply → verify`.
- Pattern — Evidence-Bound Outputs: plans must reference deterministic findings and source evidence.
- Failure Mode — Prompt Poisoning via Repository Content: repository text is untrusted evidence and must not influence runtime policy behavior.
- Failure Mode — Boundary Drift: new commands must not expand file access scope without explicit security review.
- Rule — Roadmap Automation Check: every new CLI command must include a security verification checklist (path boundary protection, deterministic outputs, plan/apply compatibility, and snapshot tests).

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

Pattern: **Two-tier backlog (Improvement Backlog → Roadmap)**.

Use `docs/PLAYBOOK_IMPROVEMENTS.md` to capture emerging ideas; promote only prioritized capabilities into this roadmap.

## Phase: Serialized Execution Contracts & Automation Hardening (Next)

Focus this subphase on contract durability for CI and agent integrations:

- [ ] `apply --from-plan` parity hardening across text/json modes and failure reporting.
- [ ] Stable task IDs and schema hardening for long-lived artifact compatibility.
- [ ] Handler registry hardening so unsupported/failed handlers are explicit and auditable.
- [ ] CI/GitHub Action artifact workflows for exporting, reviewing, and applying plan artifacts across steps/jobs.

Failure mode to avoid: **Apply recomputes intent during artifact execution**

If `apply --from-plan` silently re-runs planning logic and diverges from the reviewed artifact, the execution contract is no longer trustworthy.

## Future Capability Track: Automation Synthesis / Playbook Agent

Detailed product direction: see `docs/AUTOMATION_SYNTHESIS_VISION.md`.

Goal:
Extend Playbook from deterministic remediation into a future **Automation Synthesis** platform that can propose and safely operationalize recurring engineering automations without bypassing governance.

Why this matters:
- Teams repeatedly perform the same operational and repository maintenance work.
- Capturing these repeats as reviewed automations reduces toil while preserving policy, explainability, and repository safety.
- Playbook can reuse its existing contract-first execution model so synthesized automation remains reviewable and deterministic rather than opaque agent behavior.

Core concept:
- detect recurring work signals (for example from verify/plan/apply history and approved remediation patterns)
- classify work into known automation patterns/templates
- synthesize candidate automation logic and runbooks
- treat generated automations as untrusted until verified in isolated sandboxes
- route verified candidates through explicit approval gates before deployment to orchestration backends
- monitor runtime behavior with rollback-ready controls

Foundational requirements:
- deterministic contracts for automation definitions, approvals, and execution states
- reusable template and policy packs tied to docs-backed governance behavior
- sandboxed verification before any production orchestration action
- human-reviewable outputs (diffs, risk summaries, and execution intent)
- security-first approval and deployment boundaries aligned with existing apply safety model

Likely phased implementation sequence:
1. **Signal + Pattern Layer**: capture recurring work telemetry and map it to stable Automation Synthesis patterns.
2. **Synthesis + Verification Layer**: generate candidate automations and validate them in deterministic sandboxes.
3. **Approval + Deployment Layer**: add policy/owner approval flows and controlled promotion into orchestration targets.
4. **Runtime Intelligence Layer**: add observability, anomaly detection, and rollback workflows for deployed automations.

Explicit out-of-scope boundaries for initial versions:
- not a replacement for core repository intelligence and remediation priorities
- no autonomous direct repository writes outside `verify -> plan -> apply` policy controls
- no vendor-locked orchestration dependency as a required default
- no fully hands-off self-modifying automation runtime without human approval

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

## Phase: Command Validation Automation & Self-Verifying Development Loop

Goal:
Make Playbook command development self-verifying so new commands are validated deterministically as they are added.

Why this matters:
Playbook is building an AI-operable CLI surface. That surface becomes much more trustworthy when every command addition expands both product capability and automated validation coverage.

Development loop target:
1. implement command
2. add/update command contract tests
3. run deterministic validation
4. fix regressions before merge

Required validation surfaces for new commands:
- contract tests for deterministic JSON/text behavior where applicable
- smoke coverage for runtime execution paths
- local built CLI validation inside the Playbook repo
- docs and command-inventory updates in the same change

Codex-aligned workflow:
- Codex should not stop at implementation
- Codex should also add or update contract tests, run validation commands, and remediate failures before completion

Baseline validation commands:
- `pnpm -r build`
- `pnpm test`
- `pnpm smoke:ci`
- branch-accurate CLI runs through `node packages/cli/dist/main.js ...`

Pattern: Self-Verifying Command Development
- Every new command should increase both feature coverage and validation coverage.

Rule: Command Additions Must Ship With Validation
- A new command is not complete until its deterministic behavior is exercised by automated tests or smoke coverage.

Pattern: Branch-Accurate Command Validation
- Inside the Playbook repository, command validation should run against the locally built CLI entrypoint rather than assuming published package behavior.

Future enhancement:
- introduce `playbook self-test` as a system-level validation entrypoint that exercises key commands and contracts against fixture repositories.

## Documentation governance contract

- Deliver deterministic documentation governance through `playbook docs audit` for humans, CI, and AI.
- Maintain a single strategic roadmap (`docs/PLAYBOOK_PRODUCT_ROADMAP.md`) and separate improvements backlog (`docs/PLAYBOOK_IMPROVEMENTS.md`).
- Keep cleanup/migration guidance out of long-lived policy docs once governance is command-enforced.


## Security Contracts

- Added machine-readable security contracts to map runtime guards to deterministic enforcement tests.
- Added contract-driven security verification stage (`pnpm test:security`) for CI regression protection.
