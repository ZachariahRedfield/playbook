# Changelog

## Unreleased

- WHAT: Removed an unused `resolveTemplatesRepoDir()` helper and its related `node:path`/`node:url` imports from the CLI entrypoint. WHY: Fixes CI lint failure from `@typescript-eslint/no-unused-vars` while keeping lint rules strict.
- WHAT: CI now runs through the reusable `.github/actions/playbook-ci` composite action (`setup -> install -> build -> test -> smoke`). WHY: Keeps CI behavior consistent and reusable across repositories that adopt Playbook.
- WHAT: CI disables Corepack and provisions pnpm with `pnpm/action-setup`. WHY: Avoids pnpm download failures caused by Corepack behavior in constrained proxy/network environments.
- WHAT: CI installs dependencies with `pnpm install --frozen-lockfile`. WHY: Enforces deterministic installs and prevents lockfile drift.
- WHAT: Verify diff-base selection falls back to `HEAD~1` when `merge-base(main, HEAD) == HEAD`. WHY: Prevents empty diffs after commits on `main`, so the notes-on-changes gate still evaluates real changes.
- WHAT: Smoke testing validates the built CLI (`packages/cli/dist/main.js`) and exercises `init` + `verify` behavior. WHY: Confirms shipped CLI behavior end-to-end, not only typechecks/unit tests.
