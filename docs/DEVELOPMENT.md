# Development

## Prerequisites

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

Run commands in a single workspace package with filters:

```bash
pnpm --filter <pkg> <cmd>
```

Examples:

```bash
pnpm --filter @playbook/cli build
pnpm --filter @playbook/engine test
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
