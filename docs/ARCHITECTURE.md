# Playbook Architecture

This document describes **current-state architecture**. Future-state initiatives live in [PLAYBOOK_PRODUCT_ROADMAP.md](./PLAYBOOK_PRODUCT_ROADMAP.md). Long-term platform layering is documented in [architecture/PLAYBOOK_PLATFORM_ARCHITECTURE.md](./architecture/PLAYBOOK_PLATFORM_ARCHITECTURE.md).

Toroidal Flow is documented as an additive architecture overlay in [docs/architecture/TOROIDAL_FLOW.md](./architecture/TOROIDAL_FLOW.md). It preserves current command/runtime contracts and frames how execution and intelligence-return phases form a closed loop.

Research/theory bridge: pattern-meaning doctrine and attractor theory are captured in [docs/research/THEORY_OF_PATTERN_MEANING.md](./research/THEORY_OF_PATTERN_MEANING.md) and [docs/research/ATTRACTOR_MODEL_OF_MEANING.md](./research/ATTRACTOR_MODEL_OF_MEANING.md), with architecture mapping in [docs/architecture/EVOLUTIONARY_DYNAMICS_OF_KNOWLEDGE_GRAPHS.md](./architecture/EVOLUTIONARY_DYNAMICS_OF_KNOWLEDGE_GRAPHS.md).

Boundary rule: research docs describe conceptual models; architecture/runtime docs describe current or explicitly staged capability only.

## Toroidal Flow and Knowledge Compaction artifact set

The Toroidal Flow + Knowledge Compaction architecture is also represented in compact reusable artifacts:

- Pattern: `patterns/pattern.closed_loop_intelligence.md`
- Rule: `rules/rule.intention_over_retention.md`
- Rule: `rules/rule.smallest_predictive_pattern.md`
- Principle: `architecture/principle.graph_before_theory.md`
- Principle: `architecture/principle.state_transformation_relation.md`

These artifacts capture deterministic architecture intent in reusable pattern/rule/principle cards while preserving existing runtime command contracts.

## System layering

Playbook is organized as a layered monorepo:

- **`packages/cli`**: command parsing, output rendering, and exit codes.
- **`packages/engine`**: deterministic analysis, verification, plan generation, and fix execution.
- **`packages/node`**: Node/runtime adapter utilities used by CLI and engine integration points.
- **`packages/core`**: shared core contracts/utilities retained for package compatibility.

Primary flow:

`CLI -> engine (+ node adapter) -> repository`

## Canonical integration model: shared core, local intelligence

Playbook has two distinct architecture surfaces that must not be conflated:

1. **Playbook core product (shared engine):** the reusable CLI + engine + contracts shipped by the Playbook project.
2. **Consumer-repo integration (project-local Playbook state):** repository-local configuration, intelligence artifacts, plans, and optional extensions generated/owned by the consuming repository.

Rule: **Installing Playbook into another repository creates project-local Playbook state, not a Playbook fork by default.**

Project-local Playbook state typically includes:

- `playbook.config.json` (or `.playbook/config.json`) for local policy/configuration.
- `.playbook/repo-index.json` and other generated intelligence artifacts.
- `.playbook/plan.json` and similar remediation artifacts.
- repository-specific rules/extensions used by that repository.

Playbook core remains shared; repository-local state remains owned by the consuming project.

## Promotion boundary: local observations vs upstream product learnings

Playbook intentionally separates repository observations from core product evolution.

- **Local by default:** project-specific findings, architectural context, and rule outcomes stay in the consumer repository.
- **No hidden upstream mutation:** local command execution must not automatically mutate Playbook core.
- **Intentional upstream promotion:** generalized patterns, reusable rules, and product-level gaps should be promoted upstream deliberately through docs/roadmap/rule proposals and reviewed implementation.

Failure mode to avoid: treating project-specific customization as a core fork, which creates drift, duplicate fixes, and unclear ownership.

Preferred extension strategy for consuming repositories:

- configuration and policy tuning
- plugin-style extension points (as available)
- repository rule packs

Pattern: **prefer config/plugins/rule packs over core forks** unless a fork is unavoidable.

## Privacy and trust model

Playbook operates as **private-first by default**:

- scanning/indexing happens locally in the repository context
- generated artifacts remain local unless users explicitly export/share them
- no automatic upstream code/content export is implied by standard command usage

Any future export, sync, telemetry, or cloud-backed intelligence behavior must be explicit and opt-in.

## CLI command architecture

- CLI command handlers live in `packages/cli/src/commands/`.
- `packages/cli/src/commands/index.ts` is the central command registry and dispatch surface.
- Shared CLI helpers live in `packages/cli/src/lib/`.
- Engine behavior and rule execution logic should stay in `packages/engine`, not command files.

This separation keeps command modules thin and keeps governance logic reusable/testable.

## Doctor aggregation architecture

`doctor` is the repository health aggregation command. It orchestrates existing command/engine analyzers and normalizes them into a shared diagnostic schema.

Aggregation inputs:

- verify diagnostics (`verify`)
- module risk diagnostics (`query risk`)
- documentation governance diagnostics (`docs audit`)
- repository intelligence availability (`.playbook/repo-index.json`)

This keeps diagnosis logic deterministic while avoiding analyzer duplication in CLI command code.

## Analyze -> verify -> plan -> apply flow

Playbook governance execution follows a staged flow:

1. **`analyze`** detects repository structure and stack signals.
2. **`verify`** executes deterministic governance rules and returns findings.
3. **`plan`** converts verify failures into ordered, machine-safe tasks.
4. **`apply`** executes deterministic auto-fixable tasks from a generated plan.

`fix` remains available as a convenience command for direct local remediation flows, but the canonical machine-safe execution path is `plan -> apply`.

`plan` and `apply` are the machine-safe planning/execution path for remediation.

In the Toroidal Flow overlay, this execution flow is the **forward execution arc** and `apply` is treated as a midpoint for full-cycle architecture framing rather than a terminal endpoint.

## Deterministic task and output contracts

The plan/execution pipeline is deterministic by contract:

- Verify findings are sorted before task generation.
- Task fields are stable (`ruleId`, `file`, `action`, `autoFix`).
- Nullable values are normalized (`file: null` when evidence is absent).
- JSON responses are structured for automation, not best-effort prose parsing.

Deterministic JSON output is treated as a public interface for CI, tooling, and agents.


## Safe Repository Mutation Model

Playbook provides a deterministic mutation engine with built-in safety guarantees for repository changes. Repository content is always treated as untrusted input, and policy enforcement occurs before any mutation is allowed.

Core guardrails in the mutation engine:

- **Repo Root Security Boundary**: all reads and writes must resolve within the repository root.
- **Remediation Plan Validation**: plans are schema-validated and invariant-checked before execution.
- **Evidence-Linked Plans**: each task must map back to deterministic findings and file-level evidence.
- **Secret Redaction in Logs**: execution and diagnostic logs must avoid leaking secrets or sensitive values.
- **CI Artifact Verification**: automation flows verify remediation artifacts and command contracts in CI.
- **Signed Supply Chain Artifacts**: release and security artifacts are signed and verifiable for provenance integrity.

The engine enforces policy gates before `apply`, ensuring that only approved and validated plan tasks can mutate repository state.

## Security Contracts

Playbook encodes runtime safety guarantees as machine-readable security contracts under `docs/contracts/security/`, and verifies those guarantees with deterministic contract tests under `test/contracts/security/`.

This contract layer maps each guarantee to a concrete runtime guard and test expectation so regressions fail fast in CI.

- Pattern: **Security Contracts** — machine-readable definitions of runtime safety guarantees.
- Pattern: **Contract-Driven Security Tests** — CI verifies engine security behavior through contract definitions.
- Rule: **Apply Scope Enforcement** — apply may only modify files declared in the plan.
- Rule: **Repository Boundary** — file operations must resolve within repo root.
- Rule: **Secret Redaction** — sensitive values must never appear in logs.
- Failure Mode: **Boundary Escape** — path traversal or symlink attacks attempting to escape repo root.

## Long-Term Direction: Automation Synthesis

Automation Synthesis is a future platform direction that extends Playbook's `verify -> plan -> apply` philosophy into recurring-work automation, while preserving deterministic governance.

Separation of concerns should remain explicit:

1. **Trigger ingestion**: collect recurring-work signals from repository workflows and approved remediation history.
2. **Pattern classification/template selection**: map signals to known, policy-backed automation templates.
3. **Prompt generation**: build bounded synthesis prompts from deterministic contracts and template context.
4. **LLM output generation**: produce candidate automation artifacts as draft outputs.
5. **Sandbox verification**: execute and test candidates in isolated environments against deterministic checks.
6. **Approval gates**: require explicit human/policy approval before promotion.
7. **Deployment/orchestration**: publish approved automations to selected orchestration backends through controlled interfaces.
8. **Runtime monitoring/rollback**: track behavior, alert on drift/failures, and support deterministic rollback.

Rule: generated automations are **untrusted by default** and must not execute in trusted environments until verification and approval gates pass.

## Future Direction: Playbook Agents

Playbook's `verify -> plan -> apply` architecture is intentionally designed to enable safe integration with automated agents over time.

Conceptual control flow:

AI reasoning layer
↓
Playbook query/analysis layer
↓
Playbook remediation planning
↓
policy validation
↓
controlled apply execution

Agents should never write directly to the repository. All mutations must pass through the Playbook remediation pipeline so changes remain deterministic, reviewable, and policy-enforced.

## Future direction: embeddable runtime/API for app-integrated actions

For internal dashboards, CI control planes, admin panels, and product-integrated tooling, Playbook should expose server-side/library integration surfaces over time.

Design direction:

- expose validated server-side actions for capabilities such as `index`, `query`, `ask`, `explain`, and remediation orchestration
- keep repository mutations behind policy-checked server/runtime boundaries
- avoid browser-side arbitrary command execution as the default integration path

Pattern: app-integrated Playbook actions should call a **server-side API/runtime** (or trusted library surface) rather than executing raw CLI commands directly from browser clients.

## Rule: Playbook Analyzes but Does Not Author

Playbook provides structured analysis, diagnostics, and recommendations about repository state and development workflows.

Playbook does **not rewrite developer intent or author pull requests automatically**.

Its role is to provide architecture intelligence that informs developers rather than replacing developer judgment.




## Repository Memory System architecture (first-class, non-runtime-changing)

Playbook now defines an explicit Repository Memory System architecture in `docs/architecture/REPOSITORY_MEMORY_MODEL.md`.

Layering stance:

- structural intelligence: `.playbook/repo-index.json`, `.playbook/repo-graph.json`
- working context: `.playbook/context/*`
- episodic memory: `.playbook/memory/events/*.json`, `.playbook/memory/index.json`
- replay/consolidation: `.playbook/memory/candidates.json`
- doctrine/policy memory: rules, contracts, docs, remediation templates

Rule: `.playbook/repo-graph.json` remains the structural graph contract and must not be repurposed as the full temporal memory store.
Pattern: Structural Graph + Memory Graph/Index.

This addition is architectural doctrine and roadmap/contract clarification only; it does not change current runtime behavior.

## Repository graph contract layer

Playbook maintains a deterministic repository graph artifact at `.playbook/repo-graph.json` generated by `pnpm playbook index`.

Current graph contract stance:

- versioned JSON contract (`schemaVersion`) with explicit additive-vs-breaking evolution policy
- deterministic, low-cost edges derived from existing index/rule metadata (`contains`, `depends_on`, `governed_by`)
- read-runtime reuse through additive neighborhood summaries in existing `query`/`explain` paths instead of a broad new graph command family

Contract details and downstream consumer guidance live in `docs/contracts/repository-graph-contract.md`.

The graph feeds a compressed module-runtime layer at `.playbook/context/modules/*.json` generated by `pnpm playbook index`. These digests are layer-relative knowledge units (identity, dependencies/dependents, docs/tests/risk summaries, graph-neighborhood kinds) reused by existing read surfaces (`query impact`, `explain <module>`) to reduce repeated broad inference.
