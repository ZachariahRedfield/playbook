# Playbook Architecture

Playbook now follows a platform-style monorepo layout:

## packages/core

Pure governance engine.

- Exposes `analyze(ctx, opts)` and `verify(ctx, opts)`.
- Defines shared report/finding/severity/result types.
- Contains deterministic, side-effect free business logic (no direct `fs`, `process`, or `console` use).

## packages/node

Node runtime adapter.

- Exposes `createNodeContext({ cwd? })`.
- Implements file-system and git-backed capabilities used by core.
- Detects repository root and provides changed-file/base-ref helpers.

## packages/cli

Thin user-facing command surface.

- Parses `process.argv` and command flags.
- Creates node context via `createNodeContext`.
- Calls core engine functions and handles output formatting/exit codes.
- Maintains published bin surface: `playbook -> dist/cli.js`.

## Package layering

`cli -> node + core`  
`node -> core (types)`  
`core -> (no runtime adapters)`

This keeps policy logic portable while preserving current CLI behavior.
