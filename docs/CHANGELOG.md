# Changelog

## Unreleased

- WHAT: Added a reusable composite action at `actions/verify/action.yml` that runs `npx --yes playbook@<version> verify` with configurable `playbook_version`, `node_version`, and `args` inputs, plus README usage documentation. WHY: Lets any repository invoke published Playbook verification directly via `uses: <OWNER>/playbook/actions/verify@<ref>` without relying on this repo's local scripts.
- WHAT: CI Pipeline Added with a deterministic GitHub Actions workflow (`checkout -> setup-node@22 -> pnpm/action-setup@v4 -> pnpm install --frozen-lockfile -> pnpm -w build -> pnpm -w verify`) plus root `.npmrc` registry pinning. WHY: Ensures every push/PR uses reproducible installs and consistent build/verify behavior while reducing pnpm/corepack/registry drift failures.
- WHAT: `playbook analyze` now uses a Stripe-grade formatter for human, `--ci`, and `--json` output with deterministic severity ordering and snapshot coverage. WHY: Improves readability in seconds, keeps CI output low-noise, and protects output contracts from regressions.
- WHAT: Removed an unused `resolveTemplatesRepoDir()` helper and its related `node:path`/`node:url` imports from the CLI entrypoint. WHY: Fixes CI lint failure from `@typescript-eslint/no-unused-vars` while keeping lint rules strict.
- WHAT: CI now runs through the reusable `.github/actions/playbook-ci` composite action (`setup -> install -> build -> test -> smoke`). WHY: Keeps CI behavior consistent and reusable across repositories that adopt Playbook.
- WHAT: CI disables Corepack and provisions pnpm with `pnpm/action-setup`. WHY: Avoids pnpm download failures caused by Corepack behavior in constrained proxy/network environments.
- WHAT: CI installs dependencies with `pnpm install --frozen-lockfile`. WHY: Enforces deterministic installs and prevents lockfile drift.
- WHAT: Verify diff-base selection falls back to `HEAD~1` when `merge-base(main, HEAD) == HEAD`. WHY: Prevents empty diffs after commits on `main`, so the notes-on-changes gate still evaluates real changes.
- WHAT: Smoke testing validates the built CLI (`packages/cli/dist/main.js`) and exercises `init` + `verify` behavior. WHY: Confirms shipped CLI behavior end-to-end, not only typechecks/unit tests.
