# Playbook PR Review Loop Architecture

## Purpose

This document defines Playbook's canonical **PR Review Loop** architecture.

It positions PR review/orchestration as a governed workflow layer built on top of:

1. deterministic runtime artifacts,
2. Session + Evidence contracts, and
3. Control Plane policy and mutation boundaries.

It does **not** introduce a broad `playbook agent` command surface, and it does **not** claim free-form PR mutation as an already-supported behavior.

## Architecture positioning

Dependency order for this layer:

1. deterministic runtime (`verify`, `plan`, `apply`, `analyze-pr`, `index`, `query`, etc.)
2. Session + Evidence envelope
3. Control Plane policy + mutation-scope governance
4. PR Review Loop architecture (this document)
5. longitudinal learning / knowledge promotion
6. optional broader interface or agent-facing surfaces

Pattern: Review Loop Over Deterministic Artifacts.
Pattern: Evidence-Attached PR Intelligence.
Pattern: Thin Review Interfaces Over One Runtime.
Rule: Re-verify after any candidate mutation.
Rule: Only bounded low-risk classes may be autofix-eligible.
Rule: Ambiguous review outcomes fail closed.
Failure Mode: Review comments without evidence lineage.
Failure Mode: PR autofix before policy/mutation-scope checks.
Failure Mode: Adapter-specific review behavior leaking into core semantics.
Failure Mode: Broad agent UX shipped before review-loop trust hardening.

## Canonical PR Review Loop workflow

The PR Review Loop is a deterministic, policy-gated flow:

1. **PR trigger / invocation**
   - Triggered by explicit local invocation or CI/PR pipeline wiring.
   - Trigger metadata must be recorded in the Session envelope.
2. **SCM context normalization**
   - Normalize repository, branch, base/head refs, and commit context.
   - Use deterministic SCM context contracts (same semantics across adapters).
3. **Session creation**
   - Create/attach a session envelope for this review cycle.
   - Include actor type, trigger source, refs, and command-chain intent.
4. **Artifact hydration**
   - Hydrate required deterministic artifacts (repo index/context, rule context, existing findings where relevant).
5. **Deterministic PR analysis**
   - Use `analyze-pr` as the canonical analysis surface.
   - PR intelligence derives from deterministic runtime outputs, not adapter-specific heuristics.
6. **Evidence attachment**
   - Every emitted finding links to concrete evidence references (artifacts, command outputs, provenance metadata).
7. **Finding classification**
   - Findings are categorized using shared taxonomy and action class.
8. **Policy check / mutation eligibility**
   - Control Plane evaluates actor, mutation scope, required approvals, and evidence completeness.
9. **Optional bounded autofix proposal**
   - Only if policy and mutation-scope checks permit bounded low-risk classes.
   - Output is a candidate proposal, not free-form mutation authority.
10. **Re-verification**
   - Any candidate mutation must be followed by `verify` before handoff/continuation.
11. **Human handoff / escalation**
   - Route unresolved, high-risk, or policy-blocked outcomes to explicit human review paths.
12. **Promotion candidates for future memory**
   - Create evidence-preserving promotion candidates for longitudinal learning pipelines.

Canonical guardrail: the remediation trust boundary remains `verify -> plan -> apply -> verify`; PR review orchestration cannot bypass this.

## Review finding taxonomy

Playbook PR review findings should be normalized into these classes:

- **architecture / boundary drift**
- **risk / blast radius**
- **missing tests**
- **documentation coverage gaps**
- **rule / contract violations**
- **remediation candidates**
- **prevention targets for future failure-intelligence loops**

These classes are deterministic review semantics, not adapter-specific labels.

## Action classes for findings

Each finding should map to one action class:

- **comment-only**
  - Reviewer-facing interpretation with no mutation.
- **evidence-only**
  - Attach provenance and traceability artifacts without recommendation text mutation.
- **plan suggestion**
  - Structured recommendation that can feed a governed `verify -> plan -> apply` path.
- **safe autofix candidate**
  - Candidate-only bounded autofix class, subject to policy approval and re-verification.
- **human-review-required**
  - Escalation required due to risk, ambiguity, scope, or approval policy.
- **blocked by policy / insufficient evidence**
  - Mandatory fail-closed state where action cannot proceed.

## Autofix boundaries

Autofix eligibility for PR review is bounded by strict architecture rules:

- Only bounded low-risk action classes are eligible.
- Mutation scope must be evaluated through the Control Plane before any candidate change.
- Verification must run again after any candidate mutation.
- Ambiguous or incomplete outcomes fail closed.
- No adapter can introduce mutation behavior that bypasses core policy/evidence checks.

This is intentionally narrower than generic coding-agent behavior.

## Evidence requirements and lineage

Evidence is mandatory across the PR review loop:

- All PR findings must link to session-scoped evidence.
- Comments, diagnostics, and suggestions should preserve provenance metadata.
- Re-verification outcomes must link back to candidate mutation evidence.
- Any future promotion into memory/knowledge systems must preserve lineage from:
  - trigger context,
  - analysis artifacts,
  - policy decisions,
  - verification outcomes,
  - human approval/escalation records.

Failure mode to avoid: review comments that cannot be traced to deterministic artifacts and session evidence.

## Integration boundaries

To prevent semantic drift across interfaces:

- `analyze-pr` remains the deterministic analysis surface.
- Review interfaces (CI checks, PR comments, and future UI/API surfaces) are thin transport/presentation layers over one runtime.
- Adapter-specific behavior must not leak into core finding taxonomy, action classes, mutation eligibility, or trust semantics.
- Verify remains the trust boundary for mutation eligibility and promotion pathways.

## Non-goals and guardrails

- Not a generic PR coding bot architecture.
- Not free-form autonomous mutation on pull requests.
- Not a bypass of `verify -> plan -> apply` contracts.
- Not a cloud-first dependency; local/private-first operation remains required.
- Not a claim that broad PR autofix capabilities are fully implemented today.

## Cross-links

- `docs/architecture/PLAYBOOK_SESSION_EVIDENCE_ARCHITECTURE.md`
- `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/roadmap/ROADMAP.json`
- `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- `docs/CONSUMER_INTEGRATION_CONTRACT.md`
- `docs/AUTOMATION_SYNTHESIS_VISION.md`
