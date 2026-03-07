# Ecosystem Adapter Boundaries

External tooling integrations must remain isolated behind adapter layers.

## Why this matters

Playbook depends on a practical toolchain (package manager, test runners, CI runners, scanners, diagram generators). Direct coupling to each tool everywhere increases drift and migration risk.

## Adapter strategy

- Keep command/business logic deterministic and tool-agnostic where possible.
- Isolate external invocation in thin adapters with stable internal contracts.
- Treat adapter outputs as normalized inputs to Playbook engines.

## Ecosystem dependencies to isolate

- Package/runtime: `pnpm`, Node.js
- Testing/contracts: Vitest
- CI transport: GitHub Actions workflow glue
- SCM provider context: git/GitHub PR metadata
- Security/tooling: gitleaks/SBOM generators (present or planned)
- Visualization: diagram tooling in docs/architecture generation flows

## Adapter boundary requirements

- deterministic parsing and normalization of external output
- explicit error mapping (tool missing, unsupported version, transport failure)
- minimal surface area from adapter to engine
- test coverage at adapter boundary for representative tool outputs

## Migration guideline

When adding new external tooling:

1. add or extend an adapter module first
2. keep engine contracts stable
3. add docs + schema/contract tests for new normalized fields
4. avoid embedding tool-specific assumptions in high-level command handlers

