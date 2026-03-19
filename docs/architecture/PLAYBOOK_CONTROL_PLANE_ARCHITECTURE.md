# Playbook Control Plane Architecture

## Purpose

This document defines the canonical **Control Plane** architecture layer for Playbook.

The control plane is the policy layer that determines:

- who can invoke actions
- what actions are allowed
- what evidence is required
- what approval level is required
- what mutation scope is allowed
- what adapters/integrations are allowed
- what data remains local vs what may be promoted/exported
- when execution must fail closed

It is dependency-ordered **after Session + Evidence** and **before broader orchestration/autonomy expansion**.

## Scope and positioning

Playbook remains CLI-first, offline-capable, private-first, and deterministic.

This architecture does **not** introduce a broad `playbook agent` command surface.

This architecture does **not** imply hidden telemetry, automatic source upload, or automatic upstream sync.

Pattern: Policy Follows Evidence.
Pattern: Control Plane Before Autonomy.
Rule: Verification remains the trust boundary.
Rule: Repo-local facts stay local unless intentionally promoted.
Rule: Ambiguous policy or incomplete verification must fail closed.
Failure Mode: Tool autonomy before policy boundaries.
Failure Mode: Session evidence without enforcement.
Failure Mode: Adapter-specific behavior leaking into core runtime.
Failure Mode: Memory/export behavior implied without explicit opt-in.

## Actor classes

The control plane evaluates policy by actor class:

1. **Human operator**
   - interactive local invocation and explicit review/approval actions.
2. **CI workflow**
   - non-interactive policy evaluation, verify gates, and bounded deterministic execution.
3. **Maintenance workflow**
   - scheduled/on-demand repository maintenance under explicit policy constraints.
4. **AI assistant**
   - assisted execution constrained to deterministic command contracts and policy gates.
5. **Future autonomous agent**
   - directional only; must inherit the same evidence, approval, and mutation constraints.

## Execution modes

Control-plane policy should classify execution by mode:

1. **Read-only intelligence**
   - index/query/explain/ask/context surfaces without repository mutation.
2. **Verify-only governance**
   - policy and rule evaluation without plan/apply mutation.
3. **Plan-only remediation**
   - deterministic planning and recommendation output without mutation.
4. **Approved apply**
   - mutation only after required evidence + approvals are present.
5. **Maintenance automation**
   - bounded repetitive maintenance flows under explicit policy profiles.
6. **Future synthesized automation**
   - directional mode where generated automation remains untrusted until verify + approvals pass.

## Mutation-scope taxonomy

Control-plane policy should assign every action a mutation scope level:

- **Level 0 — No mutation**
  - read/query/analysis only.
- **Level 1 — Local/docs/scaffold-safe mutation**
  - low-risk local docs/templates/scaffolding updates with bounded paths.
- **Level 2 — Bounded code/config mutation**
  - constrained source/config edits within declared module/path boundaries.
- **Level 3 — Cross-module or security-sensitive mutation**
  - broader impact changes, security-sensitive files, auth/policy/runtime-boundary edits.
- **Level 4 — External side effects / deployment / privileged automation**
  - external systems, deployment, privileged actions, or non-local side effects.

## Approval policy model

Approval policy is mutation-level and actor-aware:

- **Automatic policy allowance**
  - Level 0 and selected Level 1 actions may run automatically when policy + verification requirements are satisfied.
- **Explicit human approval required**
  - Level 2 actions require explicit human approval before mutation.
- **Owner/security approval required**
  - Level 3 and Level 4 actions require explicit owner/security approval.
- **Auditability invariant**
  - all approval decisions must be linked to session evidence and preserved in auditable records.

## Evidence and trust requirements

Control-plane policy must enforce:

- no privileged mutation without linked session evidence
- verification remains the trust boundary for mutation and promotion
- ambiguous/incomplete verification must fail closed
- promoted knowledge must preserve provenance

Session evidence should bind:

- actor identity/class
- command lineage
- findings and remediation rationale
- approval decision records
- resulting mutation artifacts

## Adapter and integration boundaries

To preserve deterministic core behavior:

- external adapters must remain deterministic, bounded, and policy-gated
- adapter-specific behavior must not leak into core engine behavior
- future MCP/API/integration surfaces must route through control-plane checks
- browser clients should use validated server/API surfaces, not arbitrary local command execution

Control plane evaluation should occur before adapter execution so policy remains centralized and portable across surfaces.

## Locality, promotion, and export rules

Default data posture:

- repo-local facts remain local by default
- reusable patterns may be intentionally promoted upstream
- export/sync remains explicit opt-in
- no hidden telemetry

No control-plane decision should imply automatic cross-repo memory transfer or implicit external publication.

## Parallel-safe execution and singleton narrative surfaces

Parallel lane planning and worker assignment reduce overlap, but they do not automatically make every repository surface safe for concurrent edits.

Small set of canonical narrative docs remain singleton write targets even when code ownership is otherwise isolated:

- `docs/CHANGELOG.md`
- roadmap rollups
- shared architecture summaries
- other root-level canonical narrative docs

This creates a distinct boundary:

- **Implementation surfaces**: worker-owned code, tests, module docs, and other isolated files that can be edited directly inside a lane.
- **Narrative singleton surfaces**: canonical rollups and summaries that should be updated only through deferred consolidation.

Why this matters:

- parallelizable work is not automatically parallel-safe
- singleton narrative docs become merge hotspots before code ownership does
- deterministic summaries drift when multiple workers narrate the same change independently

Planned dependency-ordered path for future orchestration hardening:

1. worker partitioning / overlap detection
2. worker-local fragments / receipts
3. final deterministic consolidation pass for protected singleton docs
4. managed subagents / hooks on top of that safer substrate

Rule: Shared singleton docs should be updated through worker-local fragments plus a deterministic consolidation pass, not direct concurrent edits from multiple workers.
Pattern: Workers own isolated implementation changes; a final consolidator owns canonical narrative artifacts such as changelogs, roadmap rollups, and shared summary docs.
Failure Mode: Parallel workers editing the same singleton narrative docs create merge hotspots, inconsistent summaries, and doc drift even when implementation ownership is otherwise well partitioned.

## Workflow-produced artifact promotion

Higher-level workflow outputs that materialize durable repo-visible state must follow the same safety boundary as lower-level generated artifacts.

Rule: Higher-level workflow outputs must use staged generation and gated promotion when they produce durable repo-visible artifacts.
Pattern: Treat workflow outputs like governed candidate artifacts, not direct writes.
Pattern: Generate candidate workflow outputs in isolated staging, validate deterministically, then promote only approved outputs.
Pattern: Reuse one shared workflow promotion contract instead of command-local promotion result shapes.
Failure Mode: Multi-step workflow outputs that bypass staged promotion create unsafe partial state and weaken deterministic repo governance.
Failure Mode: Ad hoc workflow promotion metadata fragments governance semantics and makes Observer/orchestration reasoning inconsistent.

Shared contract: `packages/contracts/src/workflow-promotion.schema.json` defines the normalized staged-promotion receipt for durable workflow outputs.

This applies to workflow receipts, updated-state projections, route/demo/apply writebacks, observer/export outputs, and any cross-repo planning artifacts that may become committed state.

## Fail-closed enforcement model

Execution must fail closed when:

- required policy inputs are missing or ambiguous
- required approvals are absent or unverifiable
- required evidence links are missing/stale/contradictory
- verification is incomplete or ambiguous for requested mutation scope
- adapter execution request exceeds allowed policy scope

Fail-closed behavior is mandatory for all privileged mutation and external side-effect pathways.

## Dependency ordering in platform architecture

Recommended dependency chain:

1. deterministic runtime (`verify -> plan -> apply` and intelligence artifacts)
2. session + evidence architecture
3. control plane architecture (policy, approvals, mutation boundaries, adapter boundaries, export rules)
4. review/orchestration hardening
5. future learning, synthesis, and autonomous surfaces

This sequence is architecture direction and roadmap sequencing guidance, not a claim that all layers are implemented.

## Cross-links
- Repo longitudinal state + knowledge promotion: `docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md`

- Session + Evidence architecture: `docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`
- Product roadmap: `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- Roadmap contract: `docs/roadmap/ROADMAP.json`
- Improvements backlog: `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- Consumer integration contract: `docs/CONSUMER_INTEGRATION_CONTRACT.md`
- Automation synthesis vision: `docs/AUTOMATION_SYNTHESIS_VISION.md`

- `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md`
- `docs/architecture/PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md`
- `docs/architecture/PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md`
