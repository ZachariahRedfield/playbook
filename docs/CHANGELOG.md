# Changelog

## Unreleased

### Added

<<<<<<< HEAD
- WHAT: Added first-class `pnpm playbook pilot --repo "<target-repo-path>"` orchestration that deterministically runs `context -> index -> query modules -> verify -> plan`, writes `.playbook/findings.json` and `.playbook/plan.json` directly, emits `.playbook/pilot-summary.json`, and records one top-level runtime cycle with child phases. WHY: Converts a repeated external multi-command baseline workflow into one canonical command to reduce operator drift and prevent helper scripts from becoming shadow product surface.
=======
- WHAT: Refined runtime observability coverage/telemetry contracts with explicit blind-spot accounting (`total_files_seen`, `oversized_files`, `parse_failed_files`), transparent scoring (`eligible_scan_coverage_score`, `repo_visibility_score`, `blind_spot_ratio`), deterministic expensive-path classification, and optimization-ready cycle telemetry summaries (phase counts, reads/writes, fallbacks, category counts). WHY: Prevents false-confidence near-100% scores and creates structured scan-waste signals for future `.playbookignore` recommendation workflows.
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88

- WHAT: Added first-class deterministic JSON artifact emission via `--out` for JSON-producing commands (`verify`, `plan`, `index`, `query`) using shared UTF-8 writer semantics (parent-directory creation, deterministic newline boundaries, and explicit write failures), plus external `--repo` regression coverage. WHY: Prevents shell-redirection corruption from wrapper/banner leakage and encoding drift in machine-consumed artifacts.

- WHAT: Added repo-owned PR metadata fallback (`.playbook/pr-metadata.json`) to roadmap feature-id enforcement and introduced optional PR metadata sync helper (`pnpm pr:sync-metadata`) with warn-only degradation on permission limits. WHY: Makes feature-id governance resilient when GitHub PR title/body cannot be edited by automation tokens while keeping PR metadata as preferred presentation.

- WHAT: Aligned roadmap/docs governance for `PB-V08-KNOWLEDGE-COMPACTION-SPEC-001` to reflect the merged internal deterministic compaction foundations (canonicalization, deterministic bucketing, and deterministic review artifacts). WHY: Keeps roadmap truth, onboarding guidance, and command-state docs synchronized with implementation while explicitly preserving the internal-first boundary (no new public CLI command, promotion/storage still future work).

- WHAT: Hardened the repository-graph substrate by extending `.playbook/repo-graph.json` stats with deterministic node/edge kind breakdowns and aligned `pnpm playbook graph --json` schema coverage. WHY: Makes the graph a reusable contract artifact for automation and read-runtime reuse rather than an ornamental side output.
- WHAT: Added compressed module context digests under `.playbook/context/modules/*.json` during `pnpm playbook index` and reused them in `query impact` / `explain <module>`. WHY: Implements the next thin slice of complexity-through-compression using deterministic local artifacts.
- WHAT: Enriched `ask --repo-context` module-scoped responses to prefer module digest + graph-neighborhood context when available and emit `module-digest`/`repo-graph` provenance sources. WHY: Turns compressed artifacts into immediate AI/runtime reuse instead of generation-only output.

- WHAT: Enforced PB-V1 delivery gates in the reusable Playbook CI action by requiring `node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id` and `pnpm playbook docs audit --ci --json`, and aligned PR/docs workflow guidance to match. WHY: Converts roadmap-as-contract and docs governance from documentation-only guidance into deterministic branch validation.

- WHAT: Added contributor/developer workflow guidance for when to run `pnpm playbook audit architecture`, `pnpm playbook doctor`, and `pnpm playbook docs audit` after merge. WHY: Turns governance commands from merely available into a repeatable team habit before adding heavier CI enforcement.
- WHAT: Hardened `pnpm playbook audit architecture` (v1.1) with standardized `pass|warn|fail` semantics, deterministic ordering guarantees (checks, audit IDs, evidence, and next actions), and richer source-referenced evidence. WHY: Improves operator trust, CI snapshot stability, and actionable diagnostics across environments.
- WHAT: Upgraded architecture checks from presence-only to minimum-quality deterministic validation (artifact schemaVersion, remediation trust boundaries, AI/determinism boundary clarity, adapter isolation, context-efficiency concepts, and tolerant roadmap concept coverage) and integrated architecture-audit findings into `pnpm playbook doctor`. WHY: Raises governance signal quality while keeping command surface stable and non-brittle.

- WHAT: Added deterministic `pnpm playbook audit architecture` with reusable architecture-audit checks and stable `audit-architecture` JSON contract output, plus command/docs coverage updates. WHY: Prevents structural drift by continuously auditing platform hardening guardrails (artifact evolution/versioning, SCM context normalization, remediation trust boundaries, AI/determinism boundaries, ecosystem adapter isolation, context efficiency, and roadmap coverage).

- WHAT: Completed a platform architecture guardrail audit and added explicit architecture/contracts docs for artifact evolution, SCM context normalization, remediation trust boundaries, AI determinism boundaries, ecosystem adapter isolation, and context efficiency strategy. WHY: Keeps foundational reliability constraints explicit and enforceable as Playbook command surface and AI-assisted workflows evolve.

- Added explicit versioned evolution policy for `.playbook/repo-graph.json` to keep graph growth contract-safe for CI and AI consumers.
- Extended existing `query`/`explain` read flows with additive graph neighborhood summaries instead of introducing a broad new graph command surface.
- Enriched repository graph generation with deterministic, low-cost derived relationships (`contains`, `governed_by`) based only on existing index/rule metadata.
- Added/updated contract and snapshot coverage for graph artifact stability and graph-backed read outputs.

- WHAT: Added deterministic Repository Knowledge Graph scaffold artifact `.playbook/repo-graph.json` generated during `pnpm playbook index` and introduced `pnpm playbook graph --json` stable summary output with deterministic missing-artifact guidance. WHY: Establishes the first durable graph substrate for context compression, impact reasoning, and future knowledge distillation features.

- WHAT: Added Repository Knowledge Graph architecture layer to the product roadmap and clarified layer-relative knowledge units plus compression-as-knowledge-reuse principles. WHY: Unifies repository intelligence, context compression, and the repository learning loop under one compounding architecture direction while preserving deterministic execution contracts.

- WHAT: Added Knowledge Distillation Engine direction to the roadmap. WHY: Positions Playbook to store and reuse higher-signal repository knowledge instead of relying on repeated broad scans.

- WHAT: Added Knowledge Distillation Engine architecture direction to roadmap. WHY: Clarifies how repository intelligence, context compression, and the repository learning loop combine into a recursive knowledge compression system for engineering governance.

- Simplified primary CI validation by consolidating repository contract checks to `pnpm -r build`, `pnpm test`, and `pnpm playbook verify --json`, making `pnpm playbook verify` the canonical CI gate for product correctness.
- Added `.github/workflows/maintenance.yml` as an optional scheduled/manual automation-maintenance workflow for `pnpm agents:update`, `pnpm agents:check`, and `pnpm playbook docs audit --json`.

- Added deterministic inline PR diagnostics to `pnpm playbook analyze-pr` contracts via structured `findings` (including optional `file`/`line`, `ruleId`, `severity`, `message`, and `recommendation`) so formatter transports can target changed files without inference drift.
- Added `pnpm playbook analyze-pr --format github-review` to export machine-readable GitHub review annotations (`path`, `line`, `body`) derived directly from canonical analyze-pr findings.
- Extended `.github/workflows/analyze-pr-comment.yml` to transport both sticky summary markdown and synchronized inline review comments (add new diagnostics, skip duplicates, and remove resolved diagnostics) while keeping workflow logic transport-only.
- Fixed PR-comment workflow diff-base resolution by checking out full history (`fetch-depth: 0`) and passing explicit PR base ref (`--base origin/${{ github.base_ref }}`) to `analyze-pr --format github-comment`.
- Fixed PR-comment workflow artifact ordering by running `pnpm playbook index --json` before `analyze-pr --format github-comment`, enforcing producer→consumer contract readiness for `.playbook/repo-index.json`.
- Hardened `.github/workflows/analyze-pr-comment.yml` shell setup by replacing fragile escaped `node -p` quoting with `node -e` packageManager extraction plus `${PM#pnpm@}` version split for `pnpm/action-setup`, preventing bash parse failures in GitHub Actions `run:` blocks.
- Added a dedicated GitHub Actions workflow (`.github/workflows/analyze-pr-comment.yml`) that runs on pull requests, generates canonical PR-summary markdown via `pnpm playbook analyze-pr --format github-comment`, and posts/updates a single sticky Playbook comment using marker `<!-- playbook:analyze-pr-comment -->` (transport-only, no duplicate formatter logic).
- Added deterministic `pnpm playbook query test-hotspots` repository-intelligence output to detect test inefficiency candidates (including broad retrieval followed by narrow filtering) with stable hotspot contracts and safety classifications; MVP reports findings only and does not auto-refactor.
- Added `pnpm playbook analyze-pr` as deterministic, local-first pull request intelligence that composes local git diff context with `.playbook/repo-index.json`, indexed impact/risk/docs/ownership intelligence, and structured review guidance output (`--json`).
- Added `pnpm playbook analyze-pr --format github-comment` as a deterministic export formatter that converts existing analyze-pr JSON contracts into GitHub-ready PR review summary markdown for CI/automation posting, without adding new inference logic.
- Consolidated `analyze-pr` output selection behind a single formatter pipeline (`--format text|json|github-comment`), removed superseded inline PR-summary rendering branches, and added deterministic format-selection coverage.
- Hardened `pnpm playbook doctor --json` as a stable automation contract by explicitly including `artifactHygiene` (`classification`, `findings`, `suggestions`) in command output and schema/contract coverage.
- Added deterministic change-scoped ask reasoning via `pnpm playbook ask --diff-context` (with optional `--base <ref>`) to derive changed files, affected modules, dependent impact, docs touchpoints, and risk signals from local git diff + `.playbook/repo-index.json` without silent full-repo fallback.
- Added deterministic module intelligence surfaces: `pnpm playbook query impact <module>` now returns structured module/dependency/dependent/risk context from `.playbook/repo-index.json`, and `pnpm playbook ask --module <name>` scopes ask reasoning to indexed module context with deterministic missing-index/missing-module guidance.
- WHAT: Added `pnpm playbook ask --repo-context` to inject trusted repository intelligence into ask prompts using Playbook-managed artifacts (`.playbook/repo-index.json` and AI contract metadata), with deterministic missing-index remediation guidance. WHY: Grounds AI repository answers in deterministic Playbook artifacts instead of broad ad-hoc repository inference.

- WHAT: Updated AGENTS/README/command docs to position repo-aware ask in the preferred AI ladder (`ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify/plan/apply`). WHY: Keeps AI operating-contract guidance aligned with command behavior and reduces agent drift.

- WHAT: Added `pnpm playbook ask --mode <normal|concise|ultra>` with deterministic mode contracts and CLI/test/doc updates, including mode-aware output shaping and mode instruction metadata in JSON responses. WHY: Improves AI-assisted developer ergonomics by letting users tune answer density for onboarding (`normal`) or fast decisions (`concise`/`ultra`).

- WHAT: Added deterministic ask context-source provenance in `pnpm playbook ask --json` via `context.sources` so responses expose machine-readable source descriptors (repo index, module scope, diff files, docs references, rule registry, and AI contract hydration metadata) without leaking raw repository content. WHY: Makes ask reasoning auditable for AI agents, CI reporting, governance workflows, and dashboard/runtime integrations.
- Pattern: Ask Context Provenance — Playbook ask should expose deterministic metadata describing which repository intelligence sources informed an answer.
- Rule: Provenance metadata must include only source descriptors, not raw repository content.
- Pattern: Auditable AI Reasoning — governance tools should expose evidence sources so automation can validate reasoning.
- Failure Mode: Opaque AI reasoning prevents CI and agent integrations from trusting governance outputs.

- Docs: added a future-facing Automation Synthesis capability track to the product roadmap, documented long-term architecture alignment for synthesis stages (triggering through rollback), and introduced `docs/AUTOMATION_SYNTHESIS_VISION.md` as the product-aligned design reference.

- WHAT: Added a cross-document storage/runtime artifact contract clarifying `.playbook/` local runtime boundaries, commit guidance for generated artifacts, demo snapshot-contract positioning, and private-first/local-first behavior (plus roadmap/improvement direction for `.playbookignore`, retention policy, scan exclusions, and history-bloat prevention). WHY: Makes artifact lifecycle expectations explicit so teams avoid recommitting regenerated runtime state, keep repository history healthy, and preserve deterministic docs/contracts intent.

- Added deterministic AI contract readiness validation to `pnpm playbook doctor --ai`, including contract availability/validity checks, intelligence source validation, required command/query surface checks, remediation workflow readiness, and expanded JSON contract fields for readiness details.

- Added a security contract system under `docs/contracts/security/` with machine-readable definitions for repository boundary, apply scope, plan determinism, secret redaction, and policy gate guarantees.
- Added deterministic security contract tests under `test/contracts/security/` and expanded `pnpm test:security` to run contract + regression suites.
- Integrated security contract verification into CI via the reusable Playbook CI composite action.
- WHAT: Hardened Cosign keyless verification by adding `--certificate-identity-regexp "https://github.com/.+"` and `--certificate-oidc-issuer https://token.actions.githubusercontent.com` to SBOM verify step. WHY: Cosign keyless verification requires explicit trusted identity and issuer, otherwise verification fails even with a valid bundle.

- WHAT: Migrated SBOM signing/verification to Cosign v3 bundle flow (`cosign sign-blob --bundle` and `cosign verify-blob --bundle`) and updated security policy gating to require `artifacts/sbom.sigstore.json`. WHY: `--output-signature` is deprecated in Cosign v3 bundle mode and can fail CI despite valid artifacts.

- WHAT: Pinned Cosign installer to `sigstore/cosign-installer@v4.0.0` (with explicit `cosign-release`) and added an in-pipeline `cosign verify-blob` step after signing SBOM artifacts. WHY: Avoids mutable action tag drift and fails CI if signature generation/verification breaks or artifact integrity is compromised.

- WHAT: Replaced npm-based Cosign invocation in the security workflow with the official `sigstore/cosign-installer@v4` + `cosign sign-blob` sequence while retaining keyless signing permissions. WHY: Cosign is a standalone CLI and must be installed explicitly in GitHub Actions for reliable signing.

- WHAT: Hardened SBOM generation in security CI by adding CycloneDX `--ignore-npm-errors`, pinned output to spec v1.5, and added an Anchore SBOM scan stage against `artifacts/sbom.json`. WHY: Prevents pnpm workspace false-failures from npm tree warnings while improving automated supply-chain vulnerability detection.

- WHAT: Hardened the security workflow checkout strategy by setting `actions/checkout@v4` to `fetch-depth: 0` before gitleaks and documented CI diff-scanner history guarantees in `docs/SECURITY_PRINCIPLES.md`. WHY: Prevents shallow-history PR scan failures like `fatal: ambiguous argument "<sha>^..<sha>"` while keeping secret scanning deterministic.

- WHAT: Added an automated Security Program baseline across roadmap/principles/CI/runtime guardrails with repo-boundary validation, remediation plan policy checks, secret-redacted apply errors, security regression tests, and a dedicated `security.yml` pipeline for audit, secret scanning, SBOM, signing, provenance, and policy gating. WHY: Makes Playbook security continuous and deterministic across runtime and release workflows rather than manual spot checks.

- Docs: captured deterministic engineering reasoning loop insight and interface/runtime governance pattern across `docs/PLAYBOOK_IMPROVEMENTS.md` and `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.

- Docs: captured repository memory system direction and the conversation-to-knowledge pipeline in `docs/PLAYBOOK_IMPROVEMENTS.md`, with roadmap alignment notes for durable engineering memory in `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.

- Consolidated documentation planning architecture by standardizing `docs/PLAYBOOK_PRODUCT_ROADMAP.md` as the single strategic roadmap, refreshing `docs/PLAYBOOK_IMPROVEMENTS.md` as the idea backlog, adding `docs/archive/` for backlog rotation, and clarifying documentation responsibilities/process boundaries across workflow and index docs.

- Added deterministic AI repository contract support via `pnpm playbook ai-contract` with `.playbook/ai-contract.json` as the canonical AI-operability artifact, including generated fallback behavior, schema support (`pnpm playbook schema ai-contract`), and command-level tests.

- Standardized workspace command execution across Playbook by replacing pnpm workspace filters with deterministic directory targeting (`pnpm -C packages/<workspace>`), preventing automation and agent failures caused by incorrect workspace package name resolution.

- Added deterministic architectural risk analysis via `pnpm playbook query risk <module>` with explainable weighted signals (`fanIn`, `impact`, `verifyFailures`, `hub`) and stable JSON/text output.
- Added deterministic documentation coverage analysis via `pnpm playbook query docs-coverage [module]` to identify documented and under-documented modules from repository intelligence and docs heuristics.
- Added query schema contract coverage for risk payloads via `pnpm playbook schema query`.
- Added deterministic rule ownership intelligence via `pnpm playbook query rule-owners [rule-id]` with explicit owner/area/remediation metadata for routing and remediation workflows.
- Added deterministic module ownership intelligence via `pnpm playbook query module-owners [module]` backed by explicit `.playbook/module-owners.json` mappings with deterministic fallbacks for unmapped modules.

- `pnpm playbook ai-context` command providing a concise AI bootstrap interface for repository intelligence.
- Documentation updates aligning Playbook with an AI-first repository workflow.

- WHAT: Added a shared managed-docs generator (`scripts/update-managed-docs.mjs`) and wired `pnpm docs:update`/`pnpm docs:check` (plus `agents:*` aliases) so both `AGENTS.md` and `docs/commands/README.md` are generated from shared command metadata. WHY: Prevents command-surface documentation drift by making stale managed sections fail deterministic checks.

- WHAT: Hardened CLI contract tests for cross-platform determinism by normalizing CRLF/LF snapshot comparisons and removing POSIX-only path assumptions in `apply` missing-plan assertions. WHY: Keeps strict JSON and error-contract coverage intact while preventing Windows-vs-Unix newline/path formatting from causing false negatives.

- WHAT: Enhanced `pnpm playbook session cleanup` with an explicit knowledge hygiene pipeline (`--hygiene`) that normalizes, deduplicates, truncates, prunes junk placeholders, and emits structured cleanup reports (including `--json-report`). WHY: Reduces session junk accretion while preserving deterministic, auditable local-first behavior.

- WHAT: Synced product-state docs to the current command surface by adding an authoritative command index (`docs/commands/README.md`), aligning README/CLI reference/demo docs/roadmap language around `analyze`, `verify`, `rules`, `doctor`, `diagram`, `plan`, `apply`, the implemented AI/repository-intelligence surface (`ai-context`, `index`, `query`, `deps`, `ask`, `explain`), and the `playbook-demo` artifact. WHY: Prevents AI/human command-surface drift and keeps roadmap + onboarding + command docs consistent with implemented behavior.
- WHAT: Added a `playbook-diagrams` GitHub Actions workflow that regenerates `docs/ARCHITECTURE_DIAGRAMS.md` on `main` pushes for architecture-relevant paths and auto-commits only that file, plus README architecture automation guidance. WHY: Keeps architecture docs deterministic and continuously synced to repository state without manual updates.
- WHAT: Added a first-class `pnpm playbook demo` command with deterministic text and JSON onboarding contracts, registered it in CLI help/command registry, added command tests, and documented the CLI-first demo discovery path. WHY: Makes the demo repository discoverable from the product surface and gives humans/agents a stable side-effect-free onboarding workflow without environment-dependent behavior.
- WHAT: Bumped root toolchain pin from `pnpm@10.0.0` to `pnpm@10.23.0` and updated CI Corepack activation to read `package.json#packageManager` in reusable and diagram workflows. WHY: Keeps pnpm provisioning deterministic while reducing version drift risk across local and CI runs.
- WHAT: Added a minimal root `.gitattributes` (LF for lockfile/shell/scripts/yaml), made smoke-test runtime/path logging explicit, and added a smoke assertion for bundled `packages/cli/dist/templates/repo`. WHY: Prevents cross-platform lockfile EOL churn and keeps CI/package init behavior deterministic with clearer diagnostics.
- WHAT: CLI builds now copy `templates/repo` into `packages/cli/dist/templates/repo` via a post-`tsc` step. WHY: `tsc` does not copy non-TypeScript assets, which caused `pnpm playbook init` smoke tests and packaged CLI runs to fail with missing templates.
- WHAT: Fixed reusable CI pnpm caching by installing pnpm with `pnpm/action-setup@v4` before enabling pnpm store cache, while preserving split `pnpm lint`, `pnpm test`, and optional `pnpm smoke:ci` steps. WHY: Prevents `Unable to locate executable file: pnpm` failures from setup-node pnpm cache initialization and keeps CI output readable by phase.
- WHAT: Simplified reusable CI caching by switching to `actions/setup-node` built-in `cache: pnpm`, and split verification logs into explicit `pnpm lint`, `pnpm test`, and optional `pnpm smoke:ci` steps. WHY: Reduces cache/config drift while making CI failures faster to triage from step-level output.
- WHAT: CI now forces optionalDependencies on during install (`pnpm install --config.optional=true`) and emits early optional-config diagnostics in the reusable CI action. WHY: Prevents missing platform-native optional packages (rollup/esbuild class) from causing opaque build failures while preserving frozen-lockfile installs.
- WHAT: Switched package declaration generation to `tsc --emitDeclarationOnly` while keeping `tsup` for JavaScript bundling in `engine/core/node` and disabled CLI declaration bundling. WHY: Avoids Rollup native optional module resolution failures (`@rollup/rollup-linux-x64-gnu`) and keeps frozen-lockfile CI builds deterministic.
- WHAT: Bundled the CLI into a single ESM artifact (`dist/main.js`) with internal workspace packages inlined and removed runtime package dependencies from `@fawxzzy/playbook`. WHY: Makes `pnpm playbook analyze` runnable in offline/limited-registry environments without fetching `@zachariahredfield/*` packages.
- WHAT: Force rollup to wasm-node via pnpm override (`rollup` -> `npm:@rollup/wasm-node@4.59.0`) plus lockfile refresh. WHY: CI runners fail to install rollup's native optional binaries reliably; wasm eliminates platform module dependency.
- WHAT: Added a root `pack:cli` workflow and documented tgz-based `npx` testing through `pnpm pack` from `packages/cli`. WHY: Ensures local tarball testing mirrors publish behavior and verifies packaged artifacts do not leak `workspace:*` dependency specifiers.
- WHAT: Made `pnpm playbook:diagram` self-contained by building `playbook` plus its workspace dependencies first (`--filter playbook... run build`) and invoking the packaged CLI entrypoint (`dist/cli.js`) instead of the stale `dist/main.js` path. WHY: Fixes fresh-checkout CI failures (`MODULE_NOT_FOUND`) by removing reliance on prebuilt artifacts and matching the published `bin.playbook` target.
- WHAT: Refactored the workspace into a platform-style split with `packages/core` (pure analyze/verify engine), `packages/node` (Node context adapter), and a thinner `packages/cli` command layer wired through the adapter while preserving command behavior/output contracts. WHY: Clarifies architecture boundaries, makes the engine portable across runtimes, and prepares Playbook for future adapters without coupling policy logic to filesystem/process APIs.
- WHAT: Updated CLI packaging to ship `bin.playbook -> dist/cli.js`, added a `prepare` build fallback (`pnpm` then `npm`), and aligned smoke/CI scripts to the new entrypoint including tarball verification. WHY: Ensures install/publish reliability and keeps CI/published artifacts consistent with the intended CLI surface.
- WHAT: Removed any required CI dependency on cloning `ZachariahRedfield/playbook-demo` and kept `scripts/smoke-test.mjs` as the canonical offline integration path run via the reusable Playbook CI action. WHY: Keeps PR CI deterministic and fully functional in restricted proxy/offline environments while still validating real CLI init/verify behavior end-to-end.
- WHAT: Added an optional `demo-integration` workflow (`.github/workflows/demo-integration.yml`) that runs on manual dispatch/nightly and performs a best-effort `playbook-demo` clone plus `pnpm playbook analyze --ci` with warning-only behavior on network failure. WHY: Preserves external integration signal without making outbound network access a merge-blocking requirement.
- WHAT: Hardened smoke-test diagnostics so expected `verify` pre-notes failure stays quiet, but unexpected pass now includes captured command output in the thrown error. WHY: Improves CI debugging signal while keeping routine smoke logs low-noise.
- WHAT: Updated `.github/workflows/ci.yml` to call the reusable `./.github/actions/playbook-ci` composite action with Node 22, frozen-lockfile installs, and smoke enabled as the single CI entrypoint. WHY: Eliminates drift between documented CI behavior and actual workflow execution while keeping Playbook CI deterministic and reusable.
- WHAT: Updated `playbook-demo` integration guidance to use the real verify action reference `ZachariahRedfield/playbook/actions/verify@main` with explicit Node 22 + `--ci` inputs. WHY: Removes placeholder adoption steps and makes external verification wiring copy/paste-ready.

## v0.3.0

- WHAT: Added deterministic architecture diagram generation (Mermaid) via a new `pnpm playbook diagram` command and engine scanning/generation modules for structure and internal dependency views. WHY: Helps developers and AI agents understand repository boundaries quickly without changing existing `init/analyze/verify` behavior.
- WHAT: Added diagram documentation and agent guidance (`docs/DIAGRAMS.md`, `docs/AI_AGENT_CONTEXT.md`) and a CI drift check workflow for generated diagrams. WHY: Keeps architecture documentation reproducible and continuously up to date in pull requests.

- WHAT: Documented a pnpm-first toolchain and distribution doctrine across roadmap/governance/development/readme docs, including the single-source pnpm version rule (`package.json#packageManager`), GitHub Action distribution plan, and `playbook-demo` onboarding path. WHY: Prevents CI/local pnpm version drift, makes contributor setup deterministic, and reduces adoption friction through clear CLI + Action entry points.
- WHAT: Added a reusable composite action at `actions/verify/action.yml` that runs `npx --yes playbook@<version> verify` with configurable `playbook_version`, `node_version`, and `args` inputs, plus README usage documentation. WHY: Lets any repository invoke published Playbook verification directly via `uses: <OWNER>/playbook/actions/verify@<ref>` without relying on this repo's local scripts.
- WHAT: CI Pipeline Added with a deterministic GitHub Actions workflow (`checkout -> setup-node@22 -> pnpm/action-setup@v4 -> pnpm install --frozen-lockfile -> pnpm -w build -> pnpm -w verify`) plus root `.npmrc` registry pinning. WHY: Ensures every push/PR uses reproducible installs and consistent build/verify behavior while reducing pnpm/corepack/registry drift failures.
- WHAT: `pnpm playbook analyze` now uses a Stripe-grade formatter for human, `--ci`, and `--json` output with deterministic severity ordering and snapshot coverage. WHY: Improves readability in seconds, keeps CI output low-noise, and protects output contracts from regressions.
- WHAT: Removed an unused `resolveTemplatesRepoDir()` helper and its related `node:path`/`node:url` imports from the CLI entrypoint. WHY: Fixes CI lint failure from `@typescript-eslint/no-unused-vars` while keeping lint rules strict.
- WHAT: CI now runs through the reusable `.github/actions/playbook-ci` composite action (`setup -> install -> build -> test -> smoke`). WHY: Keeps CI behavior consistent and reusable across repositories that adopt Playbook.
- WHAT: CI disables Corepack and provisions pnpm with `pnpm/action-setup`. WHY: Avoids pnpm download failures caused by Corepack behavior in constrained proxy/network environments.
- WHAT: CI installs dependencies with `pnpm install --frozen-lockfile`. WHY: Enforces deterministic installs and prevents lockfile drift.
- WHAT: Verify diff-base selection falls back to `HEAD~1` when `merge-base(main, HEAD) == HEAD`. WHY: Prevents empty diffs after commits on `main`, so the notes-on-changes gate still evaluates real changes.
- WHAT: Smoke testing validates the built CLI (`packages/cli/dist/main.js`) and exercises `init` + `verify` behavior. WHY: Confirms shipped CLI behavior end-to-end, not only typechecks/unit tests.

## Unreleased

### Added

- WHAT: Hardened the repository-graph substrate by extending `.playbook/repo-graph.json` stats with deterministic node/edge kind breakdowns and aligned `pnpm playbook graph --json` schema coverage. WHY: Makes the graph a reusable contract artifact for automation and read-runtime reuse rather than an ornamental side output.
- WHAT: Added compressed module context digests under `.playbook/context/modules/*.json` during `pnpm playbook index` and reused them in `query impact` / `explain <module>`. WHY: Implements the next thin slice of complexity-through-compression using deterministic local artifacts.
- WHAT: Enriched `ask --repo-context` module-scoped responses to prefer module digest + graph-neighborhood context when available and emit `module-digest`/`repo-graph` provenance sources. WHY: Turns compressed artifacts into immediate AI/runtime reuse instead of generation-only output.

- Added explicit versioned evolution policy for `.playbook/repo-graph.json` to keep graph growth contract-safe for CI and AI consumers.
- Extended existing `query`/`explain` read flows with additive graph neighborhood summaries instead of introducing a broad new graph command surface.
- Enriched repository graph generation with deterministic, low-cost derived relationships (`contains`, `governed_by`) based only on existing index/rule metadata.
- Added/updated contract and snapshot coverage for graph artifact stability and graph-backed read outputs.

- Added deterministic inline PR diagnostics to `pnpm playbook analyze-pr` contracts via structured `findings` (including optional `file`/`line`, `ruleId`, `severity`, `message`, and `recommendation`) so formatter transports can target changed files without inference drift.
- Added `pnpm playbook analyze-pr --format github-review` to export machine-readable GitHub review annotations (`path`, `line`, `body`) derived directly from canonical analyze-pr findings.
- Extended `.github/workflows/analyze-pr-comment.yml` to transport both sticky summary markdown and synchronized inline review comments (add new diagnostics, skip duplicates, and remove resolved diagnostics) while keeping workflow logic transport-only.
- Fixed PR-comment workflow diff-base resolution by checking out full history (`fetch-depth: 0`) and passing explicit PR base ref (`--base origin/${{ github.base_ref }}`) to `analyze-pr --format github-comment`.
- Fixed PR-comment workflow artifact ordering by running `pnpm playbook index --json` before `analyze-pr --format github-comment`, enforcing producer→consumer contract readiness for `.playbook/repo-index.json`.
- Hardened `.github/workflows/analyze-pr-comment.yml` shell setup by replacing fragile escaped `node -p` quoting with `node -e` packageManager extraction plus `${PM#pnpm@}` version split for `pnpm/action-setup`, preventing bash parse failures in GitHub Actions `run:` blocks.
- Added deterministic `pnpm playbook query test-hotspots` repository-intelligence output to detect test inefficiency candidates (including broad retrieval followed by narrow filtering) with stable hotspot contracts and safety classifications; MVP reports findings only and does not auto-refactor.
- Added `pnpm playbook analyze-pr` as deterministic, local-first pull request intelligence that composes local git diff context with `.playbook/repo-index.json`, indexed impact/risk/docs/ownership intelligence, and structured review guidance output (`--json`).
- Added `pnpm playbook analyze-pr --format github-comment` as a deterministic export formatter that converts existing analyze-pr JSON contracts into GitHub-ready PR review summary markdown for CI/automation posting, without adding new inference logic.
- Hardened `pnpm playbook doctor --json` as a stable automation contract by explicitly including `artifactHygiene` (`classification`, `findings`, `suggestions`) in command output and schema/contract coverage.
- Added deterministic change-scoped ask reasoning via `pnpm playbook ask --diff-context` (with optional `--base <ref>`) to derive changed files, affected modules, dependent impact, docs touchpoints, and risk signals from local git diff + `.playbook/repo-index.json` without silent full-repo fallback.
- Added a security contract system under `docs/contracts/security/` with machine-readable definitions for repository boundary, apply scope, plan determinism, secret redaction, and policy gate guarantees.
- Added deterministic security contract tests under `test/contracts/security/` and expanded `pnpm test:security` to run contract + regression suites.
- Integrated security contract verification into CI via the reusable Playbook CI composite action.
- Added `pnpm playbook docs audit` with deterministic checks for required doc anchors, single-roadmap policy, idea leakage, responsibility boundaries, archive hygiene, and cleanup de-duplication reporting.
- Added JSON schema support for `pnpm playbook docs audit --json` via `pnpm playbook schema docs`.
- Integrated docs audit into Playbook CI and agent-facing validation guidance.
- Completed first docs-governance cleanup pass by removing idea leakage from runtime/workflow/index docs, archiving superseded migration reporting, and deleting obsolete roadmap-update migration guidance.
