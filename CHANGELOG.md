# Changelog

## Unreleased

### WHAT

- Strengthened `pnpm playbook apply --from-plan` plan loading to decode UTF-8 (with/without BOM) and UTF-16 (LE/BE BOM) artifacts, including conservative UTF-16 detection when shell redirection emits NUL-patterned output.
- Improved invalid plan JSON diagnostics to preserve file path context and provide actionable shell-encoding guidance when payload bytes suggest PowerShell-style encoding artifacts.
- Updated workflow docs with explicit PowerShell-safe plan capture examples and branch-local `node packages/cli/dist/main.js` commands for deterministic local validation.
- Added PR-based `playbook-demo` refresh automation via `scripts/demo-refresh.mjs` and `.github/workflows/demo-refresh.yml`, with allowlisted artifact staging and `PLAYBOOK_CLI_PATH` injection.
- Hardened `scripts/demo-refresh.mjs` for production use by detecting npm/pnpm/yarn refresh command runners from lockfiles, removing `bash -lc` execution in default paths, and adding explicit push-mode git identity + token-auth setup.
- Updated `.github/workflows/demo-refresh.yml` permissions and push-mode environment setup to support reliable branch push + PR create/update in `playbook-demo` while preserving dry-run defaults for schedule/push triggers.
- Normalized `.github/workflows/demo-integration.yml` to a dry-run integration check that reuses the new refresh orchestrator.
- Added companion integration expectations in `docs/integration/PLAYBOOK_DEMO_COMPANION_CHANGES.md` and roadmap anchoring for `PB-V1-DEMO-REFRESH-001`.
- Installed pnpm via `pnpm/action-setup@v4` (without unsupported cache inputs) and added manual pnpm store caching via `actions/cache@v4`.
- Removed legacy `.eslintignore` and rely on flat-config `ignores` in `eslint.config.cjs`.
- Added `pnpm.supportedArchitectures` in the root `package.json` to lock Linux x64 glibc Rollup optional native packages deterministically.
- Added a Linux-only Rollup native resolution sanity check in `.github/actions/playbook-ci/action.yml` before `pnpm verify`.
- Added a `pack:smoke` CI check that packs local tarballs and verifies install + `init`/`analyze`/`verify` against the packaged CLI artifact.
- Updated repository intelligence module discovery for modular-monolith repositories to index `src/features/*` child directories (for example `users`, `workouts`) as first-class modules while preserving workspace precedence and `src/*` fallback behavior.
- Strengthened `scripts/demo-validate.mjs` with explicit demo module-contract checks (`index`, `query modules`, and `explain workouts`) to catch feature-module indexing regressions early.

### WHY

- Prevent Windows/PowerShell plan redirection encoding differences from breaking deterministic `apply --from-plan` workflows while keeping plan contract validation strict.
- Prevent CI/local failures caused by missing `@rollup/rollup-linux-x64-gnu` under frozen lockfile installs.
- Eliminate ESLint v9 flat-config warnings caused by `.eslintignore`.
- Make cross-repo demo refresh automation deterministic across local maintainer and GitHub Actions execution contexts.

## v0.1.1

### WHAT

- Added npm publishing support for Playbook packages under the `@zachariahredfield/*` scope, including the CLI package `@zachariahredfield/playbook`.
- Added a tag-triggered npm publish workflow at `.github/workflows/publish-npm.yml`.
- Added a reusable verify composite action at `.github/actions/verify/action.yml` and aligned `actions/verify/action.yml` to the scoped package.
- Updated README onboarding to a true 30-second `npx` path and added a copy/paste GitHub Action usage snippet.
- Added `docs/RELEASING.md` with release, tagging, and publish steps.

### WHY

- Make `npx @zachariahredfield/playbook ...` work out of the box.
- Provide a reliable, tag-based release path for npm publication.
- Give teams a polished GitHub Action integration path that works with published versions.
