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

- Storage contract: `repo_local_memory` resolves from `.playbook/memory/knowledge/patterns.json`, `global_reusable_pattern_memory` resolves from `.playbook/patterns.json` under `PLAYBOOK_HOME` with deterministic compat-read fallback to legacy `patterns.json`, and `cross_repo_proposal_bridge` resolves from `.playbook/pattern-proposals.json`.
- Query surfaces distinguish `active`, `candidate`, `stale`, `retired`, `superseded`, and `demoted` lifecycle truth explicitly.
- Read-only inspection reveals lifecycle truth without mutating it.
- Lifecycle recommendations surface as candidate records sourced from `.playbook/memory/lifecycle-candidates.json`; they remain advisory-only and retain exact evidence references plus target pattern ids.
- Global reusable patterns are normalized into the same inspection surface as repo-local memory so provenance and supersession remain auditable from one command family.
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

### `knowledge review`

Materialize and inspect `.playbook/review-queue.json` through the existing retrieval review surface under the knowledge command family.

Filters:

- `--action reaffirm|revise|supersede`
- `--kind knowledge|doc|rule|pattern`
- `--due now|overdue|all` (default `all`)
- `--trigger cadence|evidence|all` (default `all`)
- `--trigger-source <source>` (exact trigger source match, e.g. `architecture-decision`)

Trigger metadata surfaced in JSON (`entries[*]` and persisted queue artifact):

- `triggerType`
- `triggerReasonCode`
- `triggerSource`
- `triggerEvidenceRefs`

Cadence fields surfaced in JSON (`entries[*]` when present and additive summaries):

- `nextReviewAt`
- `overdue`
- `deferredUntil`

Text output remains compact and operator-facing:

- status
- Evidence-triggered
- affected targets
- Next action

Cadence schedules recall, while evidence can reopen or raise recall priority without creating a new command family.

Review recording remains receipt-only; it does not auto-promote or auto-supersede doctrine.

JSON output and `.playbook/review-queue.json` preserve full deterministic trigger/cadence detail for automation consumers.

Architecture-decision recall is trigger-driven: `docs/architecture/decisions/*.md` must publish explicit `## Review Triggers` lines in canonical format (`- [trigger_id] when <observable condition> -> <required review action>`), and satisfied signals are merged as additive `triggerSource=architecture-decision` evidence entries.

Rule: Architecture decisions should be recalled through explicit trigger metadata, not ad hoc memory.

Pattern: Queue + receipt + cadence + evidence + decision triggers = governed review.

Failure Mode: Architecture review triggers live only in docs and never become operational review signals.

### `knowledge review handoffs`

Materialize and inspect proposal-only follow-up handoffs from retrieval review outcomes using `.playbook/review-handoffs.json`.
Compile deterministic downstream routing suggestions into `.playbook/review-handoff-routes.json` so next governed surfaces are explicit.

Filters:

- `--decision revise|supersede`
- `--kind knowledge|doc|rule|pattern`

Text output stays brief-thin:

- status
- affected targets
- recommended follow-up
- next action

Behavior guarantees:

- proposal-only handoff visibility
- no auto-promotion
- no auto-supersession
- no second mutation executor
- full detail retained in JSON output and `.playbook/review-handoffs.json`
- deterministic route detail retained in `.playbook/review-handoff-routes.json` with no auto-mutation authority

Routing matrix (canonical, compact, and aligned to routed artifact fields):

| `decision` | `kind` | routed follow-up surface | routing semantics |
| --- | --- | --- | --- |
| `revise` | `doc` | docs revision | route a docs follow-up handoff (`recommendedFollowUp=docs-revision`) |
| `revise` | `knowledge` / `rule` / `pattern` | promote/memory follow-up | route a promotion-oriented follow-up handoff (`recommendedFollowUp=promote-or-memory`) |
| `supersede` | `knowledge` / `rule` / `pattern` | supersession follow-up | route a supersession follow-up handoff (`recommendedFollowUp=supersession`) |
| `defer` | any | none | no immediate route (receipt only) |
| `reaffirm` | any | none | no route (receipt only) |

### `knowledge review routes`

Materialize and inspect proposal-only routed follow-up suggestions from retrieval handoffs using `.playbook/review-handoff-routes.json`.

Filters:

- `--surface story|promote|docs|memory`
- `--decision revise|supersede`
- `--kind knowledge|doc|rule|pattern`

Text output stays brief-thin:

- status
- affected targets
- recommended surface
- next action

Behavior guarantees:

- proposal-only routed visibility
- no write or mutation path
- no auto-promotion
- no auto-supersession
- full route detail retained in JSON output and `.playbook/review-handoff-routes.json`

### `knowledge review record`

Record a durable retrieval review outcome in `.playbook/knowledge-review-receipts.json` from an existing queue entry.

Required options:

- `--from <queueEntryId>`
- `--decision reaffirm|revise|supersede|defer`

Optional options:

- `--reason-code <id>`
- `--evidence-ref <value>` (repeatable)
- `--followup-ref <value>` (repeatable; first value is stored as `followUpArtifactPath`)
- `--receipt-id <id>` (stable overwrite semantics for repeated writes)

Behavior guarantees:

- records the review receipt only
- does not auto-promote
- does not auto-supersede
- does not mutate active doctrine

Text output remains thin:

- decision
- affected target
- next action

JSON output and `.playbook/knowledge-review-receipts.json` preserve full deterministic detail.

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
pnpm playbook knowledge review --json
pnpm playbook knowledge review --due overdue --json
pnpm playbook knowledge review --trigger evidence --json
pnpm playbook knowledge review --action reaffirm --kind knowledge --due all
pnpm playbook knowledge review --kind doc
pnpm playbook knowledge review handoffs --json
pnpm playbook knowledge review handoffs --decision revise --kind doc --json
pnpm playbook knowledge review routes --json
pnpm playbook knowledge review routes --surface docs --decision revise --kind doc --json
pnpm playbook knowledge review record --from <queue-entry-id> --decision defer --json
```

## Guarantees

- Read-only command family
- Deterministic normalized record shape
- Provenance-preserving output
- Lifecycle-aware filtering and warnings without introducing mutation routes
- Rule: Review surfaces recall governed knowledge without mutating it.
- Pattern: Use existing review families before inventing new top-level command families.
- Failure Mode: Retrieval review that lands as a new command silo instead of an existing review surface fragments the workflow.
- Rule: One canonical storage contract per knowledge scope.
- Pattern: Scope-first resolution beats path inference.
- Failure Mode: Storage-path drift makes governance legible in code but confusing to operators.
- Rule: Retrieval review is incomplete until the review decision is recorded as a durable artifact.
- Rule: Retrieval review needs both receipts and cadence, or reaffirmed knowledge will either disappear forever or reappear as noise.
- Rule: Cadence metadata schedules retrieval review only and must not mutate doctrine.
- Rule: Existing review surfaces should absorb cadence before inventing new workflow silos.
- Pattern: Recall -> reinterpret -> receipt -> scheduled recall.
- Rule: Existing review surfaces should absorb evidence-triggered recall before inventing new workflow silos.
- Rule: Existing review surfaces should expose follow-up handoffs before inventing a new command family.
- Rule: Existing review surfaces should expose routed next steps before inventing new command families.
- Pattern: Queue + receipt + cadence + evidence = governed retrieval review.
- Pattern: One review family should cover queue, receipt, and next-step handoff.
- Pattern: Queue -> receipt -> handoff -> routed follow-up, all inside one review family.
- Rule: Proposal-only review handoffs should compile into explicit next governed surfaces, not depend on operator memory.
- Pattern: Review receipt -> handoff -> routed follow-up -> explicit reviewed action.
- Failure Mode: Review queues without cadence become either spammy or silently stale.
- Failure Mode: A review system that cannot say when something should return encourages ad hoc maintenance.
- Failure Mode: Review systems that ignore fresh evidence become formally tidy but operationally stale.
- Failure Mode: Review outcomes become dead-end records instead of governed work handoffs.
- Failure Mode: Review handoffs become a dead-end list instead of a governed bridge to action.
- Failure Mode: Handoffs can exist while next steps still require manual reconstruction when routed follow-up artifacts are missing.
