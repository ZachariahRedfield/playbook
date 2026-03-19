# Cross-Repo Pattern Candidates Contract (v1)

## Purpose

`cross-repo-candidates.schema.json` defines a deterministic, additive artifact for read-only cross-repository pattern candidates derived from governed comparison outputs.

Artifact path:

- `.playbook/cross-repo-candidates.json`

Cross-repo candidates are derived summaries plus provenance references. They are not canonical patterns, and they never copy source artifact bodies into the shared store.

## Derivation overview

Cross-repo candidate materialization reuses existing governed cross-repo comparison output.

The deterministic flow is:

1. Load structured cross-repo comparison/intelligence output.
2. Select only candidate observations backed by evidence from at least two repositories.
3. Normalize each candidate into an exact deterministic `normalizationKey`.
4. Build stable candidate ids from `normalizationKey` plus a hash of sorted `sourceRefs`.
5. Emit lexicographically sorted candidates with references-only provenance.

## Contract shape

Top-level fields:

- `schemaVersion`: fixed schema version (`1.0`)
- `kind`: fixed artifact kind (`cross-repo-candidates`)
- `generatedAt`: deterministic ISO date-time for the aggregate run
- `repositories`: deterministic repository identifiers included in the aggregate run
- `candidates`: additive list of derived cross-repo pattern candidates

Each `candidates[]` entry contains:

- `id`: stable candidate id derived from `normalizationKey` and hashed `sourceRefs`
- `title`: deterministic human-readable summary
- `when`: bounded trigger context for the candidate
- `then`: bounded recommended review action
- `because`: bounded justification derived from cross-repo evidence
- `normalizationKey`: exact deterministic normalization identity
- `sourceRefs`: deterministic, sorted provenance references only
- `storySeed`: deterministic review/backlog seed with title, rationale, and acceptance criteria
- `fingerprint`: deterministic content fingerprint for the derived candidate

## Determinism and governance

- Emit candidates in deterministic order.
- Emit `sourceRefs` in deterministic order.
- Tests that assert full artifact equality should inject generation time at the artifact boundary instead of reading wall-clock time inside assertions.
- Require evidence from at least two repositories before a candidate can appear.
- Store references only; do not copy source artifact bodies, receipts, or raw governed payloads into the shared artifact.
- Keep materialization read-only. Promotion remains explicit and out of band.

## Rule

Cross-repo candidates must be deterministic, references-only summaries derived from governed comparison output.

## Pattern

Materialize promotable cross-repo summaries from existing intelligence artifacts instead of rescanning raw repositories.

## Failure mode

Copying artifact bodies into the shared store leaks too much raw state and makes promotion targets unstable.
