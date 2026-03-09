# playbook-demo companion changes for cross-repo refresh automation

This repository now contains `scripts/demo-refresh.mjs`, which refreshes committed artifacts in `ZachariahRedfield/playbook-demo` by cloning that repository and running its refresh script with:

- `PLAYBOOK_CLI_PATH=<absolute path to playbook/packages/cli/dist/main.js>`

## Required companion support in `playbook-demo`

`playbook-demo` must support the following behavior in its refresh entrypoint script:

1. Read `PLAYBOOK_CLI_PATH` and use `node "$PLAYBOOK_CLI_PATH" ...` when present.
2. Fall back to its default Playbook invocation when `PLAYBOOK_CLI_PATH` is unset.
3. Keep generated/committed outputs deterministic for the allowlisted surfaces:
   - `.playbook/demo-artifacts/**`
   - `.playbook/repo-index.json`
   - `docs/ARCHITECTURE_DIAGRAMS.md`

If `playbook-demo` needs to commit additional generated docs, set `PLAYBOOK_DEMO_EXTRA_ALLOWED_PATHS` in the automation environment as a comma-separated list and document those paths in both repositories.

## Maintainer execution notes

- Default local safety mode:
  - `node scripts/demo-refresh.mjs --dry-run`
- Push/PR mode requires token auth and explicit commit identity configuration (defaults are provided for identity if unset):
  - `PLAYBOOK_DEMO_GH_TOKEN` (or `GH_TOKEN`)
  - optional `PLAYBOOK_GIT_AUTHOR_NAME`
  - optional `PLAYBOOK_GIT_AUTHOR_EMAIL`

`scripts/demo-refresh.mjs` selects the refresh runner from the cloned repo lockfile and invokes refresh commands directly (no `bash -lc` dependency):

- npm repo (`package-lock.json`): `npm run <script>`
- pnpm repo (`pnpm-lock.yaml`): `pnpm run <script>`
- yarn repo (`yarn.lock`): `yarn run <script>`

## Required feature metadata

Automated commits/PRs from `scripts/demo-refresh.mjs` default to feature id:

- `PB-V1-DEMO-REFRESH-001`

`playbook-demo` delivery validation should accept this `feature_id` in commit/PR metadata.
