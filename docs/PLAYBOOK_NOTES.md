# Playbook Notes

• Pattern: Verify-Plan-Apply-Verify
The canonical remediation workflow is `verify -> plan -> apply -> verify`. This keeps detection, intent generation, execution, and post-execution validation explicit for humans, CI, and AI agents.

• Rule: Machine-readable command output is a product contract
JSON output is not incidental formatting. Stable envelopes and task fields are a compatibility commitment for automation and GitHub Action workflows.

• Failure Mode: Command overlap confusion (`fix` vs `apply`)
If docs do not clearly separate `fix` (convenience direct remediation) from `apply` (bounded plan-task execution), users and agents can choose the wrong interface and build brittle automation.

• Pattern: AI-operable repository interface
Playbook commands expose repository structure, health, and architecture so AI agents can reason about a codebase without reading the entire source tree.

• Pattern: CLI Command Architecture
Commands live under `packages/cli/src/commands` with a central registry at `packages/cli/src/commands/index.ts`, while shared helpers stay under `packages/cli/src/lib`.

Example structure:
```
commands/
  analyze.ts
  doctor.ts
  diagram.ts
  upgrade.ts
lib/
  shared utilities
```

This pattern prevents CLI sprawl and improves command discoverability for contributors and AI agents.

• Principle: Machine-readable developer workflows
Developer workflows should be executable commands rather than only written documentation.

• Insight: Documentation must remain synchronized with implementation for AI-assisted development systems to remain reliable.

- WHAT changed: Removed `cache: pnpm` and `cache-dependency-path: pnpm-lock.yaml` from the `Setup Node.js` step in `.github/actions/playbook-ci/action.yml`.
- WHY it changed: `actions/setup-node` expects a `pnpm` executable to already exist when pnpm caching is enabled, but this workflow intentionally activates deterministic pnpm (`pnpm@10.0.0`) later via Corepack.

- WHAT changed: Replaced `tsup` build steps in `packages/core`, `packages/engine`, and `packages/node` with `pnpm exec tsc -p tsconfig.build.json`, updating each package to emit both ESM JavaScript and declaration files directly into `dist/`.
- WHY it changed: Removing tsup from these packages eliminates Rollup optional native module resolution (`@rollup/rollup-linux-x64-gnu`) from CI build paths while keeping stable `dist/index.js` and `dist/index.d.ts` entry artifacts.

- WHAT changed: Replaced the CLI build pipeline in `packages/cli` from `tsup` to `tsc -p tsconfig.build.json`, removed `packages/cli/tsup.config.ts`, and removed `tsup` from `packages/cli/package.json` devDependencies.
- WHY it changed: CLI bundling was pulling Rollup optional native platform modules into the critical CI path; plain TypeScript compilation emits deterministic `dist/main.js` output without Rollup optional dependency resolution failures.

- WHAT changed: Added a shebang (`#!/usr/bin/env node`) to `packages/cli/src/main.ts` so the compiled `dist/main.js` remains directly executable as the package bin entry.
- WHY it changed: `playbook` still resolves to `dist/main.js` via package `bin`, and the shebang preserves identical CLI execution behavior after moving away from the tsup banner.

- WHAT changed: Updated `.github/actions/playbook-ci/action.yml` to run the CLI smoke invocation via `pnpm -C "$GITHUB_WORKSPACE/packages/cli" run playbook -- --help` instead of `node packages/cli/dist/cli.js --help`.
- WHY it changed: CI was targeting a non-existent `dist/cli.js` file; invoking the package script ensures the published entrypoint (`dist/main.js`/`bin`) is exercised correctly from any configured working directory.

- WHAT changed: Pinned pnpm in CI with Corepack (`corepack enable`, `corepack prepare pnpm@10.0.0 --activate`), forced npm/pnpm registry to `https://registry.npmjs.org/`, and added install-environment diagnostics prior to install.
- WHY it changed: Eliminates pnpm version/registry drift that can suppress optional native dependency installation and now prints deterministic version/registry/config-path diagnostics before `pnpm install`.

- WHAT changed: Removed root-level pnpm Rollup alias overrides that remapped `rollup` and `@rollup/rollup-linux-x64-gnu` to `@rollup/wasm-node`.
- WHY it changed: The alias forced CI to fetch `@rollup/wasm-node` and produced unstable install behavior (`ERR_PNPM_FETCH_403`, missing native Rollup module resolution), so dependencies now resolve through normal platform packages.

- WHAT changed: Added `scripts/assert-install-env.mjs` and wired it to root `preinstall` so installs fail fast when registry or optional dependency settings drift.
- WHY it changed: CI and local installs now emit focused diagnostics (including npm user/global config file paths) before dependency resolution when registry/optional settings would break deterministic installs.

- WHAT changed: Updated `scripts/prepare.mjs` to skip lifecycle builds in CI and avoid full-workspace builds during install hooks.
- WHY it changed: Prevents unexpected `pnpm -r build` execution during lifecycle events while preserving explicit CLI packaging builds via package-level publish scripts.

- WHAT changed: Main CI remains offline-first with canonical end-to-end coverage through `scripts/smoke-test.mjs`; optional `playbook-demo` validation now lives in manual/nightly `.github/workflows/demo-integration.yml` and never blocks merges.
- WHY it changed: Avoids proxy/network clone failures in required CI while retaining a best-effort external integration signal.

- WHAT changed: Added a reusable GitHub composite action at `actions/verify/action.yml` and documented copy/paste workflow usage in `README.md` for `uses: <OWNER>/playbook/actions/verify@v0.1.0`.
- WHY it changed: Enables any repository to run the published Playbook CLI verification in CI without depending on repository-local scripts.

- WHAT changed: Added explicit CI/development governance docs (`docs/CHANGELOG.md`, `README.md`, and `docs/PROJECT_GOVERNANCE.md`).
- WHY it changed: Clarifies CI guarantees, local verification workflow, and notes-on-changes expectations for contributors.

- WHAT changed: Tracked `pnpm-lock.yaml` in git and updated CI lockfile failure messaging in `.github/actions/playbook-ci/action.yml`.
- WHY it changed: Fixes frozen-lockfile drift failures by ensuring the lockfile is committed and gives contributors a clear remediation command.

- WHAT changed: Added deterministic CI workflow (`.github/workflows/ci.yml`), explicit npm registry config (`.npmrc`), and a strict root `verify` script.
- WHY it changed: Keeps installs reproducible in CI and makes pull-request validation fail fast on real build/test/smoke regressions.

- WHAT changed: Implemented deterministic analyze formatters (human/ci/json), wired `pnpm playbook analyze --ci|--json`, and added snapshot tests for formatter stability.
- WHY it changed: Provides high-signal output for developers and CI while preventing accidental formatting contract regressions.

- WHAT changed: Wired `.github/workflows/ci.yml` to run the reusable `./.github/actions/playbook-ci` composite action and aligned demo integration docs to `ZachariahRedfield/playbook/actions/verify@main` with Node 22 + `--ci` inputs.
- WHY it changed: Removes CI/documentation drift and placeholder adoption wiring so governance checks and external usage stay consistent.

- WHAT changed: Removed the standalone `pnpm build` step from `.github/workflows/playbook-diagrams-check.yml` so the workflow runs `pnpm playbook:diagram` (which builds and then runs `node packages/cli/dist/main.js`) before diff validation.
- WHY it changed: Diagrams CI now builds only the Playbook CLI scope needed for diagram generation, avoiding unrelated package build toolchains (including engine/node tsup/rollup paths) that were blocking this workflow.

- WHAT changed: Standardized Playbook npm distribution scope to `@fawxzzy`, replaced Unix-only `sh -c` lifecycle script direction with cross-platform Node-script guidance, and defined GitHub Action distribution as a composite action that runs `pnpm playbook verify --ci`.
- WHY it changed: This keeps onboarding and CI compatible across Windows (PowerShell/CMD) and Unix shells, reflects that unscoped `playbook` is unavailable for `npx`, and lowers adoption friction with a copy/paste CI path that stays product-language/agent/platform-agnostic.

- WHAT changed: Added a centralized CLI command registry (`packages/cli/src/commands/index.ts`) and updated the CLI entrypoint to resolve and run commands through that registry.
- WHY it changed: A single source of truth for command wiring reduces drift between help output and command execution while keeping behavior stable.

- WHAT changed: Added `docs/commands/` with minimal pages for `analyze`, `doctor`, `diagram`, and `upgrade`.
- WHY it changed: Establishes a predictable command-documentation baseline so contributors and AI agents can quickly find usage, flags, and intent.

- WHAT changed: Updated roadmap planning to include near-term CLI/docs cleanup milestones and a future AI Repository Intelligence phase centered on planned `pnpm playbook index` output at `.playbook/repo-index.json`.
- WHY it changed: Keeps foundation-phase delivery focused while documenting the intended machine-readable repository index direction without prematurely implementing it.


## 2026-03-06

- WHAT changed: Reworked the official composite action at `.github/action.yml` to run from checked-out repository source by activating pnpm from `packageManager`, installing with `pnpm install --frozen-lockfile`, building the workspace, and invoking `node packages/cli/dist/main.js` for `verify`, `plan`, and `apply` modes.
- WHY it changed: CI was coupled to `npm install --global @fawxzzy/playbook@latest`, which fails before npm publishing is a deliberate product contract and breaks deterministic automation.
- Rule: Official Playbook GitHub Actions should execute checked-in source until npm publishing is an explicit supported contract.
- Pattern: Prefer repo-local CI execution for deterministic verify/plan/apply workflows during early product hardening.
- Failure Mode: Action workflow assumed npm package availability before release/publish pipeline existed.
- GitHub Action distribution phases: phase 1 = repo-local build/run, phase 2 = optional published-package consumption.

- WHAT changed: Hardened remediation execution by formalizing handler contract semantics (`applied`, `skipped`, `unsupported`, `failed`) and centralizing handler resolution precedence (plugin handlers override built-ins when defined; undefined plugin handlers do not shadow built-ins).
- WHY it changed: Apply is now critical product surface area, so deterministic execution and explicit unsupported/failure signaling reduce ambiguity for CI and AI automation.

## Next Steps

- Merge this PR.
- Tag release `v0.1.2`.
- Push demo repository improvements.
- Add Playbook `verify` GitHub Action later.

## What to Capture in Docs

- Pattern: Developer tool repositories should visibly demonstrate their own capabilities.
- Rule: Automatically generated architecture diagrams should be linked from the README.
- Pattern: CI should regenerate documentation artifacts derived from repository structure.
- Failure Mode: Registry configuration issues may cause npm 403 errors in restricted environments.

- Pattern: Self-Validating Demo
  Playbook maintains a dedicated demo repository that is automatically validated.

- Purpose:
  Ensure the demo repository always demonstrates the correct CLI behavior.

- Validation flow:
  analyze -> verify -> plan -> apply -> verify

- If any step fails, CI fails.

- Pattern: Repository Intelligence Layer
  `.playbook/repo-index.json`

- Rule:
  All architecture visualization and AI integrations must read from the repository index.

- Failure Mode:
  Multiple commands independently analyzing the repo instead of sharing the index.


- Rule: Demo Validation Must Use Local CLI

Demo validation must execute the locally built Playbook CLI
rather than installing the CLI from npm.

Reason:
CI validates the current repository state, not a published version.

Implementation:
pnpm playbook <command>

- Pattern: Index-backed query validation
  For every query subcommand contract, include one known indexed target success, one or more non-indexed deterministic failures, and `--json` validation from the built CLI artifact.

- Pattern: Contract-backed scoring inputs
  Deterministic scoring surfaces should source each material signal from persisted artifacts/contracts over heuristic attribution when possible.

- Failure Mode: False precision from heuristic inputs
  Stable output formatting can hide weak internal attribution. Persist module-scoped verify attribution as first-class contract data to keep risk scores explainable and automation-safe.


• Pattern: Deterministic Workspace Command Execution
Automation, CI, and AI agents should invoke workspace commands using directory targeting rather than pnpm workspace filters.

Use:

```bash
pnpm -C <workspace-path> <command>
```

instead of:

```bash
pnpm --filter <package-name> <command>
```

Reason:
Workspace filters rely on package names that may change or be incorrectly guessed by automation. Directory targeting is stable and deterministic.

- Pattern: Two-tier backlog system
  Keep emerging ideas in `docs/PLAYBOOK_IMPROVEMENTS.md` and move only prioritized, committed capabilities into `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.

- Pattern: Improvement backlog rotation
  Keep the active improvement backlog concise and rotate completed or stale items into timestamped archive files under `docs/archive/`.

- Rule: Playbook analyzes but does not author
  Playbook provides architecture intelligence, diagnostics, and recommendations, but does not automatically author pull requests or rewrite developer intent.

- Lifecycle: Idea → Improvement → Roadmap → Archive
  Product opportunities should progress through explicit lifecycle stages so the roadmap remains focused while historical intelligence is preserved.

- Future feature: `pnpm playbook analyze-pr`
  Add pull-request intelligence that reports affected modules, risk, boundary violations, and missing tests/docs.

- Future feature: `pnpm playbook query impact`
  Add deterministic change blast-radius analysis for a target module.

## Documentation governance patterns

- Pattern: Documentation governance should be executable through Playbook commands rather than enforced only through prose.
- Pattern: `pnpm playbook docs audit` turns documentation architecture into a deterministic repository contract.
- Rule: Playbook repositories should have a single strategic roadmap and a separate improvement backlog.
- Rule: Idea/planning content belongs in approved planning surfaces, not scattered across runtime or workflow docs.
- Pattern: AI working inside the Playbook repo should run docs audit alongside other branch-accurate local CLI validations.
- Failure Mode: Documentation responsibility drift occurs when roadmap, backlog, workflow, and notes content begin overlapping again.
- Failure Mode: Cleanup guidance becomes duplicated when one-off migration docs remain active after governance rules have been formalized.

## Repository memory system doctrine notes

- Pattern: Fast Episodic Store, Slow Doctrine Store
- Pattern: Structural Graph + Memory Graph/Index
- Rule: Promotion Required for Durable Doctrine
- Rule: Replay Is Human-Review-Oriented, Not Autonomous Mutation
- Failure Mode: Memory Hoarding
- Failure Mode: Rebuilding Durable Memory From Current Repo State Only
