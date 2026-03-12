# Repository Memory Knowledge Contract

## Purpose

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
