# `playbook route`

Classify a task into a deterministic task family, resolve a task-execution-profile, and emit a deterministic proposal-only execution plan artifact.

## Usage

```bash
pnpm playbook route "summarize current repo state"
pnpm playbook route "summarize current repo state" --json
pnpm playbook route "propose fix for failing tests"
pnpm playbook route "update command docs"
pnpm playbook route "update command docs" --codex-prompt
pnpm playbook route --story story-123 --json
```

## Command-surface guarantees

- `--help` is side-effect free and does not write `.playbook/execution-plan.json`.
- Missing `<task>` emits a deterministic error envelope in `--json` mode.
- Successful runs always stage, validate, and promote `.playbook/execution-plan.json` and print a stable route payload.

## Interpretation layer

`playbook route` now returns a derived `interpretation` block alongside the canonical route + execution-plan payload. The default view always resolves to one primary next action, while secondary and deep views preserve blockers, reasoning, raw execution-plan references, diagnostics, and promotion metadata references.

Pattern: Interpretation Layer.
Pattern: Progressive Disclosure.
Pattern: Single Next Action.
Pattern: State → Narrative Compression.
Failure Mode: Building polished summaries before underlying diagnostics and recommendation signals exist leads to attractive but weak UX.

## Output contract

Routing returns command metadata plus an `executionPlan` payload and a normalized `promotion` receipt. It writes:

- staged candidate: `.playbook/staged/workflow-route/execution-plan.json`
- committed artifact: `.playbook/execution-plan.json`

Execution plan fields include:

- `schemaVersion`, `kind`, `generatedAt`, `proposalOnly`
- `pattern_context` (read-only advisory matches from promoted patterns when routing from a story)
- `task_family`, `route_id`
- `rule_packs`, `required_validations`, `optional_validations`
- `parallel_lanes`, `mutation_allowed`, `missing_prerequisites`
- `sourceArtifacts`, `learning_state_available`, `route_confidence`
- `expected_surfaces`, `likely_conflict_surfaces`, `dependency_level`, `recommended_pr_size`, `worker_ready`
- `open_questions`, `warnings`

## Deterministic classification rules

`playbook route` deterministically classifies the task into one of these initial families:

- `docs_only`
- `contracts_schema`
- `cli_command`
- `engine_scoring`
- `pattern_learning`

It then resolves a matching built-in task-execution-profile to populate rule packs, validations, and parallel lane strategy.

### Conservative fallback behavior

- If no matching profile exists, route output is `unsupported` with explicit `missing_prerequisites`.
- If multiple family signals match, the router chooses the conservative family (highest safety-first priority) and emits an explicit warning.
- `mutation_allowed` remains `false` for this phase (proposal-only routing).

Rule: Router classification must prefer conservative correctness over aggressive optimization.

Pattern: Deterministic task-family classification reduces routing ambiguity and review burden.

Failure Mode: Ambiguous tasks routed optimistically will under-scope validation and create fragile plans.

### Learning-state refinement guardrails (Phase 8 Router Lane 3)

When `.playbook/learning-state.json` is available, route may **refine** (not replace) baseline profile behavior:

- High `retry_pressure` increases validation strictness (required validations are never removed).
- High `route_efficiency_score` may reduce optional validation pressure when evidence confidence is strong.
- Low `parallel_safety_realized` prefers sequenced lanes over parallel suggestions.
- Low `router_fit_score` emits warnings/open questions and prefers stricter posture.
- High `validation_cost_pressure` can only reconsider optional validations, never required validations.

If learning-state is missing or low-confidence, route degrades safely to baseline profile-derived plans with explicit warnings/open questions.

Rule: Learning-state may refine routes, but it must not erase baseline governance.

Pattern: Evidence-aware routing improves efficiency when optimization is bounded by required validations.

Failure Mode: Speed-optimized routing that removes baseline governance creates invisible fragility.

## Codex worker prompt compilation

Use `--codex-prompt` to compile the deterministic execution plan into a PR-sized, proposal-only worker prompt.

```bash
pnpm playbook route "update command docs" --codex-prompt
pnpm playbook route --story story-123 --json
```

Compiled prompt sections are deterministic and include:

- Objective
- Implementation plan
- Files / surfaces to modify
- Verification steps
- Documentation updates
- Rule / Pattern / Failure Mode

The compiled prompt is guidance-only. It does **not** launch workers, create branches, open PRs, or mutate the repository autonomously.

## Story-linked planning

`playbook route --story <id> --json` resolves the canonical story from `.playbook/stories.json`, derives a deterministic task statement, and writes the normal `.playbook/execution-plan.json` artifact with stable `story_reference` metadata plus a read-only `pattern_context` envelope.

`pattern_context` is advisory only and includes matched `pattern_id` values, why each pattern matched, provenance references, and freshness/status metadata. Absence of matches degrades to an empty ordered list.

- Pattern: Story is durable intent; Plan is execution shape; Receipt is observed outcome.
- Rule: Story, Plan, Worker, and Receipt must remain separate governed artifacts even when linked.
- Rule: Story lifecycle transitions must be driven by linked execution artifacts, not UI-only state.
- Failure Mode: Collapsing planning and execution artifacts into story state destroys clear control-plane boundaries.

When a linked story is `ready`, route promotion may conservatively transition it to `in_progress` because deterministic planning evidence now exists.
