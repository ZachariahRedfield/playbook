# Changelog

## Unreleased

### WHAT

- Installed pnpm via `pnpm/action-setup@v4` (without unsupported cache inputs) and added manual pnpm store caching via `actions/cache@v4`.
- Removed legacy `.eslintignore` and rely on flat-config `ignores` in `eslint.config.cjs`.
- Added `pnpm.supportedArchitectures` in the root `package.json` to lock Linux x64 glibc Rollup optional native packages deterministically.
- Added a Linux-only Rollup native resolution sanity check in `.github/actions/playbook-ci/action.yml` before `pnpm verify`.

### WHY

- Prevent CI/local failures caused by missing `@rollup/rollup-linux-x64-gnu` under frozen lockfile installs.
- Eliminate ESLint v9 flat-config warnings caused by `.eslintignore`.

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
