# Playbook Notes

- WHAT changed: Added explicit CI/development governance docs (`docs/CHANGELOG.md`, `README.md`, and `docs/PROJECT_GOVERNANCE.md`).
- WHY it changed: Clarifies CI guarantees, local verification workflow, and notes-on-changes expectations for contributors.

- WHAT changed: Tracked `pnpm-lock.yaml` in git and updated CI lockfile failure messaging in `.github/actions/playbook-ci/action.yml`.
- WHY it changed: Fixes frozen-lockfile drift failures by ensuring the lockfile is committed and gives contributors a clear remediation command.

- WHAT changed: Added deterministic CI workflow (`.github/workflows/ci.yml`), explicit npm registry config (`.npmrc`), and a strict root `verify` script.
- WHY it changed: Keeps installs reproducible in CI and makes pull-request validation fail fast on real build/test/smoke regressions.

- WHAT changed: Implemented deterministic analyze formatters (human/ci/json), wired `playbook analyze --ci|--json`, and added snapshot tests for formatter stability.
- WHY it changed: Provides high-signal output for developers and CI while preventing accidental formatting contract regressions.
