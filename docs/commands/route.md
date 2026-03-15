# `playbook route`

Classify a task into a deterministic task family, resolve a task-execution-profile, and emit a deterministic proposal-only execution plan artifact.

## Usage

```bash
pnpm playbook route "summarize current repo state"
pnpm playbook route "summarize current repo state" --json
pnpm playbook route "propose fix for failing tests"
pnpm playbook route "update command docs"
```

## Output contract

Routing returns command metadata plus an `executionPlan` payload and writes:

- `.playbook/execution-plan.json`

Execution plan fields include:

- `schemaVersion`, `kind`, `generatedAt`, `proposalOnly`
- `task_family`, `route_id`
- `rule_packs`, `required_validations`, `optional_validations`
- `parallel_lanes`, `mutation_allowed`, `missing_prerequisites`
- `sourceArtifacts`, `warnings`

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
