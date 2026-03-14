# Cross-Repo Pattern Candidates Contract (v1)

## Purpose

`cross-repo-candidates.schema.json` defines a deterministic, additive artifact for normalized candidate family aggregates across repositories.

Artifact path:

- `.playbook/cross-repo-candidates.json`

Cross-repo candidates represent normalized candidate families across repositories, **not canonical patterns**.

## Aggregation and normalization overview

Cross-repo candidate aggregation reads each repository-local `.playbook/pattern-candidates.json` artifact as immutable input evidence.

The aggregation flow is deterministic:

1. Load candidate artifacts per repository without mutating repo-local files.
2. Normalize each candidate `pattern_family` into a canonical family key before grouping.
3. Merge grouped families across repositories.
4. Compute aggregate family metrics:
   - `repo_count`
   - `candidate_count`
   - `mean_confidence`
   - `first_seen`
   - `last_seen`
5. Emit `.playbook/cross-repo-candidates.json` with lexicographically sorted `pattern_family` entries and deterministic repo lists.

This preserves repository-local provenance while producing stable cross-repo evidence summaries for downstream review.

## Contract shape

Top-level fields:

- `schemaVersion`: fixed schema version (`1.0`)
- `kind`: fixed artifact kind (`cross-repo-candidates`)
- `generatedAt`: deterministic ISO date-time for the aggregate run
- `repositories`: deterministic repository identifiers included in the aggregate run
- `families`: additive list of normalized cross-repo family aggregates

Each `families[]` entry contains:

- `pattern_family`: normalized family identifier
- `repo_count`: bounded repository count for the family aggregate
- `candidate_count`: bounded candidate observation count for the family aggregate
- `mean_confidence`: bounded confidence average (`0..1`)
- `repos`: deterministic repository identifiers that contributed to the aggregate
- `first_seen`: earliest deterministic ISO date-time observed for the family
- `last_seen`: latest deterministic ISO date-time observed for the family

## Determinism and governance

- Families must be emitted in deterministic order (lexicographic `pattern_family` ordering recommended).
- Repository identifiers must be emitted in deterministic order.
- Cross-repo artifacts are append-only aggregates; consumers must treat this artifact as additive history.
- Per-repo observations remain source-of-truth inputs; cross-repo artifacts summarize but do not replace them.
- Cross-repo aggregation must remain independent from canonical doctrine promotion.

## Rule

Cross-repo artifacts must remain deterministic and append-only.

Cross-repo learning must aggregate evidence without mutating per-repo artifacts.

## Pattern

Separate per-repo observations from cross-repo aggregates.

Normalize candidate families before computing cross-repo metrics.

## Failure mode

Mixing repo-local signals directly into doctrine candidates introduces architecture bias.

Directly merging candidate IDs across repos causes duplicate abstractions and unstable doctrine proposals.
