# `pnpm playbook knowledge`

Inspect normalized knowledge artifacts through read-only deterministic surfaces.

Command boundary:

- `pnpm playbook memory ...` is the raw lifecycle/review/mutation surface for memory artifacts.
- `pnpm playbook knowledge ...` is the normalized read-only inspection/query surface.

## Subcommands

### `knowledge list`

List all evidence, candidate, promoted, superseded, and normalized global reusable pattern records. This now includes reviewable pattern lifecycle candidates emitted from runtime receipts, drift signals, promotion history, and later portability outcomes.

### `knowledge query`

Filter knowledge records with:

- `--type`
- `--status`
- `--lifecycle`
- `--module`
- `--rule`
- `--text`
- `--limit`

### `knowledge inspect <id>`

Inspect one knowledge record by id, including normalized lifecycle metadata, warnings, and supersession links.

### `knowledge compare <left-id> <right-id>`

Compare two knowledge records and surface overlapping evidence IDs, fingerprints, and related-record links.

### `knowledge timeline`

Show the knowledge timeline in deterministic order.

### `knowledge provenance <id>`

Resolve direct evidence and related-record lineage for one knowledge record.

### `knowledge supersession <id>`

Resolve deterministic `supersedes` / `superseded-by` chains for one knowledge record.

### `knowledge stale`

List stale candidates plus non-active knowledge (`retired`, `superseded`, and demoted global reusable patterns).

Lifecycle guarantees:

- Query surfaces distinguish `active`, `candidate`, `stale`, `retired`, `superseded`, and `demoted` lifecycle truth explicitly.
- Read-only inspection reveals lifecycle truth without mutating it.
- Lifecycle recommendations surface as candidate records sourced from `.playbook/memory/lifecycle-candidates.json`; they remain advisory-only and retain exact evidence references plus target pattern ids.
- Global reusable patterns are normalized into the same inspection surface as repo-local memory so provenance and supersession remain auditable from one command family. Scope-first resolution keeps global reads pinned to `.playbook/patterns.json` under `PLAYBOOK_HOME` while still allowing deterministic compat reads from legacy `patterns.json`.
- JSON list/query/timeline/stale summaries expose lifecycle counts in `summary.byLifecycle` alongside `byType` and `byStatus` so deterministic consumers can reason about lifecycle distribution without re-aggregating records.

### `knowledge portability`

Inspect deterministic cross-repo portability review surfaces.

Views:

- `overview` (default): portability scoring evidence (`source_repo`, `portability_score`, `evidence_runs`, compatible subsystems, risk signals)
- `recommendations`: transfer recommendations (`pattern`, `source_repo`, `target_repo`, `initial_portability_score`, `decision_status`, `evidence_count`)
- `outcomes`: decision/adoption outcomes (`pattern`, `source_repo`, `target_repo`, `initial_portability_score`, `adoption_status`, `observed_outcome`, `sample_size`)
- `recalibration`: confidence updates (`pattern`, `source_repo`, `target_repo`, `initial_portability_score`, `recalibrated_confidence`, `evidence_count`, `sample_size`)
- `transfer-plans`: proposal-only transfer plan rows from `.playbook/transfer-plans.json` (`pattern`, `source_repo`, `target_repo`, `portability_confidence`, `readiness_score`, `required_artifacts`, `required_validations`, `adoption_steps`, `risk_signals`, `gating_tier`, `blockers`, `open_questions`)
- `readiness`: compatibility/readiness rows from `.playbook/transfer-readiness.json` (`pattern`, `target_repo`, `readiness_score`, `recommendation`, required/missing subsystems, artifacts, validations, contracts, blockers, missing prerequisites, open questions)
- `blocked-transfers`: readiness subset where blockers or blocked recommendations are present, preserving the same audit fields used by `readiness`

## Examples

```bash
pnpm playbook knowledge list --json
pnpm playbook knowledge query --type candidate --json
pnpm playbook knowledge inspect <id> --json
pnpm playbook knowledge compare <left-id> <right-id> --json
pnpm playbook knowledge provenance <id> --json
pnpm playbook knowledge supersession <id> --json
pnpm playbook knowledge stale --json
pnpm playbook knowledge portability
pnpm playbook knowledge portability --view recommendations
pnpm playbook knowledge portability --view outcomes --json
pnpm playbook knowledge portability --view recalibration --json
pnpm playbook knowledge portability --view transfer-plans --json
pnpm playbook knowledge portability --view readiness --json
pnpm playbook knowledge portability --view blocked-transfers --json
```

## Guarantees

- Read-only command family
- Deterministic normalized record shape
- Provenance-preserving output
- Lifecycle-aware filtering and warnings without introducing mutation routes
