# Contributing

## Prerequisites

- Node.js >= 22
- Git

## Install pnpm

### Option A (recommended)

```bash
corepack enable
corepack prepare pnpm@10.0.0 --activate
```

### Option B (Windows-friendly)

```bash
npm i -g pnpm@10
```

If you see an `EPERM` error on Windows while installing global tools, run PowerShell as Administrator and retry.

## Development commands

```bash
pnpm install
pnpm build
pnpm test
node scripts/smoke-test.mjs
```

## Repository structure

- `packages/cli` — Playbook CLI command surface and template scaffolding.
- `packages/engine` — shared analysis, verify rule logic, and reporting.
- `templates` — source templates copied into consumer repositories by `playbook init`.
