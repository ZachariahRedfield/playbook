# `playbook ask`

Answer repository questions using machine-readable repository intelligence.

## Usage

- `playbook ask "where should a new feature live?"`
- `playbook ask "what architecture does this repo use?"`
- `playbook ask "what modules exist?"`
- `playbook ask "where should a new feature live?" --json`
- `playbook ask "what modules are affected by this change?" --diff-context`
- `playbook ask "what should I verify before merge?" --diff-context --mode concise`
- `playbook ask "summarize the architectural risk of this diff" --diff-context --json`

## Behavior

`playbook ask` is intentionally thin at the CLI layer. It delegates reasoning to engine rules that:

1. Normalize your question.
2. Query repository intelligence via `playbook query` internals.
3. Produce deterministic answers from architecture/module/framework/rule-registry signals.

`playbook ask` reads intelligence from `.playbook/repo-index.json` through the query engine and does **not** scan your repository directly.

`--diff-context` narrows reasoning to the active change set by combining git diff file discovery with indexed Playbook module intelligence. It fails deterministically when index/diff inputs are missing and does not silently broaden to full-repo inference.

## Example text output

```text
Recommended location: src/features/<feature>

Reason
Playbook detected modular-monolith architecture with feature boundaries under src/features.
```

## JSON output contract

`playbook ask --json` returns the existing answer payload and includes deterministic context provenance metadata under `context.sources`.

```json
{
  "command": "ask",
  "question": "where should a new feature live?",
  "answer": "Recommended location: src/features/<feature>",
  "reason": "Playbook detected modular-monolith architecture with feature boundaries under src/features.",
  "context": {
    "architecture": "modular-monolith",
    "framework": "nextjs",
    "modules": ["users", "workouts"],
    "sources": [
      { "type": "repo-index", "path": ".playbook/repo-index.json" },
      { "type": "architecture-metadata", "path": ".playbook/repo-index.json" },
      { "type": "rule-registry", "path": ".playbook/repo-index.json" },
      { "type": "module", "name": "workouts" },
      { "type": "diff", "files": ["src/workouts/service.ts", "src/workouts/api.ts"] },
      { "type": "docs", "path": "docs/ARCHITECTURE.md" }
    ]
  }
}
```

Pattern: Ask Context Provenance — Playbook ask should expose deterministic metadata describing which repository intelligence sources informed an answer.

Rule: Provenance metadata includes only source descriptors, not raw repository content.

Pattern: Auditable AI Reasoning — governance tools should expose evidence sources so automation can validate reasoning.

Failure Mode: Opaque AI reasoning prevents CI and agent integrations from trusting governance outputs.

## Notes

- Deterministic answers are returned when AI is disabled.
- Future AI integrations can enrich responses while preserving this baseline contract.
