# Pattern Outcomes Contract (v1)

## Purpose

`pattern-outcomes.schema.json` defines a deterministic, additive artifact for linking known patterns to measurable system outcomes (fitness signals).

Artifact path:

- `.playbook/pattern-outcomes.json`

## Contract shape

Top-level fields:

- `schemaVersion`: fixed schema version (`1.0`)
- `kind`: fixed artifact kind (`pattern-outcomes`)
- `generatedAt`: generation timestamp (ISO date-time)
- `links`: additive list of pattern-to-outcome links

Each `links[]` entry contains:

- `id`: stable unique id for the outcome link
- `pattern_id`: referenced pattern id (for example from `pattern-graph`)
- `outcome_signal`: bounded outcome vocabulary
- `direction`: relationship direction (`positive`, `negative`, `mixed`)
- `confidence`: bounded confidence score (`0..1`)
- `evidence_refs`: deterministic evidence references
- `notes` (optional): explanatory context

## Outcome signal vocabulary

The v1 schema currently supports:

- `low-blast-radius`
- `stable-contract-surface`
- `low-plan-churn`
- `low-governance-violations`
- `deterministic-artifacts`
- `high-test-pass-stability`

## Determinism and evolution

- Links are append-only for safe additive evolution.
- IDs and references should remain stable to preserve diffability and reproducible automation.
- Confidence values are metadata and must remain bounded (`0..1`) to keep scoring contracts machine-safe.

## Rule

Pattern outcomes must use bounded signal vocabularies and deterministic identifiers before introducing dynamic inference.

## Pattern

Explicit pattern-to-outcome links make fitness reasoning queryable without coupling scoring logic into structural pattern contracts.

## Failure mode

Unbounded ad-hoc outcome labels cause contract drift and reduce comparability across runs.
