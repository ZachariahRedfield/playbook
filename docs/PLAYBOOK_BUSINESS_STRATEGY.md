# Playbook Business Strategy (Working Draft)

## Purpose and assumptions

This document converts the current market and product analysis into an execution-ready business strategy for Playbook.

- Market sizing and external benchmarks are treated as working assumptions (not validated market data).
- The strategy is optimized around what Playbook already does today: deterministic repository intelligence, governance verification, and remediation workflows.
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

### Product model decision

Adopt an **open-core SKU architecture** where packaging follows the deterministic runtime and governance model:

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

Goal: monetize coordination pain and workflow reliability across teams while preserving local per-repo ownership and the same verify/session/evidence semantics as Open Core.

### Layer 3: Enterprise

(Architecture reference: `docs/architecture/PLAYBOOK_PLATFORM_ARCHITECTURE.md`, especially Trust / Evidence Layer and Policy / Control Plane.)

Workspace/tenant deployment reference: `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`.

- SSO/RBAC and org-level permissions.
- Audit logs and approval controls.
- Optional self-hosted/VPC/boundary-controlled deployment over the same deterministic runtime semantics.
- Compliance policy packs.
- Support, rollout assistance, and governance onboarding.

Goal: capture high-ACV governance and boundary-control demand through stronger operational guarantees, not alternate runtime semantics.

### Services policy

Use services (setup, custom rules, migration support) as an **early discovery and revenue wedge**, but not as the long-term primary revenue engine.

### Pricing frame

Price Playbook as:

- workflow reliability,
- deterministic engineering intelligence,
- and governance confidence,

not as a generic AI code-generation seat.

## 4) 12-month go-to-market sequence

### Phase 1 (Months 0–3): prove solo developer pull

Objectives:

- Make core CLI workflows obviously better than ad hoc repo inspection.
- Drive repeat usage for query/explain/verify loops.

Deliverables:

- Improved output quality and determinism for repo understanding commands.
- Tight “first value” onboarding for existing repositories.
- Practical templates/examples for architecture + remediation workflows.

Commercial motion:

- Free/open adoption.
- Design-partner interviews and lightweight pilots.

Success signals:

- Weekly active repeat users.
- High completion rate on deterministic workflow loop.
- Evidence that users trust plan/apply suggestions.

### Phase 2 (Months 4–6): convert team workflow pain

Objectives:

- Move from individual utility to shared team workflows.
- Prove measurable value in coordination and governance.

Deliverables:

- Shared rulesets and policy controls.
- Basic PR/CI integration path.
- Team-level reporting for findings/remediation status.

Commercial motion:

- Paid team plan beta.
- Select startup/small-team pilots.

Success signals:

- First paid teams.
- Reduced policy drift in pilot repos.
- Faster onboarding and less senior-engineer routing in pilot feedback.

### Phase 3 (Months 7–9): establish governance credibility

Objectives:

- Build trust for governance-sensitive use.
- Strengthen auditability and operational controls.

Deliverables:

- Audit history and approval primitives.
- Org-scoped access controls.
- Expanded deterministic contracts for automation.

Commercial motion:

- Higher-touch pilots with governance-minded teams.
- Optional implementation/support packages.

Success signals:

- Multi-repo team expansions.
- Security/governance stakeholder buy-in.
- Initial enterprise pipeline.

### Phase 4 (Months 10–12): package scale-ready offers

Objectives:

- Formalize packaging, pricing, and deployment options.
- Prepare repeatable GTM for team + enterprise lanes.

Deliverables:

- Clear free/team/enterprise packaging.
- Self-hosted or boundary-controlled deployment option (if demand validates).
- Case-study-backed ROI narrative.

Commercial motion:

- Repeatable outbound + partner-assisted motions.
- Contracted annual plans for qualified teams.

Success signals:

- Stable conversion from free to paid teams.
- Multiple reference customers.
- Documented ROI around consistency, safety, and governance throughput.

## Operating metrics to track from day one

- Activation: time-to-first-useful verify/query result.
- Retention: weekly repeated deterministic workflow usage.
- Trust: acceptance rate of generated plan/apply outputs.
- Governance impact: drift findings resolved per repo over time.
- Team value: onboarding time reduction and PR policy compliance trend.

## Explicit non-goals (first 12 months)

- Building a broad marketplace before core workflow maturity.
- Positioning as a generic coding chatbot product.
- Expanding surface area faster than deterministic quality improves.

## One-line strategy statement

Playbook will win by becoming the trusted system that turns repository knowledge into deterministic, governable, and monetizable engineering workflows for humans and AI.
