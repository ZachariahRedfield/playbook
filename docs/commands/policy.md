# `playbook policy evaluate`

Evaluate improvement proposals against governed runtime evidence in a deterministic, read-only control-plane layer.

## Usage

```bash
pnpm playbook policy evaluate
pnpm playbook policy evaluate --json
```

## Read-only contract

- This command never executes remediation.
- This command never mutates improve proposals.
- This command classifies proposals into policy decisions only.

## Inputs

- `.playbook/improvement-candidates.json`
- `.playbook/cycle-history.json` (for regression evidence when available)

## Output

The command emits deterministic policy evaluations with fields:

- `proposal_id`
- `decision` (`safe` | `requires_review` | `blocked`)
- `reason`
- `evidence.frequency`
- `evidence.confidence`
- `evidence.signals[]`

## Decision classes

- `safe` → strong evidence + low risk/narrow impact.
- `requires_review` → moderate evidence or broader/repeated impact.
- `blocked` → weak evidence or low confidence.

Rule: Policy decisions must be derived strictly from governed evidence and proposal metadata.
