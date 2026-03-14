# Cross-Repo Pattern Candidates Contract (v1)

## Purpose

`cross-repo-candidates.schema.json` defines a deterministic, additive artifact for normalized candidate family aggregates across repositories.

Artifact path:

- `.playbook/cross-repo-candidates.json`

Cross-repo candidates represent normalized candidate families across repositories, **not canonical patterns**.

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

## Pattern

Separate per-repo observations from cross-repo aggregates.

## Failure mode

Mixing repo-local signals directly into doctrine candidates introduces architecture bias.
