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


## 6) Security requirements for new commands

Every new command or remediation workflow change must pass the security baseline:

- repo boundary tests (path traversal + out-of-root write rejection)
- remediation contract tests (deterministic plan/apply compatibility)
- security CI checks (`.github/workflows/security.yml`)
- deterministic outputs and snapshot coverage

Security checklist for command additions:

- path boundary protection is enforced
- outputs are deterministic and machine-readable
- `verify -> plan -> validate -> policy -> apply -> verify` compatibility is preserved
- snapshot and regression tests cover security-sensitive behavior

## 7) Governance audit workflow

After merge, prefer lightweight governance habit-forming checks before expanding enforcement scope:

- `playbook audit architecture` when architecture guardrails, deterministic boundaries, or contracts change.
- `playbook doctor` before handoff/review to expose architecture-audit status as a lightweight health signal.
- `playbook docs audit` when contributor/developer workflow docs, governance docs, or roadmap-linked guidance changes.

Use this guidance to keep governance human-visible and repeatable first, then add stricter blocking checks later only where false-positive risk is demonstrably low (for example, artifact `schemaVersion` consistency or shared SCM utility wiring checks).

Capture merge-ready architecture audit notes with these copy-pastable bullets:

- Hardened architecture audit into a declarative, extensible check-definition system with shared deterministic helpers for ordering, tolerant concept matching, and source-referenced evidence.
- Standardized architecture audit severity semantics and enforced deterministic ordering for checks, evidence, and next actions.
- Upgraded selected architecture checks from presence-only validation to minimum-quality deterministic validation.
- Reduced roadmap audit brittleness by using tolerant concept-based coverage checks instead of strict heading dependence.
- Improved human-readable architecture audit output for summary-first operator triage and actionable follow-up.
- Integrated architecture audit findings into `playbook doctor` as a lightweight health signal without forcing broader workflow brittleness.
- Pattern: governance commands should evolve from existence checks to minimum-quality checks only when intent can be validated deterministically.
- Rule: governance evidence and action lists must be source-referenced, deduplicated, and stably ordered.
- Failure Mode: over-broad warning/error integration in health workflows can create signal fatigue and reduce trust in real drift detection.

