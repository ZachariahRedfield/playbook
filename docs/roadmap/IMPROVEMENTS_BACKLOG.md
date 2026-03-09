# Playbook Improvement Backlog

## Purpose

This document captures feature ideas, architectural improvements, and workflow opportunities discovered during development.

Items here are **not yet committed roadmap work**.

They are promoted to the roadmap when they become prioritized product capabilities.

## Lifecycle

Idea  
↓  
Improvement Backlog  
↓  
Roadmap  
↓  
Implemented  
↓  
Archive

This structure prevents roadmap bloat while preserving engineering intelligence discovered during development.

---

## Staging candidates: Product truth packaging and narrative sync

These backlog candidates feed roadmap track `PB-V1-PRODUCT-TRUTH-PACKAGING-001` without implying live command-surface changes in this pass.

- Add a generated command truth table framing commands as canonical workflow, compatibility-only, or utility surfaces.
- Add narrative drift checks that compare runtime/help/docs/demo/roadmap language for planned-vs-live consistency.
- Add explicit `ask --repo-context` question-boundary examples (in-scope and unsupported) for deterministic operator expectations.
- Add demo/onboarding synchronization checks so ladder guidance stays aligned with implemented contracts.

---

## Architectural Insight: Deterministic Engineering Reasoning Loop

Playbook commands already form a reusable deterministic reasoning loop for engineering workflows.

Conceptual loop:

Observe
↓
Understand
↓
Diagnose
↓
Plan
↓
Act
↓
Verify
↓
Learn

Current command mapping:

- `index` → observe repository structure
- `query` → inspect architecture metadata
- `ask` / `explain` → understand repository semantics
- `plan` → generate deterministic remediation intent
- `apply` → execute changes
- `verify` → confirm repository compliance
- memory direction (`.playbook/memory/*`) → preserve engineering knowledge

This indicates Playbook is not only a CLI command set. The product is evolving toward a deterministic reasoning runtime for AI-assisted engineering workflows.

This reasoning loop applies across:

- architecture analysis
- remediation workflows
- CI diagnostics
- PR analysis
- repository maintenance

The loop should remain the core execution model independent of interface surface.

- Pattern: Deterministic Engineering Reasoning Loop
  - Playbook commands collectively implement a reusable reasoning cycle (`observe -> understand -> plan -> act -> verify`).
  - This pattern supports complex engineering workflows while preserving deterministic execution contracts.
- Pattern: Interface Follows Runtime
  - CLI, chat interfaces, CI automation, and AI agents should remain thin interfaces over the same Playbook reasoning loop and artifact contracts.
  - Interfaces should not bypass repository intelligence artifacts.
- Failure Mode: Interface-Led Product Drift
  - If new interfaces (UI, chat, agent surfaces) bypass the deterministic command workflow, Playbook loses consistency and trust.
  - All execution surfaces should route through the canonical Playbook reasoning loop.


---

## Staged Improvement: Storage and Runtime Artifact Hygiene

### Stage 1 — Artifact taxonomy and docs alignment

- Define a single artifact taxonomy across docs: runtime local artifacts, reviewed automation artifacts, and committed demo/contract snapshots.
- Clarify that `.playbook/` is the default runtime artifact home and that local artifacts are gitignored by default unless intentionally promoted.
- Preserve the distinction that `.playbook/demo-artifacts/` contains stable product-facing snapshot contracts/examples.

### Stage 2 — Scan and cache hygiene direction

- Roadmap `.playbookignore` as a focused scan-exclusion mechanism for high-churn/non-source directories (e.g. `node_modules`, `dist`, `coverage`, `.next`, build outputs, non-source artifact folders).
- Define local cache policy guidance for cacheable intelligence artifacts under `.playbook/`, including regeneration expectations and commit guidance.

### Stage 3 — Lifecycle and maintenance ergonomics

- Define retention classes for runtime local state, CI artifacts, and committed contract/demo artifacts so lifecycle rules are explicit.
- Explore optional cleanup/doctor visibility for oversized local Playbook state to surface repository hygiene risks early.

Pattern: Runtime Artifacts Live Under `.playbook/`.
Pattern: Demo Artifacts Are Snapshot Contracts, Not General Runtime State.
Rule: Generated runtime artifacts should be gitignored unless intentionally committed as stable contracts/examples.
Rule: Playbook remains local/private-first by default.
Failure Mode: Recommitting regenerated artifacts on every run causes unnecessary repo-history growth and review churn.

---

## Query System Ideas

- Dependency graph query  
  Command: `playbook query dependencies`

- Impact analysis query enhancements  
  Command: `playbook query impact <module>`

---

## Developer Workflow Intelligence

- Pull request analysis  
  Command: `playbook analyze-pr`

Potential capabilities:

- modules affected by change
- architectural blast radius
- risk score
- missing tests
- documentation coverage gaps

---

## Risk Intelligence Enhancements

- `playbook query risk --top`

Purpose:  
Rank highest-risk modules in the repository.

---

## Follow-up Opportunities

- `playbook backlog audit`

Purpose:  
Automatically detect implemented improvements and archive them.

---

## Docs Governance Follow-ups

- Pattern: Documentation responsibility boundaries should be enforced by moving idea content to the improvement backlog rather than duplicating planning language across docs.
- Rule: `docs/AI_AGENT_CONTEXT.md` should describe current AI operating context, not future feature planning.
- Rule: `docs/PLAYBOOK_DEV_WORKFLOW.md` should describe development process, not act as a second roadmap.
- Rule: `docs/index.md` should navigate documentation, not duplicate backlog or roadmap content.
- Pattern: Historical one-off cleanup docs should be archived or removed once governance rules replace them.
- Failure Mode: Docs-audit warning burn-down is faked if warnings are removed by weakening audit rules instead of aligning documents.

---

## Future Capability: Repository Memory System

### Motivation

Playbook is evolving toward an AI development operating system where repository intelligence, deterministic remediation, and durable engineering memory work together.

Important engineering knowledge is often lost across chat threads, PR comments, and one-off investigations. A repository memory system would preserve this knowledge as deterministic artifacts that can be queried, audited, and promoted through normal governance workflows.

### Memory artifact direction

Potential structured memory layer:

```text
.playbook/memory/
  decisions.json
  patterns.json
  failure-modes.json
  open-questions.json
```

The intent is to preserve architecture decisions, patterns, failure modes, unresolved questions, module notes, and investigation outcomes as long-lived repository intelligence.

### Conversation-to-knowledge workflow

Playbook should support promoting important conversations into durable artifacts instead of leaving them in ephemeral chat history.

Potential promotion targets:

- structured repository memory entries
- documentation candidates
- improvement backlog entries
- roadmap candidates when prioritized

### Potential future command surface (concept only)

- `playbook memory capture`
- `playbook memory query`
- `playbook memory promote`
- `playbook memory prune`

These command names are directional only and should be treated as backlog concepts, not implemented surface.

### AI workflow + future conversation surface alignment

A future Playbook conversational interface (for example, Playbook Chat) should act as a front-end to deterministic Playbook artifacts and commands rather than bypassing repository intelligence contracts.

This keeps conversational UX grounded in the same deterministic governance/runtime model used by CLI and CI workflows.

- Pattern: Conversation-to-Knowledge Pipeline
  - Important engineering discussions should be promotable into structured repository memory and documentation artifacts.
- Pattern: Durable Engineering Memory
  - Repositories should preserve architectural rationale, decisions, and failure modes as structured artifacts rather than ephemeral conversations.
- Pattern: Repository Memory Layer
  - Playbook may introduce structured memory artifacts to capture decisions, patterns, and investigations across repository evolution.
- Failure Mode: Chat Without Memory
  - Conversational interfaces become shallow if decisions and investigations are not preserved as structured repository knowledge.


## Implemented recently: artifact hygiene and storage governance

The following improvements are now implemented in the command surface:

- Artifact classification model for runtime, automation, and contract artifacts.
- `.playbookignore` scan controls for repository intelligence generation.
- `doctor` artifact hygiene diagnostics and structured suggested fixes.
- `plan`/`apply` remediation IDs for artifact governance workflows (`PB012`, `PB013`, `PB014`).
