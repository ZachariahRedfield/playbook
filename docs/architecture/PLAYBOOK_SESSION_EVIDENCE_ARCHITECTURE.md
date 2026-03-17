# Playbook Session + Evidence Architecture

## Purpose

This document defines the prerequisite Session + Evidence architecture layer for Playbook's long-term engineering-AI direction.

It does **not** introduce new runtime commands or claim already-shipped behavior.

It clarifies the architecture dependency chain that must exist before broader AI execution/runtime expansion.

## Scope and positioning

Playbook remains a CLI-first, offline-capable, private-first deterministic runtime.

Session + Evidence is a structural architecture layer that organizes deterministic artifacts and policy decisions into a first-class session envelope.

This layer is downstream of deterministic command artifacts and upstream of policy, learning, and any optional higher-order automation surfaces.

Pattern: Interface Follows Runtime.
Pattern: Session Envelope Over Deterministic Artifacts.
Pattern: Evidence Before Memory.
Rule: Policy and approvals precede autonomous execution.
Rule: Promoted knowledge must preserve provenance.
Failure Mode: Interface-led product drift.
Failure Mode: Agent runtime expansion before trust primitives.
Failure Mode: Memory without evidence.
Failure Mode: Distributed policy without a control plane.

## Canonical Session model (architecture contract)

A **Playbook Session** is the deterministic envelope for one bounded engineering-intelligence cycle.

Canonical fields:

- **session_id**: stable unique identifier for the session.
- **trigger_source**: what started the session (human invocation, CI job, scheduled maintenance, etc.).
- **repo_identity**: deterministic repository identity and location context.
- **refs**:
  - **branch_ref**
  - **base_ref**
  - **head_ref**
- **actor_type**: one of human, CI, AI, maintenance workflow.
- **commands_executed**: ordered Playbook command sequence with parameters and timestamps.
- **artifacts_consumed**: deterministic input artifacts or prior command outputs used by the session.
- **artifacts_produced**: deterministic output artifacts produced by the session.
- **findings**: normalized findings observed in-session.
- **evidence_references**: links from findings/decisions to source artifacts and command outputs.
- **plan_apply_verify_chain**: structured chain for `verify -> plan -> apply -> verify` outcomes and transitions.
- **approvals_and_policy_decisions**: explicit approve/deny/defer records and policy context.
- **related_links**: related PR/CI/issue references.
- **promotion_candidates**: candidates for future memory/pattern promotion (still evidence-bound and review-gated).

### Session invariants

- Session records must remain deterministic and replay-auditable.
- Session records must not imply hidden telemetry or automatic upstream synchronization.
- Session records must preserve private-first repository boundaries.
- Session records should compose existing command artifacts rather than bypass command contracts.

## Canonical Evidence model (architecture contract)

Evidence is the trust substrate for deterministic decisions, promotion, and automation synthesis.

Evidence requirements:

- Evidence must point to deterministic source artifacts or concrete command outputs.
- Evidence must preserve provenance for any promoted knowledge.
- Evidence is required for trust decisions, memory promotion, and future automation synthesis.
- Session evidence precedes repo memory in the dependency chain.

### Evidence provenance minimums

Each evidence reference should include:

- source artifact/output identifier
- command/source-of-truth origin
- capture timestamp
- relation type (observation, finding support, plan rationale, apply trace, verify proof, approval rationale)
- integrity/status metadata (present/missing/stale/contradictory)

### Trust boundary

Verification remains the canonical trust gate for repository mutation and promotion pathways.

Session/evidence architecture strengthens this boundary by making decisions auditable; it does not replace `verify` as the trust primitive.


## Implemented canonical contract slice (current)

The current deterministic implementation is intentionally narrow and additive:

- `.playbook/session.json` now carries `evidenceEnvelope` as a canonical, inspectable session/evidence envelope.
- The envelope references existing artifacts instead of replacing contracts.
- Current lineage stages are deterministic and ordered: `session -> proposal_generation -> policy_evaluation -> execution_result`.
- Proposal/policy/apply linkage is represented through proposal IDs, policy decisions, and execution-result references when artifacts are present.
- Missing optional artifacts are represented as `present: false` references instead of hard-failing session persistence.

This provides the next contract slice for governed execution provenance while preserving existing command/runtime behavior.

## Dependency chain (long-term architecture)

Recommended dependency chain:

1. deterministic runtime artifacts (`index`, `verify`, `plan`, `apply`, `analyze-pr`, etc.)
2. session envelope over deterministic artifacts
3. evidence/provenance contracts inside session
4. policy/control-plane decisions and approvals
5. learning/memory promotion (review-gated)
6. optional higher-order automation/agent-facing runtime surfaces

This ordering is architecture direction and backlog sequencing guidance, not a claim of full implementation.

## Non-goals and guardrails

- Not a repositioning of Playbook into a general code authoring agent.
- Not a cloud-only or telemetry-dependent architecture.
- Not a bypass of CLI-first deterministic command contracts.
- Not a bypass of `verify` trust boundaries.
- Not an implication that session runtime is fully shipped today.

## Cross-links
- Repo longitudinal state + knowledge promotion: `docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md`

- Product roadmap layering: `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- Control-plane architecture: `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`
- Machine roadmap contract: `docs/roadmap/ROADMAP.json`
- Backlog staging: `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- Automation synthesis direction: `docs/AUTOMATION_SYNTHESIS_VISION.md`
- Consumer promotion/privacy constraints: `docs/CONSUMER_INTEGRATION_CONTRACT.md`

- `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md`
- `docs/architecture/PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md`
- `docs/architecture/PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md`
