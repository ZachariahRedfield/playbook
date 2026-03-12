# Playbook Business Strategy (Working Draft)

## Purpose and alignment boundaries

This document converts product direction into go-to-market, monetization, and commercial sequencing.

- Roadmap remains the strategic direction surface: `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.
- This strategy document owns ICP, wedge, monetization ladder, and rollout-linked commercial motion.
- Packaging architecture remains canonical for SKU boundaries: `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`.
- Metrics architecture remains canonical for proof-of-value claims: `docs/architecture/PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md`.
- Rollout architecture remains canonical for trust-maturity stage gates: `docs/architecture/PLAYBOOK_PILOT_DESIGN_PARTNER_AND_ROLLOUT_ARCHITECTURE.md`.

Pattern: Product Story Follows Architecture.
Rule: Monetize coordination/governance scale, not basic trust primitives.
Failure Mode: Business docs drifting away from runtime truth.

Working assumptions:

- Market sizing and external benchmarks are treated as working assumptions (not validated market data).
- The strategy is optimized around current product truth: deterministic repository intelligence, governance verification, and remediation workflows.
- Core strategic decision: position Playbook as **AI-native repo intelligence and remediation infrastructure** rather than as a generic coding assistant.

## 1) ICP (Ideal Customer Profile)

### Primary ICP (first to win)

**Solo builders with serious repositories** who:

- rely heavily on AI coding assistants,
- maintain medium-to-large codebases over long periods,
- need deterministic repo understanding and safe change workflows,
- care about architecture and documentation drift.

Why now:

- Short adoption loop (single developer can decide).
- High pain for repo understanding, AI consistency, and safe remediation.
- Fast feedback cycle for CLI workflow quality.

### Secondary ICP (expand after wedge)

**Small engineering teams (3–15 engineers) with repo sprawl** who:

- have architecture knowledge concentrated in a few senior engineers,
- experience documentation/rules drift,
- need shared standards and AI-assisted workflow consistency.

Why this segment:

- Pain is acute and recurring.
- Team-level coordination features create clear willingness to pay.
- Success criteria can be tied to onboarding speed, fewer unsafe changes, and less senior-engineer routing overhead.

### Tertiary ICP (higher ACV)

**Platform/governance-sensitive organizations** (later stage) who need:

- auditability,
- role-based approvals,
- policy enforcement,
- self-hosted or boundary-controlled deployment,
- compliance-oriented workflow controls.

Why later:

- Longer procurement and integration cycles.
- Requires mature trust, controls, and operational guarantees.

## 2) Wedge (must-have entry point)

### Wedge definition

Make Playbook the fastest path from repo ambiguity to safe action using a deterministic workflow:

`query/explain -> verify -> plan -> apply -> verify`

### Problem statement

The expensive pain is not “writing code slower”; it is:

- unclear repository shape and ownership,
- architecture and docs drift,
- inconsistent AI-generated changes,
- ad hoc remediation with low trust,
- senior engineers becoming routing bottlenecks.

### Wedge promise

Playbook turns repository knowledge into deterministic, enforceable, and actionable workflows for both humans and AI agents.

### Product priorities for wedge strength

1. **Repo understanding quality**
   - High-signal `query` and `explain` outputs.
2. **Deterministic governance**
   - Reliable `verify` findings and predictable contracts.
3. **Safe remediation bridge**
   - Clear, explainable `plan` output and bounded `apply` behavior.
4. **Drift control**
   - Strong alignment across code, rules, docs, and contracts.

### Wedge anti-pattern to avoid

Do not broaden into a diffuse “do everything AI coding platform” before the deterministic repo-understanding + safe-remediation loop becomes a daily habit.

## 3) Monetization ladder

Canonical packaging reference: `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`.

Canonical metrics and ROI reference: `docs/architecture/PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md`.

Canonical pilot/rollout architecture reference: `docs/architecture/PLAYBOOK_PILOT_DESIGN_PARTNER_AND_ROLLOUT_ARCHITECTURE.md`.

### Product model decision

Adopt an **open-core SKU architecture** where packaging follows deterministic runtime and governance model truth:

- Open Core proves deterministic local value and trust.
- Team and Enterprise package coordination, governance, deployment, and operational trust surfaces over the same runtime semantics.
- Deployment/SKU choices must not redefine engine truth.

### Layer 1: Open Core / Free

- Local deterministic CLI workflows.
- Core commands: context/query/explain/verify/plan/apply.
- Local rules and docs/governance scaffolding.
- Developer-first onboarding.

Goal: maximize activation, proof of value, and workflow habit formation.

### Layer 2: Team

(Architecture reference: `docs/architecture/PLAYBOOK_PLATFORM_ARCHITECTURE.md`, especially Interface Layer, Policy / Control Plane, and Learning / Longitudinal State Layer.)

Workspace/tenant deployment reference: `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`.

- Hosted indexing and shared repository intelligence.
- Team policies and shared rulesets.
- Pull request annotations/checks.
- Remediation history and change tracking.
- Multi-repo memory and visibility.
- Team analytics and governance dashboards.
- Workspace/project-group governance views with per-repo evidence drill-down.
- Optional hosted control-plane packaging over the same deterministic local runtime.

Goal: monetize coordination pain and workflow reliability across teams while preserving local per-repo ownership and the same verify/session/evidence semantics as Open Core; do not monetize basic trust primitives.

### Layer 3: Enterprise

(Architecture reference: `docs/architecture/PLAYBOOK_PLATFORM_ARCHITECTURE.md`, especially Trust / Evidence Layer and Policy / Control Plane.)

Workspace/tenant deployment reference: `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`.

- SSO/RBAC and org-level permissions.
- Audit logs and approval controls.
- Optional self-hosted/VPC/boundary-controlled deployment over the same deterministic runtime semantics.
- Compliance policy packs.
- Support, rollout assistance, and governance onboarding.

Goal: capture high-ACV governance and boundary-control demand through stronger operational guarantees, not alternate runtime semantics or cloud-required behavior.

### Services policy

Use services (setup, custom rules, migration support) as an **early discovery and revenue wedge**, but not as the long-term primary revenue engine.

### Pricing frame

Price Playbook as:

- workflow reliability,
- deterministic engineering intelligence,
- and governance confidence,

not as a generic AI code-generation seat.

## 4) 12-month go-to-market sequence (rollout architecture aligned)

This sequence follows the canonical rollout architecture in `docs/architecture/PLAYBOOK_PILOT_DESIGN_PARTNER_AND_ROLLOUT_ARCHITECTURE.md` and preserves wedge sequencing from solo proof to team and enterprise governance.

### Phase 1 (Months 0–3): qualification + solo trust baseline

Objectives:

- qualify serious repositories/design partners with recurring governance pain
- prove local read/runtime value first (`context/ai-context/index/query/explain`)
- establish verify-only trust baseline before mutation workflows

Deliverables:

- repeatable read-only repository understanding quality
- deterministic verify findings with usable governance baselines
- pilot qualification and evidence capture discipline

Commercial motion:

- free/open adoption with qualified design partners
- lightweight pilots focused on deterministic evidence

Success signals:

- repeated read-only + verify usage on real repos
- clear trust uplift in findings quality and repo understanding
- explicit stage-gate readiness to enter low-risk plan/apply pilots

### Phase 2 (Months 4–6): low-risk remediation pilots + PR/CI rollout

Objectives:

- prove bounded `plan/apply` value on low-risk branches
- convert repo-level trust into deterministic PR/CI enforcement
- preserve human review + post-mutation verify closure

Deliverables:

- low-risk plan/apply pilot playbook and guardrails
- analyze-pr and CI integration for deterministic governance checks
- evidence-linked remediation outcomes and drift trends

Commercial motion:

- select team pilots converting from verified repo trust
- paid team-plan beta where coordination pain is already proven

Success signals:

- stable low-risk remediation acceptance and pass-after-remediation rates
- repeatable PR/CI usage with policy-aligned findings handling
- first team conversions grounded in deterministic proof-of-value

### Phase 3 (Months 7–9): workspace/team governance expansion

Objectives:

- expand from single-repo trust to multi-repo/team governance
- prove coordination value without weakening per-repo evidence boundaries
- harden reusable pattern promotion from pilot outcomes

Deliverables:

- shared rulesets/policy controls and team-level governance views
- reusable pattern capture pipeline from pilots to shared core
- stronger trust/acceptance instrumentation across team workflows

Commercial motion:

- higher-touch multi-repo team pilots
- governance-sensitive pilots with explicit stage gates

Success signals:

- measurable cross-repo governance consistency improvements
- reduced onboarding/routing friction in team pilots
- successful promotion of reusable pilot learnings into product core

### Phase 4 (Months 10–12): enterprise governance/deployment readiness

Objectives:

- formalize enterprise-style governance rollout path
- align packaging/deployment posture with trust maturity gates
- preserve CLI-first, offline-capable, private-first guarantees across lanes

Deliverables:

- org/tenant governance control expectations and rollout criteria
- optional hosted/self-hosted boundary-controlled deployment readiness path
- proof-of-value narratives backed by deterministic baseline/after evidence

Commercial motion:

- repeatable enterprise qualification based on repo/team trust maturity
- annual plan packaging for governance-ready teams/orgs

Success signals:

- repeatable repo -> team -> enterprise expansion pattern
- governance stakeholder approval tied to deterministic evidence
- stable conversion from pilot trust milestones to paid governance rollouts

## Operating measurement architecture from day one

Use `docs/architecture/PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md` as the canonical measurement contract.

Operating measurement layers:

- Activation: time-to-first-useful verify/query result.
- Retention: weekly repeated deterministic workflow usage.
- Trust: acceptance rate of generated plan/apply outputs and pass-after-remediation outcomes.
- Governance impact: drift findings resolved per repo over time with provenance.
- Team value: onboarding time reduction and PR policy compliance trend.
- Enterprise value: approval latency, audit trace completeness, and policy-controlled workflow adoption.
- Commercial proof-of-value: baseline vs after measurement with explicit attribution and evidence linkage.

Measurement rules:

- Measure deterministic outcomes, not generic AI activity volume.
- ROI claims require baseline + attribution + evidence lineage.
- Cross-repo/team aggregates must preserve per-repo explainability.

## Explicit non-goals (first 12 months)

- Building a broad marketplace before core workflow maturity.
- Positioning as a generic coding chatbot product.
- Expanding surface area faster than deterministic quality improves.

## One-line strategy statement

Playbook will win by becoming the trusted system that turns repository knowledge into deterministic, governable, and monetizable engineering workflows for humans and AI.
