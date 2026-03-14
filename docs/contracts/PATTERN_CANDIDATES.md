# Pattern Candidates Contract (v1)

## Purpose

`pattern-candidates.schema.json` defines a deterministic, additive, read-only artifact for automatically extracted structural observations.

Artifact path:

- `.playbook/pattern-candidates.json`

Candidates are **observations**, not doctrine.

## Contract shape

Top-level fields:

- `schemaVersion`: fixed schema version (`1.0`)
- `kind`: fixed artifact kind (`pattern-candidates`)
- `generatedAt`: generation timestamp (ISO date-time)
- `candidates`: additive list of extracted candidate observations

Each `candidates[]` entry contains:

- `id`: stable unique candidate id
- `pattern_family`: coarse pattern family classification
- `title`: short human-readable summary
- `description`: deterministic extraction narrative
- `source_artifact`: originating extraction artifact path
- `signals`: bounded list of extraction signals used to derive the candidate
- `confidence`: bounded extraction confidence (`0..1`)
- `evidence_refs`: deterministic evidence references
- `status`: candidate lifecycle state (`observed`, `triaged`, `accepted`, `rejected`)

## Determinism and governance

- Candidate records are extraction outputs and must remain read-only from downstream consumers.
- Candidate IDs must be stable across runs for the same structural observation.
- Candidate arrays should be emitted in deterministic order (lexicographic `id` ordering recommended).
- Candidate observations must remain separate from canonical pattern graph nodes.
- Promotion into canonical knowledge requires explicit governance review; candidates are never doctrine by default.

## Rule

Pattern candidates are extraction outputs, not promoted knowledge.

## Pattern

Separate candidate observations from canonical pattern graph nodes.

## Failure mode

Collapsing candidates directly into patterns destroys governance and makes detector noise look like truth.
