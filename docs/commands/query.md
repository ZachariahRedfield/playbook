# `pnpm playbook query`

Query deterministic repository intelligence contracts from `.playbook/repo-index.json`.

## Usage

- `pnpm playbook query architecture`
- `pnpm playbook query modules --with-memory --json`
- `pnpm playbook query dependencies`
- `pnpm playbook query dependencies workouts --json`
- `pnpm playbook query impact workouts`
- `pnpm playbook query risk workouts --json`
- `pnpm playbook query docs-coverage workouts --json`
- `pnpm playbook query rule-owners`
- `pnpm playbook query module-owners workouts --json`
- `pnpm playbook query test-hotspots --json`
- `pnpm playbook query patterns --json`
- `pnpm playbook query pattern-review --json`
- `pnpm playbook query promoted-patterns --json`
- `pnpm playbook query runs --json`
- `pnpm playbook query run --id <run-id> --json`

## Implemented behavior

`pnpm playbook query` is read-only. It does not regenerate repository intelligence artifacts.

Pattern knowledge graph support is currently exposed as engine query utilities for deterministic artifact reads (`read/list/get/filter/related/instances/evidence`) over `.playbook/pattern-knowledge-graph.json`; no mutation path is introduced in this phase.

Base fields (read from `.playbook/repo-index.json`):

- `architecture`
- `framework`
- `language`
- `modules`
- `database`
- `rules`

Specialized fields/subqueries:

- `dependencies` (`pnpm playbook query dependencies [module]`)
- `impact` (`pnpm playbook query impact <module>`)
- `risk` (`pnpm playbook query risk <module>`)
- `docs-coverage` (`pnpm playbook query docs-coverage [module]`)
- `rule-owners` (`pnpm playbook query rule-owners [rule-id]`)
- `module-owners` (`pnpm playbook query module-owners [module]`)
- `test-hotspots`
- `patterns`
- `pattern-review`
- `promoted-patterns`
- `pattern-graph` (engine read-only artifact query plane for `.playbook/pattern-knowledge-graph.json`; currently library-level)
- `runs`
- `run` (`pnpm playbook query run --id <run-id>`)

### Options

- `--json` / `--format json`: machine-readable output
- `--out <path>`: write JSON artifact (JSON mode)
- `--with-memory`: include additive memory descriptors for base-field queries

`--with-memory` is additive and only applies to base-field query responses. Returned memory descriptors may include:

- `memorySummary`
- `memorySources`
- `knowledgeHits`
- `recentRelevantEvents`
- `memoryKnowledge`

## JSON contracts

Dependency query:

```json
{
  "schemaVersion": "1.0",
  "command": "query",
  "type": "dependencies",
  "module": "workouts",
  "dependencies": ["users"]
}
```

Run lookup query:

```json
{
  "schemaVersion": "1.0",
  "command": "query",
  "type": "run",
  "run": {
    "id": "run_abc123",
    "frozen": false,
    "steps": []
  }
}
```
