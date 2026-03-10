# Development

## Prerequisites
<!-- docs-merge:canonical-heading -->
> **Docs merge note:** Canonical section lives at [Prerequisites](contributing.md#prerequisites).


- Node.js `>=22` (matches `package.json` engines policy).
- pnpm provisioned through Corepack.

## Setup

```bash
corepack enable
pnpm install
pnpm -r build
pnpm -r test
```

## Workspace command tips

Run commands in a single workspace package with deterministic directory targeting:

```bash
pnpm -C <workspace-path> <cmd>
```

Examples:

```bash
pnpm -C packages/cli build
pnpm -C packages/engine test
```

## CI and pnpm version policy

`package.json#packageManager` is the authoritative pnpm version source.

When configuring CI:

- Do not set `pnpm/action-setup` to a version that differs from `packageManager`.
- If using Corepack, ensure it resolves the same `packageManager` version.

This prevents pnpm version drift between local development and CI.

## Lockfile policy

- `pnpm-lock.yaml` is required.
- The lockfile must be committed.
- The lockfile must not be gitignored.

## Local CLI tarball testing (`npx` from `.tgz`)

Use pnpm packaging (not manual tar) so workspace dependencies are rewritten to publishable semver ranges:

```bash
pnpm run pack:cli
pnpm playbook analyze
```

This matches real publish/install behavior and avoids `workspace:*` dependency leakage in local install tests.
