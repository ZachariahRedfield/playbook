# Repository Memory Knowledge Contract

## Purpose

Define deterministic replay/consolidation behavior for `.playbook/memory/*` episodic events into candidate knowledge artifacts for human review.

## Replay pipeline

Canonical flow:

1. Read `.playbook/memory/index.json`.
2. Resolve and load each referenced event file.
3. Cluster events by `fingerprint/module/rule/failure shape`.
4. Compute deterministic salience factors from explicit event inputs only.
5. Emit `.playbook/memory/candidates.json`.

Replay is read-only with respect to repository source/governance files (rules/docs/code).

## Pattern: Replay Before Promotion

All candidate knowledge promotion decisions should start from replayed clustered events with provenance, not ad-hoc narrative memory.

## Rule: Salience Gates Consolidation

Candidate generation and ordering must be driven by explicit salience factors only:

- severity
- recurrence count
- cross-module breadth
- risk score
- persistence across runs
- ownership/docs gaps
- novel successful remediation shape

No hidden/implicit model inference is allowed to alter salience ordering.

## Failure Mode: Candidate Flood From Low-Signal Events

When low-signal events bypass salience gates, candidate volume rises while reviewer signal quality drops. Replay implementations should preserve deterministic clustering and scoring to keep candidate sets reviewable.

## Candidate schema expectations

Each candidate in `.playbook/memory/candidates.json` includes:

- stable candidate id
- kind (`decision | pattern | failure_mode | invariant | open_question`)
- salience score and factor breakdown
- cluster key (`fingerprint/module/rule/failure shape`)
- provenance references (`eventId`, `sourcePath`, run context)
Define governance boundaries between episodic repository memory and durable doctrine/policy memory.

This contract formalizes promotion/prune semantics as documentation and roadmap intent without changing runtime behavior yet.

## Memory classes

1. **Structural intelligence**
   - `.playbook/repo-index.json`
   - `.playbook/repo-graph.json`
2. **Working context**
   - `.playbook/context/*`
3. **Episodic memory**
   - `.playbook/memory/events/*.json`
   - `.playbook/memory/index.json`
4. **Replay/consolidation candidates**
   - `.playbook/memory/candidates.json`
5. **Doctrine/policy memory**
   - rules, contracts, docs, and remediation templates

Pattern: Structural Graph + Memory Graph/Index.
Rule: Promotion Required for Durable Doctrine.

## Promotion boundary

Durable doctrine must only be created from reviewed candidate knowledge.

Minimum promotion evidence:

- source event lineage
- deterministic replay/consolidation summary
- human/policy decision record
- resulting doctrine target references (rule/contract/doc/template)

## Prune/supersede boundary

Promotion does not imply infinite retention.

Required lifecycle controls:

- stale-candidate pruning
- superseded doctrine linkage
- explicit demotion/retirement records where applicable

Pattern: Fast Episodic Store, Slow Doctrine Store.

## Retrieval guidance

Memory-aware retrieval should compose:

1. structural context from `.playbook/repo-index.json` + `.playbook/repo-graph.json`
2. relevant episodic events from `.playbook/memory/index.json`
3. promotion-approved doctrine artifacts

Rule: Replay Is Human-Review-Oriented, Not Autonomous Mutation.

## Failure modes

Failure Mode: Memory Hoarding.
Failure Mode: Rebuilding Durable Memory From Current Repo State Only.
