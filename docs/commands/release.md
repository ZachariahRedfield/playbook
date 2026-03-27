# `pnpm playbook release plan`

`pnpm playbook release plan --json --out .playbook/release-plan.json` builds a deterministic reviewed release-governance artifact from the current branch/worktree diff plus `.playbook/version-policy.json`. `pnpm playbook init` now installs the trusted/manual executor path too by seeding `.playbook/version-policy.json`, `.github/workflows/release-prep.yml`, and `docs/CHANGELOG.md` with the managed `PLAYBOOK:CHANGELOG_RELEASE_NOTES` seam in eligible publishable pnpm/node repositories; `pnpm playbook upgrade --apply` retrofits the same workflow/policy/changelog scaffolding without overwriting existing custom workflow or policy files.

## What it does

- Detects changed installable package surfaces from repository evidence.
- Resolves lockstep `versionGroups` from `.playbook/version-policy.json`.
- Recommends a conservative semver bump:
  - docs/tests/CI only => `none`
  - shipped internal code => `patch`
  - new command/rule/schema/stable contract/public export => `minor`
  - `major` only when an explicit configured breaking marker is present
- Emits evidence-backed reasons for every file, package, and version group.
- Writes a deterministic reviewed mutation artifact sorted by path/name.
- Lets CI materialize the same canonical `.playbook/release-plan.json` artifact early, then run canonical preflight verify from that artifact instead of re-implementing semver logic in workflow YAML.
- Precompiles bounded `apply --from-plan` tasks for exactly three mutation classes:
  - package `version` field updates
  - linked workspace dependency spec rewrites when the reviewed plan bumps the referenced package version
  - managed changelog block replacement in `docs/CHANGELOG.md`

## Usage

```bash
pnpm playbook release plan --json --out .playbook/release-plan.json
pnpm playbook release plan --base origin/main --json --out .playbook/release-plan.json
pnpm playbook release sync --check --json --out .playbook/release-plan.json
pnpm playbook release sync --json --out .playbook/release-plan.json
pnpm playbook apply --from-plan .playbook/release-plan.json
```

## `release sync`

`pnpm playbook release sync` is the deterministic release-sync guard. It always computes a fresh release plan, checks drift between expected version/changelog updates and current repo state, and then:

- `--check`: proposal-only guard mode; exits non-zero with actionable tasks when drift exists.
- default mode: applies the reviewed `.playbook/release-plan.json` through `playbook apply --from-plan`, then re-checks for drift.

This enforces the rule **Compute → Apply → Verify** and prevents recurring CI failures caused by committed code changes without mirrored release updates.

Idempotency guarantee: release version computation is anchored to the selected `baseRef` package versions (base snapshot), not the current working version after local bumps. Re-running `release sync` against the same `baseRef` yields the same next-version targets instead of incrementing repeatedly.

## Apply compatibility

- `.playbook/release-plan.json` is now a reviewed mutation artifact that crosses the write boundary only through `pnpm playbook apply --from-plan .playbook/release-plan.json`.
- `.playbook/release-plan.json` is generated runtime evidence; do not treat it as a committed contract artifact in the repository.
- `release plan` stays proposal/review oriented; it does **not** mutate package versions or changelog content directly.
- No `release apply` subcommand exists, and none should be introduced as a second mutation executor.
- Lockstep version groups are compiled into coordinated package tasks, and `apply --task` fails closed if a reviewed selection splits a lockstep group.
- Changelog mutation is limited to the managed `PLAYBOOK:CHANGELOG_RELEASE_NOTES` block. If `docs/CHANGELOG.md` is missing that managed block, `release plan` fails clearly instead of inventing a write target.

## Governance notes

- Installable workspace packages carry the release-governed version line.
- The private monorepo root `package.json` version is not the operator-facing release line.
- Rule: Version decisions must be artifact-backed, not inferred late during packaging.
- Rule: Version governance should be auto-materialized as runtime evidence, not inferred late by humans.
- Rule: Reviewed release artifacts may prepare bounded mutations, but `apply` remains the only mutation boundary.
- Pattern: Plan everywhere, apply only through reviewed boundaries.
- Pattern: Detect -> plan -> apply -> verify is the safe release-governance loop.
- Failure Mode: Catching version drift only at tag/package time turns release into late-stage cleanup.
- Failure Mode: Release logic that exists only as a command and never enters CI becomes optional in practice.
- Rule: Installable workflow policy is incomplete until the trusted/manual mutation path is installable too.
- Pattern: Seed policy, seed reviewed executor, keep normal CI plan-only.
- Failure Mode: Shipping only the policy file makes release governance look portable while leaving the actual release path repo-specific.


## Verify integration

`pnpm playbook verify --json` is the canonical merge gate for release/version governance.

When release-relevant changes land without the matching version-governance updates, verify emits evidence-backed failures instead of requiring workflow-local release heuristics. The standard remediation loop is:

```bash
pnpm playbook release plan --json --out .playbook/release-plan.json
pnpm playbook apply --from-plan .playbook/release-plan.json
pnpm playbook verify --json
```

In normal Playbook CI, the reusable action now materializes `.playbook/release-plan.json`, runs `pnpm playbook release sync --check --json --out .playbook/release-plan.json` as a fail-fast drift guard, then runs `pnpm playbook verify --phase preflight --json --out .playbook/verify-preflight.json`. If drift exists, CI fails before tests with an actionable release-sync message. Aligned branches then continue into tests and the later full `pnpm playbook verify --json --out .playbook/verify.json` merge gate. CI still renders one compact Playbook CI Summary from canonical artifacts, appends that operator brief once to the GitHub step summary, and uploads the canonical plan plus rendered summary artifacts unchanged. Normal PR CI stays plan-only: it does not auto-mutate versions.

- Rule: Diff-based release governance should fail before expensive test execution when canonical preflight evidence is already sufficient.
- Pattern: Release sync --check -> preflight verify -> tests -> full verify.
- Failure Mode: Late release-governance failures waste CI time and make correct policy failures look like random downstream breakage.

## Trusted/manual release prep

Use `.github/workflows/release-prep.yml` when a trusted maintainer is ready to materialize reviewed release mutations into a single version/changelog PR. The workflow is `workflow_dispatch` only, so ordinary pull request CI remains detect/plan/report only. Its path is intentionally narrow:

```bash
pnpm playbook release plan --json --out .playbook/release-plan.json
pnpm playbook apply --from-plan .playbook/release-plan.json
```

Then the workflow validates that the resulting diff contains only reviewed package manifest version rewrites, linked workspace dependency rewrites, and the managed `docs/CHANGELOG.md` release-notes block before it force-updates one managed `release/prep`-style branch and opens or updates a single release PR. This keeps release mutation on the existing reviewed `apply --from-plan` boundary instead of introducing a second executor.
