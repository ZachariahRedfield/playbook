# `pnpm playbook ignore`

Suggest and safely apply ranked `.playbookignore` recommendations from Playbook runtime artifacts.

## Usage

- `pnpm playbook ignore suggest --repo "<target-repo-path>" --json`
- `pnpm playbook ignore apply --repo "<target-repo-path>" --safe-defaults`
- `pnpm playbook ignore apply --repo "<target-repo-path>" --safe-defaults --json`

## Behavior

`ignore suggest` reads `.playbook/runtime/current/ignore-recommendations.json` and reports:

- ranked recommendations
- safety level
- rationale
- expected scan impact
- whether each recommendation is already covered by `.playbookignore`

`ignore apply --safe-defaults`:

- creates `.playbookignore` when needed
- preserves user-authored lines outside the managed block
- writes only missing `safe-default` entries
- keeps `likely-safe` and `review-first` recommendations in suggestion-only output
- avoids duplicate entries across user content and the managed block
- rewrites the managed block deterministically so reruns are idempotent
- records outcome telemetry to `.playbook/runtime/current/ignore-apply.json` and `.playbook/runtime/cycles/<cycle_id>/ignore-apply.json` with explicit fields:
  - `applied_count`
  - `already_present_count`
  - `safe_default_deferred_count`
  - `review_first_count`
  - `applied_paths`
  - `already_present_paths`
  - `safe_default_deferred_paths`
  - `review_first_paths`
- retains compact historical rollups in `.playbook/runtime/history/ignore-apply-stats.json` (`*_total` and `last_*` fields)
- keeps compatibility aliases for existing artifact readers:
  - `deferred_count` (legacy, now mirrors `review_first_count`)
  - `deferred_paths` (legacy, now mirrors `review_first_paths`)

Managed block format:

- start marker: `# PLAYBOOK:IGNORE_START`
- end marker: `# PLAYBOOK:IGNORE_END`

Rule - Apply Only Trusted Ignore Recommendations.

Pattern - Recommendation Before Application, Safe Defaults Before Review.

Failure Mode - Auto-Applying Ambiguous Ignores.

Failure Mode - Non-Idempotent Ignore Management.
