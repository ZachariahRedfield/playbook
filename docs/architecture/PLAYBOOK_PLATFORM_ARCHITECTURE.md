# Playbook Platform Architecture (Long-Term)

## Purpose

This is the canonical long-term platform architecture document for Playbook.

It captures where Playbook can evolve **after** current deterministic CLI/runtime priorities, without changing the active near-term execution plan in `docs/roadmap/IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md`.

Scope posture:

- **Near-term (implemented/in-flight):** deterministic repository intelligence, governance verification, contract-driven remediation, approved execution.
- **Long-term (directional/backlog):** deeper memory, trust graphing, control-plane expansion, and multi-surface orchestration.

Related docs:

- Current-state architecture: `docs/ARCHITECTURE.md`
- Automation direction: `docs/AUTOMATION_SYNTHESIS_VISION.md`
- Backlog staging: `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- Consumer boundaries: `docs/CONSUMER_INTEGRATION_CONTRACT.md`

---

## Architecture framing: deterministic runtime first

Playbook remains a deterministic engineering runtime, not a generic chatbot system.

The platform direction extends the existing trust model:

`observe -> understand -> verify -> plan -> approved execution -> verify -> learn`

Verification remains the trust boundary for any mutation path.

---

## Layer model

## 1) Observation Layer

**Role:** collect deterministic repository signals and runtime observations.

Includes:

- repository indexing outputs (`index`, `query`, `explain`, `ask --repo-context` context artifacts)
- governance findings (`verify`)
- deterministic remediation traces (`plan`, `apply`)
- docs/governance diagnostics (`docs audit`, `doctor`)

Status:

- **Already existing:** core deterministic observation surfaces and artifacts.
- **Partially defined:** richer recurrence tracking across runs.
- **Missing future capability:** normalized event/observation history contracts for longitudinal learning.

## 2) Knowledge / Compaction Layer

**Role:** transform repeated observations into reusable, bounded engineering knowledge.

Target capabilities:

- conversation-to-knowledge promotion pipeline (draft -> reviewed -> promoted)
- knowledge compaction from repeated observations into reusable patterns
- durable engineering memory with retirement/supersede controls
- shared core + project-local intelligence separation

Status:

- **Already existing:** directional lifecycle language and compaction intent in backlog/architecture docs.
- **Partially defined:** lifecycle gates, candidate bucketing, and promotion semantics.
- **Missing future capability:** fully operational deterministic compaction/promotion pipeline with strong evidence thresholds.

## 3) Trust / Evidence Layer

**Role:** bind assertions and automations to verifiable evidence.

Target capabilities:

- evidence-linked trust model for findings, plans, and promoted patterns
- evidence graph contracts linking observation -> plan/apply -> verification outcomes
- fail-closed behavior when evidence is incomplete, contradictory, or stale

Status:

- **Already existing:** verification-centric trust posture and deterministic plan/apply contracts.
- **Partially defined:** evidence provenance expectations across docs and automation concepts.
- **Missing future capability:** explicit evidence graph and trust scoring/promotion contracts.

## 4) Policy / Control Plane

**Role:** centralize approval, permission, and mutation-boundary policy decisions.

Target capabilities:

- policy-backed approvals before privileged mutations
- explicit mutation boundaries per actor/surface
- centralized control-plane semantics for governance across CLI/CI/APIs
- deterministic deny/fail-closed outcomes when approvals are missing

Status:

- **Already existing:** policy-gated deterministic mutation expectations.
- **Partially defined:** approval model concepts in automation/business docs.
- **Missing future capability:** unified control-plane contract spanning all execution interfaces.

## 5) Execution / Orchestration Layer

**Role:** execute approved, bounded actions through deterministic contracts.

Target capabilities:

- preservation of canonical `verify -> plan -> apply -> verify` remediation flow
- orchestration adapters for CI/PR/job systems without bypassing policy/trust layers
- deterministic rollback/deactivation for higher-order automation

Status:

- **Already existing:** CLI remediation pipeline and deterministic contracts.
- **Partially defined:** automation orchestration direction.
- **Missing future capability:** generalized orchestrator adapter model with consistent control-plane enforcement.

## 6) Learning / Longitudinal State Layer

**Role:** maintain repo identity and continuity across runs.

Target capabilities:

- repository identity and longitudinal state model
- run-over-run memory for recurring findings/remediations/outcomes
- bounded retention and lifecycle hygiene for long-term state

Status:

- **Already existing:** local artifacts and lifecycle direction.
- **Partially defined:** runtime history/cycle concepts and compaction convergence notes.
- **Missing future capability:** explicit longitudinal state schema with deterministic lifecycle controls.

## 7) Interface Layer

**Role:** expose the same deterministic runtime across operator surfaces.

Target capabilities:

- CLI (current primary)
- CI and PR intelligence surfaces
- dashboards and control-plane UI
- server/runtime APIs for trusted integration

Rule:

- Interface expansion must remain thin over the same deterministic contracts; interfaces must not bypass verification/policy boundaries.

Status:

- **Already existing:** strong CLI command surface plus CI/PR direction.
- **Partially defined:** app-integrated API direction and team/enterprise surfaces.
- **Missing future capability:** unified cross-surface UX for approvals, trust evidence, and longitudinal state.

## 8) Capability / Model Routing Layer

**Role:** route tasks to bounded capabilities instead of one undifferentiated agent.

Target capabilities:

- capability-scoped routing (e.g., query intelligence, rule diagnostics, remediation planning, docs governance)
- deterministic tool/model selection policy by task/risk/evidence needs
- bounded execution contexts with explicit permissions

Status:

- **Already existing:** command-specialized deterministic workflow contracts.
- **Partially defined:** AI bootstrap/contract docs and automation synthesis staging.
- **Missing future capability:** explicit routing layer contract with auditable decision boundaries.

---

## Near-term vs long-term scope clarity

### Near-term scope (current roadmap identity)

- Deterministic repository intelligence and governance workflows remain primary.
- `verify -> plan -> apply -> verify` remains canonical mutation path.
- Improvements should reinforce trust, determinism, and docs/contract alignment.

### Long-term directional scope (platform architecture + backlog)

- Longitudinal repository memory.
- Compaction-driven knowledge promotion.
- Evidence graph and trust contracts.
- Control-plane approvals/permissions across interfaces.
- Multi-repo learning with sanitization and scope boundaries.
- Capability/model routing contracts for bounded specialization.

This document is directional architecture, not a commitment to immediate implementation timing.

---

## Cross-repo and promotion boundaries

Platform direction preserves local ownership:

- Repo-local facts and sensitive context remain local by default.
- Only sanitized, reusable patterns are eligible for upstream or cross-repo promotion.
- Multi-repo transfer must preserve privacy and scoped ownership boundaries.

Shared core + project-local intelligence remains the base contract.

---

## Human approval and fail-closed posture

- Human-in-the-loop review remains mandatory for high-impact promotion and mutation boundaries.
- Verification and evidence completeness gate trust.
- When evidence is incomplete, policy is ambiguous, or approvals are missing, the system should fail closed.

---

## Research synthesis summary (reusable labels)

- **Pattern: Shared Core + Project-Local Intelligence**
- **Pattern: Conversation-to-Knowledge Pipeline**
- **Pattern: Verification as Trust Boundary**
- **Pattern: Knowledge Compaction Pipeline**
- **Rule: Repo-local facts stay local; only sanitized reusable patterns move upstream**
- **Rule: Bounded capability routing beats one undifferentiated agent**
- **Failure Mode: Chat Without Memory**
- **Failure Mode: Distributed Policy Without a Control Plane**
- **Failure Mode: Evidence-poor automation**
- **Failure Mode: Best-effort downstream checks create false confidence**
