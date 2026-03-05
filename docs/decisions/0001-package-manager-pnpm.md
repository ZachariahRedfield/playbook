# ADR 0001: Standardize on pnpm as the Playbook package manager

- Status: Accepted
- Date: 2026-03-05

## Decision

Playbook requires **pnpm** as the package manager for local development and CI.

`package.json#packageManager` is the single source of truth for the pnpm version used by this repository.

## Context

Playbook is structured as a monorepo with workspace packages (`packages/cli`, `packages/engine`) and shared scripts. This layout benefits from:

- Fast, workspace-aware installs.
- Deterministic lockfile behavior suitable for CI.
- Strict dependency boundaries that reduce phantom dependency usage.

A previous risk in CI/tooling workflows is pnpm version drift (for example, one version declared in `packageManager` and a different version pinned in workflow setup).

## Consequences

- Contributors must use pnpm for install/build/test workflows.
- CI pipelines must run with pnpm and respect the version defined in `package.json#packageManager`.
- `pnpm-lock.yaml` is required and must be committed.
- Tooling documentation must describe pnpm-first commands.

## Single source-of-truth rule

Do not pin pnpm versions in multiple conflicting places.

- Authoritative source: `package.json#packageManager`
- Allowed CI setup: `pnpm/action-setup` (or Corepack) configured to honor that same version
- Disallowed: independently pinning a different pnpm version in CI that can drift from `packageManager`
