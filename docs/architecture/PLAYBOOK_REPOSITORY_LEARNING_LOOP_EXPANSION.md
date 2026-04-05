# Playbook Repository Learning Loop Expansion

Status: Canonical architecture direction (human-reviewed; candidate-only outputs)

## Purpose

Define Repository Learning Loop Expansion as a **first-class architecture layer** that produces deterministic, provenance-linked learning artifacts from repeated repository signals while preserving existing governance boundaries:

- no automatic doctrine mutation,
- no policy bypass,
- no hidden write path,
- no promotion without explicit human review.

This document makes graph-informed learning artifacts canonical architecture output for the phase, not an implied future idea.

## Scope boundary

Repository Learning Loop Expansion extends existing replay/consolidation/outcome-learning surfaces with bounded higher-signal aggregation. It does **not** replace:

- verify/plan/apply deterministic mutation flow,
- replay/consolidation salience and review gates,
- promoted-knowledge authority model,
- human-reviewed promotion/demotion/supersession decisions.

## Canonical three-step learning ladder

### 1) Learning clusters (repeated-signal aggregation)

A **learning cluster** is a deterministic grouping of repeated repository signals that point to the same operational issue or improvement opportunity.

Examples of repeated signals:

- recurring verify findings,
- recurring remediation outcomes,
- recurring rollback/deactivation reasons,
- recurring query/help demand for the same module/rule area.

Cluster requirements:

- explicit cluster identity and schema version,
- stable membership/provenance references to source evidence,
- deterministic recurrence metrics (count, window, trend),
- candidate-only lifecycle state with next-review recommendation.

Output class: **candidate learning artifact** (never auto-promoted).

### 2) Graph-informed learning (structural enrichment over clusters)

**Graph-informed learning** enriches learning clusters with repository-structure context from graph/index intelligence (ownership, dependency, and boundary relations).

It answers structural questions such as:

- where in the module graph repeated signals concentrate,
- which dependency boundaries are frequently involved,
- which ownership seams repeatedly appear in the same cluster class.

Graph-informed learning is additive enrichment over learning clusters, not a separate authority layer.

Required boundaries:

- graph context must remain provenance-linked to specific cluster evidence,
- enrichment may adjust review prioritization but cannot mutate doctrine,
- outputs remain candidate-only and human-reviewed.

Output class: **graph-enriched candidate learning artifact**.

### 3) Higher-order synthesis (later step)

**Higher-order synthesis** is a later, explicitly gated step that may propose generalized cross-cluster abstractions after cluster and graph-informed signals are stable.

Higher-order synthesis is not a prerequisite for learning clusters or graph-informed artifacts.

Required boundaries:

- synthesis suggestions are proposal-only,
- promotion authority remains human-reviewed,
- no autonomous enforcement/rule mutation from synthesis outputs.

Output class: **candidate synthesis proposal**.

## Governance invariants (must remain true)

- Learning outputs are candidate-only until explicit review.
- Promotion/demotion/supersession remains human-reviewed.
- Structural enrichment cannot bypass deterministic remediation and policy boundaries.
- Artifact provenance must remain inspectable end-to-end.

## Implementation posture

Repository Learning Loop Expansion should be implemented incrementally as additive, read-first contracts:

1. deterministic learning-cluster artifacts,
2. graph-informed enrichment fields over those clusters,
3. optional later higher-order synthesis proposals.

Each increment must preserve operator-visible contracts and avoid hidden mutation authority expansion.
