# Playbook Notes

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
