# Repository Memory Knowledge Contract

## Purpose

Define deterministic replay/consolidation behavior for `.playbook/memory/*` episodic events and explicit promotion/pruning boundaries for durable local semantic memory artifacts.

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
5. **Local semantic memory (reviewed, non-doctrine by default)**
   - `.playbook/memory/knowledge/decisions.json`
   - `.playbook/memory/knowledge/patterns.json`
   - `.playbook/memory/knowledge/failure-modes.json`
   - `.playbook/memory/knowledge/invariants.json`
6. **Global reusable pattern memory (cross-repo doctrine)**
   - `.playbook/patterns.json` under `PLAYBOOK_HOME`
   - deterministic compat-read legacy path: `patterns.json` under `PLAYBOOK_HOME`
7. **Doctrine/policy memory**
   - rules, contracts, docs, and remediation templates

Pattern: Structural Graph + Memory Graph/Index.

## Replay and promotion pipeline

Canonical flow:

`replay -> promote (human-reviewed) -> prune`

Pattern: **Fast Episodic Store, Slow Doctrine Store**.
Pattern: **Replay Before Promotion**.
Pattern: **Human-Reviewed Knowledge Promotion**.

Promotion requirements:

- candidate id from replay artifact
- provenance preservation (`eventId`, `sourcePath`, run linkage)
- supersession links (`supersedes`, `supersededBy`) where applicable

Rule: **Working Memory Is Not Doctrine**.
Rule: **One canonical storage contract per knowledge scope**.

Promotion into `.playbook/memory/knowledge/*` does **not** automatically rewrite committed rules/docs/contracts. Cross-repo reusable doctrine resolves scope-first to `.playbook/patterns.json` under `PLAYBOOK_HOME`, with deterministic compat-read behavior for legacy `patterns.json`.

## Pruning semantics

Pruning is deterministic and local-memory scoped:

- stale candidate expiration (`lastSeenAt`)
- superseded knowledge cleanup
- duplicate collapse by fingerprint

Rule: Replay/prune operations must never mutate governance doctrine artifacts automatically.

## Retrieval guidance

Memory-aware retrieval should compose:

1. structural context from `.playbook/repo-index.json` + `.playbook/repo-graph.json`
2. relevant episodic events from `.playbook/memory/index.json`
3. promoted local semantic memory artifacts
4. committed governance doctrine where explicitly reviewed and adopted

Rule: **Retrieval Must Return Provenance**.
Pattern: **Scope-First Resolution Beats Path Inference**.
Failure Mode: **Storage-Path Drift Makes Governance Legible In Code But Confusing To Operators**.

## Failure modes

Failure Mode: **Memory Hoarding**.
Failure Mode: **Premature Canonicalization**.
Failure Mode: **Rebuilding Durable Memory From Current Repo State Only**.
Failure Mode: **Candidate Flood From Low-Signal Events**.
