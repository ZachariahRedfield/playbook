# Zettelkasten + Attractor Memory + Compression Architecture

## Purpose

This note defines a deterministic memory architecture for Playbook that converges evidence into reusable doctrine.

Playbook memory is not a passive note store. It is a convergence-and-compaction system driven by RunCycle execution.

## Convergence model

```text
raw evidence
-> zettels
-> links
-> convergence
-> pattern cards
-> contracts
```

### Playbook mapping

- `zettel` = atomic evidence-bearing note
- `zettel link` = typed association / retrieval edge
- `pattern card` = stabilized attractor
- `contract` = hard attractor / invariant
- `RunCycle` = spiral learning iteration
- `compaction` = compression pressure toward minimal stable doctrine
- `promotion` = transition from soft attractor to hard attractor

## Spiral lifecycle model

```text
RunCycle(n)
-> observe
-> verify
-> plan
-> apply
-> extract
-> zettels
-> compact
-> promote
-> RunCycle(n+1)
```

Each cycle expands evidence and then compresses it inward into reusable attractors.

## Lifecycle semantics

### Accumulation

Evidence is captured into zettels. This is temporary working memory and may grow quickly.

### Convergence

Typed links and repeated retrieval pressure cluster related zettels into coherent patterns.

### Compression

Compaction removes redundant variation and preserves only stable distinctions needed for future decisions. This is a minimum-description-length (MDL) step: keep the smallest doctrine that still predicts and guides outcomes.

### Promotion

A stabilized pattern is promoted into a contract only when invariant-level confidence is achieved and governance checks pass.

## Soft attractors vs hard attractors

- Pattern cards are **soft attractors**: reusable, high-signal summaries that can still be revised as new evidence arrives.
- Contracts are **hard attractors**: enforced invariants that must remain deterministic and stable across cycles.

Zettels are not the memory endpoint; stabilized patterns are. Contracts are the policy endpoint when stabilization reaches invariant confidence.

## Optimization objective

Playbook should optimize for:

- reuse rate (how often patterns/contracts are used to guide future runs)
- compaction gain (how much redundant evidence is collapsed without losing required distinctions)

Playbook should not optimize for raw note count. High zettel volume without convergence is memory debt.

## Rule / Pattern / Failure Mode

Rule:
Zettels may accumulate temporarily, but only stabilized patterns and promoted contracts count as durable memory.

Pattern:
Playbook learns through spiral cycles: each RunCycle expands evidence, then compresses it inward into reusable attractors.

Failure Mode:
A zettelkasten that does not converge becomes a note heap; a compactor that over-merges destroys distinctions and causes doctrine drift.
