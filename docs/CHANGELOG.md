# Changelog

## Unreleased

- WHAT: Removed any required CI dependency on cloning `ZachariahRedfield/playbook-demo` and kept `scripts/smoke-test.mjs` as the canonical offline integration path run via the reusable Playbook CI action. WHY: Keeps PR CI deterministic and fully functional in restricted proxy/offline environments while still validating real CLI init/verify behavior end-to-end.
- WHAT: Added an optional `demo-integration` workflow (`.github/workflows/demo-integration.yml`) that runs on manual dispatch/nightly and performs a best-effort `playbook-demo` clone plus `npx playbook analyze --ci` with warning-only behavior on network failure. WHY: Preserves external integration signal without making outbound network access a merge-blocking requirement.
- WHAT: Hardened smoke-test diagnostics so expected `verify` pre-notes failure stays quiet, but unexpected pass now includes captured command output in the thrown error. WHY: Improves CI debugging signal while keeping routine smoke logs low-noise.
- WHAT: Updated `.github/workflows/ci.yml` to call the reusable `./.github/actions/playbook-ci` composite action with Node 22, frozen-lockfile installs, and smoke enabled as the single CI entrypoint. WHY: Eliminates drift between documented CI behavior and actual workflow execution while keeping Playbook CI deterministic and reusable.
- WHAT: Updated `playbook-demo` integration guidance to use the real verify action reference `ZachariahRedfield/playbook/actions/verify@main` with explicit Node 22 + `--ci` inputs. WHY: Removes placeholder adoption steps and makes external verification wiring copy/paste-ready.

## v0.3.0

- WHAT: Added deterministic architecture diagram generation (Mermaid) via a new `playbook diagram` command and engine scanning/generation modules for structure and internal dependency views. WHY: Helps developers and AI agents understand repository boundaries quickly without changing existing `init/analyze/verify` behavior.
- WHAT: Added diagram documentation and agent guidance (`docs/DIAGRAMS.md`, `docs/AI_AGENT_CONTEXT.md`) and a CI drift check workflow for generated diagrams. WHY: Keeps architecture documentation reproducible and continuously up to date in pull requests.

- WHAT: Documented a pnpm-first toolchain and distribution doctrine across roadmap/governance/development/readme docs, including the single-source pnpm version rule (`package.json#packageManager`), GitHub Action distribution plan, and `playbook-demo` onboarding path. WHY: Prevents CI/local pnpm version drift, makes contributor setup deterministic, and reduces adoption friction through clear CLI + Action entry points.
- WHAT: Added a reusable composite action at `actions/verify/action.yml` that runs `npx --yes playbook@<version> verify` with configurable `playbook_version`, `node_version`, and `args` inputs, plus README usage documentation. WHY: Lets any repository invoke published Playbook verification directly via `uses: <OWNER>/playbook/actions/verify@<ref>` without relying on this repo's local scripts.
- WHAT: CI Pipeline Added with a deterministic GitHub Actions workflow (`checkout -> setup-node@22 -> pnpm/action-setup@v4 -> pnpm install --frozen-lockfile -> pnpm -w build -> pnpm -w verify`) plus root `.npmrc` registry pinning. WHY: Ensures every push/PR uses reproducible installs and consistent build/verify behavior while reducing pnpm/corepack/registry drift failures.
- WHAT: `playbook analyze` now uses a Stripe-grade formatter for human, `--ci`, and `--json` output with deterministic severity ordering and snapshot coverage. WHY: Improves readability in seconds, keeps CI output low-noise, and protects output contracts from regressions.
- WHAT: Removed an unused `resolveTemplatesRepoDir()` helper and its related `node:path`/`node:url` imports from the CLI entrypoint. WHY: Fixes CI lint failure from `@typescript-eslint/no-unused-vars` while keeping lint rules strict.
- WHAT: CI now runs through the reusable `.github/actions/playbook-ci` composite action (`setup -> install -> build -> test -> smoke`). WHY: Keeps CI behavior consistent and reusable across repositories that adopt Playbook.
- WHAT: CI disables Corepack and provisions pnpm with `pnpm/action-setup`. WHY: Avoids pnpm download failures caused by Corepack behavior in constrained proxy/network environments.
- WHAT: CI installs dependencies with `pnpm install --frozen-lockfile`. WHY: Enforces deterministic installs and prevents lockfile drift.
- WHAT: Verify diff-base selection falls back to `HEAD~1` when `merge-base(main, HEAD) == HEAD`. WHY: Prevents empty diffs after commits on `main`, so the notes-on-changes gate still evaluates real changes.
- WHAT: Smoke testing validates the built CLI (`packages/cli/dist/main.js`) and exercises `init` + `verify` behavior. WHY: Confirms shipped CLI behavior end-to-end, not only typechecks/unit tests.
