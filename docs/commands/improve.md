# `playbook improve`

Generate deterministic improvement candidates from repository memory events and learning-state signals.

## Usage

```bash
pnpm playbook improve
pnpm playbook improve --json
```

## Inputs

- `.playbook/memory/events/*`
- `.playbook/learning-state.json`

## Output artifact

- `.playbook/improvement-candidates.json`

## Categories

- `routing`
- `orchestration`
- `worker_prompts`
- `validation_efficiency`
- `ontology`

## Baseline thresholds

Candidates are emitted only when both baseline thresholds are met:

- `minimum_recurrence = 3`
- `minimum_confidence = 0.6`

## Deterministic evidence gating tiers

Each candidate is annotated with:

- `evidence_count`
- `supporting_runs`
- `confidence_score`
- `gating_tier`
- `required_review`
- `blocking_reasons`

Tier rules:

- `AUTO-SAFE`: high repeated evidence + run diversity + high confidence + no governance/doctrine risk.
- `CONVERSATIONAL`: reviewable non-sensitive proposals that pass baseline thresholds but are not AUTO-SAFE.
- `GOVERNANCE`: doctrine/trust-boundary sensitive proposals and proposals requiring explicit governance adjudication.

## Text summary sections

- `AUTO-SAFE improvements`
- `CONVERSATIONAL improvements`
- `GOVERNANCE improvements`
