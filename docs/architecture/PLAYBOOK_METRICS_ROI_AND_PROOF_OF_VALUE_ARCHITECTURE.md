# Playbook Metrics / ROI / Proof-of-Value Architecture

## Purpose

Define the canonical measurement architecture for Playbook so product value is measured through deterministic repository workflow outcomes, trust, governance quality, and coordination impact rather than vanity AI activity metrics.

This architecture is strategy and contract guidance only. It does not require cloud instrumentation and does not weaken CLI-first, offline-capable, or private-first operation.

Document role in the broader product story:

- Product roadmap owns strategic direction: `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.
- Business strategy owns commercial sequencing: `docs/PLAYBOOK_BUSINESS_STRATEGY.md`.
- Packaging architecture owns SKU boundaries: `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`.
- This document owns proof-of-value and ROI measurement contracts.

## Core doctrine

- Playbook value is measured through deterministic workflow outcomes, trust posture, governance quality, and coordination improvements.
- Proof-of-value must be evidence-linked, reproducible, and attributable; anecdotes are not sufficient and should never outrank deterministic evidence.
- ROI models must be separated by value layer:
  - individual developer value
  - team coordination value
  - enterprise governance/compliance value
- Metrics follow architecture and product positioning; product positioning must not be distorted to optimize dashboard-friendly activity counts.

## Canonical metric layers

1. Activation metrics
2. Retention/repeated workflow usage metrics
3. Trust metrics
4. Governance impact metrics
5. Team coordination metrics
6. Enterprise trust/audit metrics
7. Commercial proof-of-value / ROI metrics

Each layer should map back to deterministic command/session/evidence artifacts and preserve repository-level explainability.

## Layer definitions and recommended measures

### 1) Activation metrics (Open Core / individual-first)

- Time to first useful `query` or `verify` result.
- Time to first completed deterministic loop (`query/explain -> verify -> plan -> apply -> verify`) where applicable.
- Initial setup friction (repo readiness, docs clarity, baseline command success).

### 2) Retention / repeated deterministic workflow usage metrics

- Weekly repeated deterministic workflow usage (not one-off command volume).
- Repeat usage of `verify -> plan -> apply -> verify` where trust is preserved.
- Repeated use of repository intelligence surfaces (`index/query/explain`) tied to concrete outcomes.

### 3) Trust metrics

- Plan/apply acceptance rate (human-reviewed acceptance of proposed deterministic remediation).
- Verification pass-after-remediation rate.
- Fail-closed rate when ambiguity blocks mutation.
- Evidence completeness / provenance coverage.
- False-positive / false-negative trend for governance findings.
- Human override/correction patterns and their root causes.

### 4) Governance impact metrics

- Drift findings resolved over time by repository.
- Remediation turnaround time for verified findings.
- Policy exception / violation trend.
- Deployment/governance boundary compliance trend.

### 5) Team coordination metrics

- Onboarding time reduction for new contributors.
- PR policy compliance trend.
- Reduced senior-engineer routing/review bottlenecks.
- Multi-repo visibility/coordination improvement signals.
- Repeat shared-ruleset usage and governance adoption.

### 6) Enterprise trust / audit metrics

- Approval latency trend.
- Audit trace completeness and lineage quality.
- Self-hosted/hosted governance parity confidence over the same runtime semantics.
- Org-level adoption of policy-controlled workflows.

### 7) Commercial proof-of-value / ROI metrics

- Baseline before Playbook versus measured after Playbook over a defined proof window.
- Direct workflow savings.
- Avoided coordination costs.
- Avoided drift/remediation costs.
- Governance throughput improvements.
- Approval/audit overhead reduction.
- Explicit separation of cost inputs and value outputs.

## Recommended metric sets by packaging layer

### Open Core / individual

Track directional value without cloud dependence:

- time to first useful query/verify result
- weekly repeated deterministic workflow usage
- query/explain usefulness signals
- plan acceptance and trust in bounded remediation suggestions
- drift findings resolved over time
- reduction in repository ambiguity/inspection time (directional)

### Team

Track coordination and shared-governance outcomes:

- onboarding time reduction
- PR policy compliance trend
- remediation turnaround time
- reduced senior-engineer routing/review bottlenecks
- multi-repo visibility/coordination improvement signals
- repeat shared-ruleset usage and governance adoption

### Enterprise

Track governance throughput and audit confidence:

- approval latency
- audit trace completeness
- policy exception/violation trend
- deployment/governance boundary compliance
- self-hosted/hosted governance parity confidence
- org-level adoption of policy-controlled workflows

## Canonical ROI / proof-of-value model

### Measurement structure

For each pilot/team/org value case:

1. Baseline (pre-Playbook): capture comparable workflow, governance, and coordination signals.
2. Post-adoption measurement: collect the same signals after an agreed usage period.
3. Attribution pass: classify deltas by direct workflow savings, coordination effects, and governance effects.
4. Evidence binding: attach deterministic evidence/session artifacts to each claim.
5. Narrative synthesis: convert measured, attributable results into case-study-ready proof statements.

### ROI model components

- **Value outputs**
  - direct workflow time/cycle savings
  - avoided coordination and handoff costs
  - avoided drift/remediation costs
  - governance throughput and audit readiness improvements
- **Cost inputs**
  - adoption/setup time
  - training/enablement time
  - operational/admin overhead
  - optional deployment/support costs

Rule: never collapse value outputs and cost inputs into opaque single-score claims.

## Canonical measurement methodology

- Use before/after baselines for all ROI claims.
- Measure first at repo level; aggregate upward only after repo accountability is preserved.
- Support workspace/team-level aggregation with per-repo drill-down.
- Use cohort-based pilot measurement windows (for example 30/60/90-day proof periods).
- Separate leading indicators (activation, repeated usage, trust signals) from lagging indicators (governance outcomes, ROI).
- Attach qualitative evidence to quantitative metrics where useful (reviewer notes, pilot retrospectives, approval rationale).

## Attribution rules

- Prefer deterministic session/evidence artifacts as primary measurement sources.
- Treat raw command volume and generic AI activity as non-authoritative unless paired with outcome evidence.
- Keep value classes distinct:
  - activity
  - trust
  - governance improvement
  - business value
- Cross-repo aggregates must preserve per-repo explainability and provenance lineage.

## Anti-patterns to avoid

- Measuring chat/tool usage instead of repository outcomes.
- Claiming ROI without baseline and attribution.
- Rewarding unsafe automation only because it is faster.
- Using cloud-only data collection as the basis for product value.
- Monetizing metrics dashboards before deterministic workflow value is proven.

## SKU alignment and runtime semantics

- Open Core proves local deterministic value and trust.
- Team proves coordination and governance improvement.
- Enterprise proves auditability, approval control, and deployment-confidence value.
- All measurement layers must preserve the same core runtime semantics; SKU packaging must not redefine metric truth.

## Documentation summary labels (canonical)

- Pattern: Proof of Value Follows Deterministic Evidence
- Pattern: Trust Before ROI Scale
- Pattern: Multi-Layer Value Model (Individual, Team, Enterprise)
- Rule: Measure outcomes, not just activity
- Rule: ROI claims require baseline + attribution
- Rule: Governance metrics must preserve provenance and per-repo explainability
- Rule: Unsafe speed is not product value
- Failure Mode: Vanity usage metrics mistaken for value
- Failure Mode: ROI claims without baseline
- Failure Mode: Cloud-only instrumentation biasing product strategy
- Failure Mode: Fast but unsafe automation looking “successful” in dashboards
- Failure Mode: Aggregated metrics that lose per-repo evidence lineage

## Canonical architecture cross-links

- `docs/PLAYBOOK_BUSINESS_STRATEGY.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/CONSUMER_INTEGRATION_CONTRACT.md`
- `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`
- `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`
- `docs/architecture/PLAYBOOK_GOVERNED_INTERFACE_API_SURFACES_FOR_MULTI_REPO_CONTROL_PLANES.md`
