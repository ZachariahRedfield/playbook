# `pnpm playbook explain`

Explain deterministic intelligence targets from repository artifacts and the rule registry.

## Usage

- `pnpm playbook explain PB001`
- `pnpm playbook explain workouts`
- `pnpm playbook explain architecture`
- `pnpm playbook explain workouts --json`
- `pnpm playbook explain workouts --with-memory --json`

## Supported targets

- Verify/analyze rule IDs (for example `PB001`)
- Indexed module names (for example `workouts`)
- `architecture`

## Implemented behavior

- Missing `<target>` returns a deterministic CLI error.
- Unknown targets return an `unknown` explanation type and a non-zero exit code.
- `--with-memory` adds deterministic memory descriptors without changing default output.

Memory-aware responses may include:

- `memorySummary`
- `memorySources`
- `knowledgeHits`
- `recentRelevantEvents`
- `memoryKnowledge` (promoted knowledge + replay candidates with provenance)

## JSON contract

```json
{
  "command": "explain",
  "target": "workouts",
  "type": "module",
  "explanation": {
    "resolvedTarget": {
      "kind": "module",
      "selector": "workouts",
      "input": "workouts"
    },
    "name": "workouts",
    "responsibilities": [
      "Owns workouts feature behavior and boundaries.",
      "Encapsulates workouts domain logic and module-level policies."
    ],
    "dependencies": [],
    "architecture": "modular-monolith",
    "graphNeighborhood": {
      "node": { "id": "module:workouts", "kind": "module", "name": "workouts" },
      "outgoing": [],
      "incoming": [{ "kind": "contains", "source": "repository:root" }]
    }
  }
}
```
