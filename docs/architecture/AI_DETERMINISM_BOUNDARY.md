# AI vs Deterministic Reasoning Boundary

AI-assisted reasoning must remain advisory while deterministic artifacts remain the source of truth.

## Core policy

- Deterministic repository artifacts (`.playbook/repo-index.json`, `.playbook/repo-graph.json`, verify/plan contracts) are authoritative.
- AI output is advisory interpretation layered on top of deterministic command outputs.
- Policy enforcement and remediation eligibility must never depend on opaque AI-only inference.

## Required reasoning chain

AI-facing workflows should follow:

`ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify/plan/apply`

This keeps reasoning grounded in branch-accurate machine-readable artifacts.

## Authoritative vs advisory split

Authoritative (deterministic):

- indexed module/dependency/rule data
- verify findings and failure extraction
- plan/apply task envelopes and schema contracts

Advisory (AI):

- prioritization suggestions
- explanation tone/detail selection
- candidate follow-up investigations

## Prohibited boundary violations

- AI-generated policy decisions without deterministic evidence references
- remediation execution from AI prose without plan contract generation
- bypassing index/query artifacts in favor of broad, stale repository inference when command coverage exists

## Evidence requirement

AI-generated recommendations should reference deterministic sources (artifact path + command surface) and degrade gracefully when required artifacts are missing.

