# `pnpm playbook release plan`

`pnpm playbook release plan --json --out .playbook/release-plan.json` builds a deterministic reviewed release-governance artifact from the current branch/worktree diff plus `.playbook/version-policy.json`.

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
- Precompiles bounded `apply --from-plan` tasks for exactly three mutation classes:
  - package `version` field updates
  - linked workspace dependency spec rewrites when the reviewed plan bumps the referenced package version
  - managed changelog block replacement in `docs/CHANGELOG.md`

## Usage

```bash
pnpm playbook release plan --json --out .playbook/release-plan.json
pnpm playbook release plan --base origin/main --json --out .playbook/release-plan.json
pnpm playbook apply --from-plan .playbook/release-plan.json
```

## Apply compatibility

- `.playbook/release-plan.json` is now a reviewed mutation artifact that crosses the write boundary only through `pnpm playbook apply --from-plan .playbook/release-plan.json`.
- `release plan` stays proposal/review oriented; it does **not** mutate package versions or changelog content directly.
- No `release apply` subcommand exists, and none should be introduced as a second mutation executor.
- Lockstep version groups are compiled into coordinated package tasks, and `apply --task` fails closed if a reviewed selection splits a lockstep group.
- Changelog mutation is limited to the managed `PLAYBOOK:CHANGELOG_RELEASE_NOTES` block. If `docs/CHANGELOG.md` is missing that managed block, `release plan` fails clearly instead of inventing a write target.

## Governance notes

- Rule: Version decisions must be artifact-backed, not inferred late during packaging.
- Rule: Reviewed release artifacts may prepare bounded mutations, but `apply` remains the only mutation boundary.
- Pattern: Detect -> plan -> apply -> verify is the safe release-governance loop.
- Failure Mode: Catching version drift only at tag/package time turns release into late-stage cleanup.


## Verify integration

`pnpm playbook verify --json` is the canonical merge gate for release/version governance.

When release-relevant changes land without the matching version-governance updates, verify emits evidence-backed failures instead of requiring workflow-local release heuristics. The standard remediation loop is:

```bash
pnpm playbook release plan --json --out .playbook/release-plan.json
pnpm playbook apply --from-plan .playbook/release-plan.json
pnpm playbook verify --json
```
