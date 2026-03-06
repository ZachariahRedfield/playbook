# Contributing

## 1) Development setup

High-level local setup:

1. Clone the repository.
2. Install dependencies (`pnpm install`).
3. Build and test (`pnpm build`, `pnpm test`).
4. Run Playbook commands locally while developing.

For environment-specific setup details, see existing project development docs.

## 2) Adding a new CLI command

Recommended workflow:

1. Implement engine logic in `packages/engine`.
2. Add a thin CLI command wrapper in `packages/cli`.
3. Register the command in the CLI command registry.
4. Add tests (engine + CLI + integration as needed).
5. Update documentation.

Keep domain behavior in engine modules; avoid embedding engine logic inside CLI command files.

## 3) Documentation expectations

When adding or changing command behavior:

- Document new commands and user-facing flags.
- Describe JSON output shape for automation consumers.
- Update `docs/ARCHITECTURE.md` for architecture-impacting changes.

## 4) Testing requirements

Every command contribution should include:

- Engine-level tests.
- CLI output tests (text and JSON where applicable).
- Integration coverage when behavior crosses command/engine boundaries.

## 5) Design principles

Contributions should preserve Playbook's core model:

- Deterministic behavior.
- Machine-readable outputs.
- Thin CLI layer.
- Reusable engine logic.
