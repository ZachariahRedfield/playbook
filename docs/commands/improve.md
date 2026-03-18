# `playbook improve`

Generate deterministic improvement candidates from repository memory events and compacted learning pipeline signals.

## Usage

```bash
pnpm playbook improve
pnpm playbook improve --json
pnpm playbook improve opportunities --json
pnpm playbook improve commands --json
pnpm playbook improve apply-safe --json
pnpm playbook improve approve <proposal_id> --json
```

## Subcommands

- `improve` — generate candidates, ranked next-best-improvement analysis, and write deterministic artifacts.
- `improve opportunities` — report the highest-leverage next improvement target plus a ranked secondary queue.
- `improve commands` — emit deterministic command-surface improvement recommendations.
- `improve apply-safe` — apply auto-safe proposals only.
- `improve approve <proposal_id>` — apply explicit human approval for governance-gated candidates.

All improve surfaces support side-effect-free `--help` and deterministic JSON failure envelopes for missing/invalid approval inputs.

## Inputs

- `.playbook/memory/events/*`
- `.playbook/learning-state.json`
- `.playbook/learning-compaction.json` (when available)
- `.playbook/process-telemetry.json` (when available)
- `.playbook/outcome-telemetry.json` (when available)
- `.playbook/telemetry/command-quality.json`
- `.playbook/telemetry/command-quality-summary.json` / `.playbook/telemetry/command-quality-summaries.json` (when available)

## Output artifacts

- `.playbook/improvement-candidates.json`
- `.playbook/router-recommendations.json`
- `.playbook/command-improvements.json`

## Categories

- `routing`
- `orchestration`
- `worker_prompts`
- `validation_efficiency`
- `ontology`

## Thresholds

Candidates are emitted only when both thresholds are met:

- `minimum_recurrence = 3`
- `minimum_confidence = 0.6`

## Text summary sections

- `AUTO-SAFE improvements`
- `CONVERSATIONAL improvements`
- `GOVERNANCE improvements`


## Command proposal fields

Command proposals include deterministic evidence and governance metadata:

- `proposal_id`
- `command_name`
- `issue_type`
- `evidence_count`
- `supporting_runs`
- `average_failure_rate`
- `average_duration_ms`
- `average_confidence_score`
- `proposed_improvement`
- `rationale`
- `confidence_score`
- `gating_tier`
- `blocking_reasons`

## Next best improvement analysis

`playbook improve opportunities` is a report-only MVP that ranks improvement candidates based on architectural leverage, not just surface-level code issues.

Default output answers:

- what seam is the best next target
- why it matters
- what the likely change shape is

Current deterministic heuristic classes:

- duplicated derivation logic
- broad query fanout
- missing invalidation boundary
- repeated recompute loops
- canonical ID inconsistency in derived-state paths

Doctrine alignment:

- Rule: Playbook should rank improvement candidates based on architectural leverage, not just surface-level code issues.
- Pattern: High-value improvement candidates often appear as duplicated derivation, missing invalidation boundaries, or repeated non-canonical data flows.
- Failure Mode: A governed tool that cannot surface the next best improvement remains dependent on manual senior-engineer initiative selection.
