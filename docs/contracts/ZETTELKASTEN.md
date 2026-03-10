# Zettelkasten Contract

## Purpose

This contract defines deterministic lifecycle semantics for Playbook zettels and link artifacts.

Zettelkasten artifacts are working-memory evidence structures used by RunCycle consolidation.
They are not durable memory by default.

## Artifact paths

Runtime output paths:

- `.playbook/zettelkasten/zettels.jsonl`
- `.playbook/zettelkasten/links.jsonl`

Committed examples may be stored under `.playbook/demo-artifacts/` as static snapshots.

## Zettel minimum shape

Each zettel record should include:

- `zettelId`
- `originCycleId`
- `kind`
- `sourceArtifactPath`
- `evidenceRef`
- `links` (typed relation list or references into `links.jsonl`)
- `promotedPatternId` (nullable)
- `status`

## Status lifecycle

Allowed status progression:

1. `draft|observed` — captured evidence, not yet integrated
2. `linked` — connected through typed associations
3. `converged` — repeatedly linked into a stable cluster
4. `compacted` — incorporated into a pattern-level compressed representation
5. `promoted` — upstream stabilization reached contract-level invariant via pattern promotion
6. `retired` — no longer active due to supersession/merge/deprecation

Lifecycle intent:

- accumulation is permitted at `draft|observed` and `linked`
- durable memory starts at stabilized `converged/compacted` pattern behavior
- contract durability is explicit only after promotion gates

## Link semantics

Links represent typed retrieval edges between zettels and may include:

- `supports`
- `refines`
- `contrasts`
- `duplicates`
- `derived-from`
- `elevates-to-pattern`

Typed links must preserve provenance and allow deterministic replay of convergence decisions.

## RunCycle alignment

Each zettel must retain `originCycleId` so memory consolidation remains traceable to one RunCycle iteration.

RunCycle outputs should reference zettelkasten artifact digests and downstream pattern/contract promotion metrics when available.


## State-space interpretation bridge

Zettelkasten evidence quality directly affects state-space coherence:

- coherent linked evidence tends toward lower-noise, higher-confidence cycle states
- contradictory or stale zettels increase mixed-state behavior (ambiguity/noise)
- compaction acts as projection toward lower-entropy representations while preserving required distinctions
- promotion marks governance-approved stabilization from soft attractor patterns to hard attractor contracts

Use this bridge with `docs/architecture/BLOCH_SPHERE_STATE_SPACE.md` and `docs/contracts/STATE_SPACE.md` for deterministic diagnostics framing.

## Rule / Pattern / Failure Mode

Rule:
Zettels may accumulate temporarily, but only stabilized patterns and promoted contracts count as durable memory.

Pattern:
Playbook learns through spiral cycles: each RunCycle expands evidence, then compresses it inward into reusable attractors.

Failure Mode:
A zettelkasten that does not converge becomes a note heap; a compactor that over-merges destroys distinctions and causes doctrine drift.
