# `playbook route`

Classify a task into deterministic local execution, bounded model reasoning, hybrid execution, or unsupported.

## Usage

```bash
pnpm playbook route "summarize current repo state"
pnpm playbook route "propose fix for failing tests"
pnpm playbook route "apply approved remediation plan"
```

## Output contract

Routing always returns:

- selected route
- why selected
- required inputs
- missing prerequisites
- whether repository mutation is allowed

Rule: the model must never decide its own authority boundary; Playbook classifies the task first.
