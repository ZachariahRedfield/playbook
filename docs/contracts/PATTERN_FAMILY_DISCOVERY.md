# Pattern Family Discovery Contract (v1)

## Purpose

`pattern-family-discovery.schema.json` defines deterministic cross-repository family clustering for extracted candidates.

Artifact path:

- `.playbook/pattern-family-discovery.json`

This contract is the normalization step between candidate extraction and doctrine promotion.

Flow:

1. Observe (`pattern-candidates` extraction)
2. Normalize (family clustering and canonicalization)
3. Aggregate (cross-repo counts/confidence)
4. Propose (downstream doctrine candidate workflows)

## Contract shape

Top-level fields:

- `schemaVersion`: fixed schema version (`1.0`)
- `kind`: fixed artifact kind (`pattern-family-discovery`)
- `generatedAt`: deterministic run timestamp
- `repositories`: deterministic list of repository IDs participating in discovery
- `families`: normalized family aggregates
- `assignments`: per-candidate normalization mapping records

Each `families[]` entry contains:

- `pattern_family`: canonical family name inferred from clustering
- `repo_count`: number of repositories containing candidates in this family
- `candidate_count`: number of candidates mapped into this family
- `mean_confidence`: rounded mean of candidate confidence scores
- `candidate_ids`: candidate IDs grouped into this family (IDs remain unchanged)

Each `assignments[]` entry contains:

- `candidate_id`: original candidate ID
- `repo_id`: source repository ID
- `source_pattern_family`: pre-normalization candidate family value
- `pattern_family`: normalized canonical family value

## Determinism and governance

- Discovery reads `.playbook/pattern-candidates.json` as input and must not mutate those artifacts.
- Automatic family discovery may normalize candidates but must never rewrite original candidate artifacts.
- Candidate IDs are immutable identifiers and must remain unchanged while families are grouped.
- Family naming is canonicalized deterministically to reduce cross-repo doctrine fragmentation.

## Rule

Automatic family discovery may normalize candidates but must never rewrite original candidate artifacts.

## Pattern

Observe → normalize → aggregate → propose.

## Failure mode

Directly merging candidate families into canonical patterns without normalization causes doctrine fragmentation.
