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

Canonical roadmap directions for Repository Memory System, Replay / Consolidation / Promotion, Control Plane / Agent Runtime v1, and Outcome Learning / Policy Improvement are intentionally excluded from this backlog. Keep backlog entries limited to unresolved follow-on questions or quality refinements only.


### 1) Narrative and truth-surface drift checks

- Add lightweight checks for wording drift across roadmap/docs/demo surfaces so planned-vs-live language stays clear.
- Add concise `ask --repo-context` boundary examples for operator expectations.

### 2) Packaging and deployment boundary hygiene

- Add consistency checks that SKU/deployment framing does not alter runtime semantics.
- Add concise parity assertions for local, hosted, and self-hosted governance semantics.

### 3) Outcome evidence quality improvements

- Refine outcome taxonomy quality gates for confidence and attribution clarity.
- Improve provenance-link completeness checks for feedback artifacts used in later learning decisions.

### 4) Playbook Agents follow-on questions

- Clarify the thinnest viable contract for Playbook-native agents as governed lane executors rather than generic chat surfaces.
- Define the minimum artifact/runtime seam between `story -> plan -> lane -> execution -> receipt` needed before a first agent runtime slice is worth implementing.
- Treat worker fragment consolidation for protected singleton docs as a prerequisite for any managed subagent / hooks expansion, then narrow the remaining unresolved agent-runtime questions after that slice is architecture-defined.
- Keep dependency order explicit for future orchestration: `worker partitioning / overlap detection -> worker-local fragments / receipts -> final consolidation pass for singleton narrative docs -> managed subagents / hooks`.
- Identify the first bounded agent roles that improve operator leverage without expanding trust scope too early (for example docs cleanup, upgrade assistance, audit/remediation support).
- Clarify whether future agent-authoring belongs under Automation Synthesis, Control Plane, or a later reviewed knowledge-consumption layer.

Pattern: Playbook orchestrates intelligence; agents execute bounded work inside governed lanes.
Rule: Agents must execute from explicit plans and emit receipts for every meaningful state transition.
Failure Mode: Agents operating outside the Playbook control plane create invisible mutation paths and weaken trust.

---

## Backlog hygiene

- Keep items short and exploratory.
- Avoid repeating architecture slices or roadmap sequencing already defined elsewhere.
- Split broad ideas into one unresolved question per entry when possible.

---

### 5) External consumer upgrade boundary manifest follow-on

- Define the thinnest viable manifest or equivalent contract that distinguishes Playbook-managed paths from repo-local protected paths for external consumer repos.
- Clarify the first migration-safe upgrade behaviors after doctrine is committed: managed-surface detection, protected-path refusal, and explicit migration hooks for repo-owned files.
- Keep the consumer-repo local layer explicit, including repo-local `AGENT.md` as product truth rather than framework-owned doctrine.
- Treat upgrade safety as a trust boundary: future `playbook upgrade` work should mutate managed surfaces only and refuse silent writes into repo-owned product files.

Rule: Upgrade must be scoped to managed artifacts only; repo-owned files are immutable unless explicitly migrated.
Pattern: A safe framework upgrade system separates Playbook-managed surfaces from repo-local product truth.
Pattern: Repo-local `AGENT.md` is the consumer repo’s execution identity layer.
Failure Mode: Upgrade flows that cannot distinguish managed from local files eventually overwrite product intent and make external consumers distrust framework updates.
