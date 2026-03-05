# Playbook Notes

- WHAT changed: Replaced `tsup` build steps in `packages/core`, `packages/engine`, and `packages/node` with `pnpm exec tsc -p tsconfig.build.json`, updating each package to emit both ESM JavaScript and declaration files directly into `dist/`.
- WHY it changed: Removing tsup from these packages eliminates Rollup optional native module resolution (`@rollup/rollup-linux-x64-gnu`) from CI build paths while keeping stable `dist/index.js` and `dist/index.d.ts` entry artifacts.

- WHAT changed: Replaced the CLI build pipeline in `packages/cli` from `tsup` to `tsc -p tsconfig.build.json`, removed `packages/cli/tsup.config.ts`, and removed `tsup` from `packages/cli/package.json` devDependencies.
- WHY it changed: CLI bundling was pulling Rollup optional native platform modules into the critical CI path; plain TypeScript compilation emits deterministic `dist/main.js` output without Rollup optional dependency resolution failures.

- WHAT changed: Added a shebang (`#!/usr/bin/env node`) to `packages/cli/src/main.ts` so the compiled `dist/main.js` remains directly executable as the package bin entry.
- WHY it changed: `playbook` still resolves to `dist/main.js` via package `bin`, and the shebang preserves identical CLI execution behavior after moving away from the tsup banner.

- WHAT changed: Updated `.github/actions/playbook-ci/action.yml` to run the CLI smoke invocation via `pnpm --dir "$GITHUB_WORKSPACE" --filter @fawxzzy/playbook run playbook -- --help` instead of `node packages/cli/dist/cli.js --help`.
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

- WHAT changed: Implemented deterministic analyze formatters (human/ci/json), wired `playbook analyze --ci|--json`, and added snapshot tests for formatter stability.
- WHY it changed: Provides high-signal output for developers and CI while preventing accidental formatting contract regressions.

- WHAT changed: Wired `.github/workflows/ci.yml` to run the reusable `./.github/actions/playbook-ci` composite action and aligned demo integration docs to `ZachariahRedfield/playbook/actions/verify@main` with Node 22 + `--ci` inputs.
- WHY it changed: Removes CI/documentation drift and placeholder adoption wiring so governance checks and external usage stay consistent.

- WHAT changed: Removed the standalone `pnpm build` step from `.github/workflows/playbook-diagrams-check.yml` so the workflow only runs `pnpm playbook:diagram` before diff validation.
- WHY it changed: Diagrams CI now builds only the Playbook CLI scope needed for diagram generation, avoiding unrelated package build toolchains (including engine/node tsup/rollup paths) that were blocking this workflow.
