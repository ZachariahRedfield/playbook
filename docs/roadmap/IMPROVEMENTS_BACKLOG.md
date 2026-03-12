# Playbook Improvement Backlog

## Purpose

This backlog is for **emerging, unscheduled, exploratory** ideas.

It is not the strategic roadmap and not the implementation plan.

- Strategic sequencing lives in `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.
- Machine-readable commitment lives in `docs/roadmap/ROADMAP.json`.
- Dependency-defined architecture lives in `docs/architecture/PLAYBOOK_FINAL_ARCHITECTURE_MAP_AND_CANONICAL_DEPENDENCY_INDEX.md`.

Pattern: Backlog -> Architecture -> Roadmap -> Implementation
Rule: Backlog holds emerging ideas, not already-structured architecture.
Failure Mode: Idea soup after architecture is already defined.

## Minimal promotion rule

Promote a backlog item when one of these is true:

1. **Move to architecture docs** when dependency order, trust boundary, or scope boundary must be made canonical.
2. **Move to roadmap contract (`ROADMAP.json`)** when architecture-defined scope becomes scheduled sequencing intent.
3. **Move to implementation plan** only when roadmap dependencies are satisfied and the work is execution-ready.

If an item is already architecture-defined with clear dependency placement, remove it from this backlog (or replace it with a narrow unresolved question).

---

## Current emerging ideas (unscheduled)

### 1) Narrative and truth-surface drift checks

- Add lightweight checks for wording drift across roadmap/docs/demo surfaces so planned-vs-live language stays clear.
- Add concise `ask --repo-context` boundary examples for operator expectations.

### 2) Knowledge lifecycle guardrail hardening

- Add stricter contracts for candidate vs promoted knowledge states.
- Add deterministic lifecycle audit checks for promotion prerequisites (canonicalization, comparison, compaction evidence).
- Add retirement/supersession hygiene checks for stale promoted artifacts.

### 3) Packaging and deployment boundary hygiene

- Add consistency checks that SKU/deployment framing does not alter runtime semantics.
- Add concise parity assertions for local, hosted, and self-hosted governance semantics.

### 4) Outcome evidence quality improvements

- Refine outcome taxonomy quality gates for confidence and attribution clarity.
- Improve provenance-link completeness checks for feedback artifacts used in later learning decisions.

---

## Backlog hygiene

- Keep items short and exploratory.
- Avoid repeating architecture slices or roadmap sequencing already defined elsewhere.
- Split broad ideas into one unresolved question per entry when possible.
