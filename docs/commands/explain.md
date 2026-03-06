# `playbook explain`

Explain deterministic repository intelligence targets from `.playbook/repo-index.json` and the rule registry.

## Usage

- `playbook explain PB001`
- `playbook explain users`
- `playbook explain workouts`
- `playbook explain architecture`
- `playbook explain workouts --json`

## Supported target types

- rule ids (for example `PB001`)
- indexed modules (`playbook query modules`)
- `architecture`

## JSON contract

```json
{
  "command": "explain",
  "target": "workouts",
  "type": "module",
  "explanation": {
    "name": "workouts",
    "responsibilities": [
      "Owns workouts feature behavior and boundaries.",
      "Encapsulates workouts domain logic and module-level policies."
    ],
    "dependencies": [],
    "architecture": "modular-monolith"
  }
}
```
