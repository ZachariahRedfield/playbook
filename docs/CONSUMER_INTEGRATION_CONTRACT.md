# Playbook Consumer Integration Contract

## Purpose

This contract defines how external repositories ("consumer repositories") install and operate Playbook while preserving the core product as a shared upstream engine.

Playbook integration follows a **shared core + project-local Playbook state** model:

- Playbook core remains reusable and centrally maintained.
- Runtime intelligence artifacts belong to each consumer repository.
- Installing Playbook in another repository **does not create a fork**.

Canonical package-first distribution rule:

- Consumer repositories install Playbook as a repo-local dependency and run the repo-local CLI.
- Consumer integrations must not require a globally installed `playbook` binary on PATH.
- Optional local-checkout fallback wiring is temporary/dev-only and must not become canonical runtime behavior.

Control-plane inheritance rule:

- Consumer integrations inherit shared policy constraints from `docs/architecture/PLAYBOOK_CONTROL_PLANE_ARCHITECTURE.md`.
- Local repositories still preserve project-local state ownership (`.playbook/*`) and explicit promotion/export decisions.

## 1) Integration Model

### Playbook Core (shared upstream)

Playbook Core is the reusable product surface consumed by many repositories:

- CLI engine
- rule engine
- remediation engine
- repository intelligence engine

Core behavior, command contracts, and deterministic workflows are maintained upstream and distributed for reuse.

### Consumer Repository (project-local integration)

Each consumer repository owns its own Playbook integration state and outputs, including:

- repo-local Playbook CLI dependency resolution
- project-local Playbook state
- repository intelligence index
- verify results
- remediation plans
- architecture documentation generated or maintained for that repository
- optional repository-specific rule packs or extensions

### Non-fork guarantee

Installing Playbook in a repository creates local integration artifacts and configuration on top of shared Playbook Core. It does **not** require copying or forking Playbook Core into the consumer repository.

### Runtime resolution contract (consumer repositories)

Consumer integrations should resolve the runtime in deterministic order:

1. `PLAYBOOK_BIN` environment override (explicit operator/CI selection).
2. Repo-local install (`node_modules/.bin/playbook`, including `pnpm playbook ...`).
3. Optional development fallback to a local Playbook checkout (non-canonical and temporary/dev-only).
4. Deterministic failure with actionable setup instructions.

Failure-semantics rules:

- Global PATH lookup is non-canonical and must not be required.
- Missing runtime resolution must fail explicitly with operator guidance.
- Consumer repos must provide one canonical operator command path; shadow wrappers that redefine Playbook behavior are not allowed.
- Published wrapper entrypoints (for example `@fawxzzy/playbook-cli`) must remain thin delegates to the canonical `@fawxzzy/playbook` runtime and preserve semantic artifact parity under `.playbook/` (not metadata-only execution).

### External contract truth inheritance (Fitness)

When consumer integration surfaces depend on the Fitness contract boundary, the Fitness contract is the source of truth and Playbook acts as a consumer adapter.

Contract inheritance rules:

- Consumer repositories should document the Fitness dependency as **external truth** in integration surfaces (for example truth-pack metadata or integration docs).
- Playbook interop/adapter outputs must derive from the upstream Fitness contract and must not duplicate or reinterpret the contract into a divergent local spec.
- If direct import from the external Fitness source is unavailable, local mirrors are permitted only as byte-for-byte semantic mirrors (same canonical fields, types, and meaning).
- Any mismatch between local mirrors and upstream Fitness contract must be treated as contract drift and remediated before asserting integration health.

## 2) Project-Local Playbook State

Playbook runtime state for a consumer repository is stored under `.playbook/`.

Example contract structure:

```text
.playbook/
  repo-index.json
  verify.json
  plan.json
```

These artifacts are runtime intelligence and workflow outputs specific to the consumer repository's codebase, architecture, and governance results.

Contract rules:

- `.playbook/*` artifacts represent **consumer-repo-local state**.
- Artifact contents vary by repository and over time.
- Consumer repositories own lifecycle decisions for these artifacts (e.g., keep local, commit selected outputs, or regenerate in CI).

## 3) Privacy Model

Playbook operates with a private-first default model.

Required privacy rules:

- Playbook scans run locally.
- Repository source code is not uploaded automatically.
- No hidden telemetry.
- Export/sync behavior must be explicit and opt-in.
- Playbook must work offline.

This model ensures consumer repositories can adopt Playbook without implicit data sharing or cloud dependency.


Metrics/proof-of-value contract:

- downstream pilots should measure value from deterministic repo-local outputs first (for example `.playbook/*` artifacts, verify/plan/apply outcomes, and evidence lineage)
- workspace/tenant aggregation is optional and must preserve per-repo provenance and explainability
- private-first behavior remains mandatory: no hidden telemetry and no cloud-required instrumentation for baseline value measurement
- export of aggregated metrics remains explicit opt-in and policy-controlled

Metrics architecture reference: `docs/architecture/PLAYBOOK_METRICS_ROI_AND_PROOF_OF_VALUE_ARCHITECTURE.md`.

Pilot/rollout architecture reference: `docs/architecture/PLAYBOOK_PILOT_DESIGN_PARTNER_AND_ROLLOUT_ARCHITECTURE.md`.

## 4) Governed Promotion and Cross-Repo Transfer Model

Consumer repositories produce three classes of intelligence:

- **Repo-local knowledge**: decisions and findings that remain specific to one repository.
- **Reusable patterns**: governance/rule/architecture patterns that apply across repositories.
- **Product gaps**: missing capabilities that require upstream Playbook improvements.

Promotion/transfer expectations:

- Repo-local knowledge remains local by default.
- Reusable knowledge may move across repositories only through explicit, approved, provenance-preserving transfer paths.
- Imported reusable patterns are candidate inputs in receiving repos until local review/adoption promotes them.

Cross-repository transfer direction (future-facing) must preserve privacy and scoped ownership boundaries.

- No consumer repository should receive another repository's raw local facts by default.
- Reuse should happen through sanitized, reviewable, compatibility-scoped pattern packages only.
- Ownership metadata and sanitization status should remain explicit so promotion/transfer authority and consumption scope are auditable.
- Reusable patterns may be promoted through governed transfer targets such as:
  - upstream core rules/templates/contracts
  - architecture pattern docs
  - roadmap/core product proposals
  - approved reusable pattern libraries
- Product gaps should be promoted as issues, roadmap items, or targeted design proposals.
- Transfer must allow explicit demotion/recall paths for bad or superseded reusable patterns.

This keeps local implementation autonomy while strengthening shared Playbook Core without introducing hidden global-memory behavior.

Longitudinal architecture reference: `docs/architecture/PLAYBOOK_REPO_LONGITUDINAL_STATE_AND_KNOWLEDGE_PROMOTION.md`.

Governed transfer architecture reference: `docs/architecture/PLAYBOOK_GOVERNED_CROSS_REPO_PATTERN_PROMOTION_AND_TRANSFER.md`.


### Repo-local vs promotable knowledge boundaries

Playbook separates consumer-repository intelligence into two governance classes:

- **Repo-local facts (default-local):** repository-specific architecture details, internal operational context, findings history, and sensitive evidence.
- **Promotable reusable patterns (sanitized):** generalized rules/patterns/contracts that have been reviewed for reuse and stripped of repository-identifying or sensitive detail.

Boundary rules:

- Repo-local facts stay local unless an explicit promotion workflow is approved.
- Promotion candidates must be sanitized before any upstream or cross-repository use.
- Only sanitized reusable patterns are promotable upstream; raw repo-local knowledge is not.
- Promoted/transferable patterns must retain evidence lineage/provenance while preserving privacy and scoped ownership boundaries.
- Promotion/transfer workflows must preserve source artifact and command-output provenance so downstream consumers can audit trust decisions.
- Repo-local longitudinal memory (`.playbook/` runtime state, recurring findings, remediation history, approval history) remains repository-scoped by default.
- Candidate knowledge (including imported reusable patterns) is not enforceable governance until explicit human review promotes it.
- Stale or contradicted promoted knowledge must be demotable/supersedable through explicit review.

### Downstream automation synthesis inheritance rules

If consumer repositories adopt future automation synthesis features, synthesized automations must inherit this contract:

- synthesis consumes governed/promoted, inspectable, provenance-linked knowledge artifacts only
- generated automation remains untrusted until verification succeeds
- runtime outcome feedback artifacts remain repo-local/private-first by default
- runtime-learning outputs are candidate artifacts and do not auto-promote enforced governance
- candidate knowledge and raw conversation memory are not automation-grade inputs
- repo-local/private-first boundaries apply to synthesis context packaging, runtime feedback retention, and deployment policy
- promoted reusable patterns may inform shared automation patterns only through governed promotion/transfer paths
- no hidden telemetry or implicit upstream synchronization is introduced by synthesis or runtime-learning surfaces

Automation synthesis reference: `docs/architecture/PLAYBOOK_AUTOMATION_SYNTHESIS_GOVERNED_KNOWLEDGE_CONSUMPTION.md`.

Outcome feedback reference: `docs/architecture/PLAYBOOK_OUTCOME_FEEDBACK_AND_AUTOMATION_RUNTIME_LEARNING.md`.

## 5) Extension Model

Preferred customization mechanisms inside consumer repositories:

- configuration (`playbook.config.json` and related config surfaces)
- rule packs
- plugin extensions

Avoid this anti-pattern:

- forking or vendoring Playbook Core into consumer repositories for per-project customization

Extension-first customization preserves upgradeability, deterministic behavior, and clear ownership boundaries.

## 6) Governed Interface / API and Control-Plane Direction

Future integration direction expands from embedded runtime examples to a broader governed interface/control-plane model.

Canonical model:

- shared Playbook Core remains the deterministic runtime
- each consumer repository retains project-local Playbook state ownership
- server/API control planes coordinate repositories through governed interface actions
- interface surfaces are thin wrappers over canonical runtime/session/evidence/control-plane behavior
- interfaces do not redefine engine semantics

Directional interface families include:

- `/api/playbook/ask`
- `/api/playbook/query`
- `/api/playbook/explain`
- `/api/playbook/index`
- future session/evidence inspection endpoints
- future knowledge inspection endpoints
- future governed transfer/import endpoints
- future approved orchestration endpoints

Control-plane boundary rules:

- Browser clients should call validated server APIs/actions.
- Browser clients should not execute arbitrary local CLI commands directly.
- Deterministic governance and policy enforcement remain server-side and route through shared control-plane checks.
- Multi-repo control planes coordinate repositories; they do not erase per-repo boundaries.
- Local CLI operation remains valid even when server/API surfaces exist.
- Hosted/cloud control planes remain optional, not required for baseline local use.

Privacy/locality posture for control planes:

- repo-local facts remain local by default
- no hidden telemetry
- export/sync remains explicit opt-in
- multi-repo surfaces should consume governed summaries and approved artifacts by default, not unrestricted raw repo memory
- aggregated views must preserve per-repo provenance and evidence drill-down

Governed-interface architecture reference: `docs/architecture/PLAYBOOK_GOVERNED_INTERFACE_API_SURFACES_FOR_MULTI_REPO_CONTROL_PLANES.md`.

Workspace/tenant governance + deployment packaging reference: `docs/architecture/PLAYBOOK_WORKSPACE_TENANT_GOVERNANCE_AND_OPTIONAL_HOSTED_DEPLOYMENT.md`.

Workspace/tenant integration contract clarifications:

- Consumer repos retain local ownership of `.playbook/*` state even when attached to optional workspace/tenant control planes.
- Workspace/tenant coordination layers provide governed aggregation and policy views; they do not replace per-repo local evidence truth.
- Tenant/workspace defaults must remain inspectable and must not silently erase repository-local override visibility.
- Hosted/self-hosted coordination remains optional packaging over shared deterministic runtime semantics.
- Paid coordination/governance layers must not erase per-repo local ownership boundaries.
- Open Core, Team, and Enterprise packaging variants must preserve shared core + project-local state semantics.

Packaging architecture reference: `docs/architecture/PLAYBOOK_PACKAGING_AND_SKU_ARCHITECTURE_OPEN_CORE_TO_TEAM_TO_ENTERPRISE.md`.

## 7) Example Consumer Repository Layout

```text
repo/
  .playbook/
  playbook.config.json
  docs/
  src/
```

Interpretation:

- `.playbook/` is project-local Playbook runtime intelligence generated/owned by Playbook runtime commands.
- `playbook.config.json` is optional and captures repository-specific policy/configuration when explicit control is needed.
- `.playbookignore` is optional and controls repository scan exclusions for high-churn or irrelevant paths.
- `docs/` and `src/` remain consumer-owned repository domains.

Graceful-adoption rule:

- Missing `playbook.config.json` is not a failure; Playbook falls back to defaults and should guide operators toward optional next-step files.

## 8) Phased downstream consumer rollout (reusable)

This downstream sequence aligns to the canonical pilot/rollout architecture stages and keeps consumer adoption tied to deterministic trust maturity.

### Phase 1 — bootstrap / read-only intelligence (Stage 1 alignment)

- install Playbook in the consumer repository
- run read-only repository intelligence commands first (`context`, `ai-context`, `index`, `query`, `explain`)
- confirm operators can inspect architecture and rule surfaces before any mutation workflows
- record activation/readability proof from deterministic command outputs

### Phase 2 — verify-only governance baseline (Stage 2 alignment)

- run `verify` only on active branches to establish governance baseline and findings quality
- treat findings and docs alignment as onboarding output; do not run `apply` yet
- confirm baseline safety and trust in deterministic findings/contracts
- capture trust proof artifacts (repeatability, finding quality, operator acceptance)

### Phase 3 — plan/apply pilot on low-risk branches (Stage 3 alignment)

- enable `plan` and `apply` for tightly scoped, low-risk maintenance branches
- require human review of plan tasks before apply execution
- require post-apply `verify` closure for every mutation path
- keep repository-specific implementation details local; only promote reusable rule/pattern improvements upstream

### Phase 4 — analyze-pr / CI rollout (Stage 4 alignment)

- add `analyze-pr` for deterministic PR intelligence
- wire `verify` and selected intelligence commands into CI for repeatable policy checks
- require PR review findings/comments to preserve session/evidence lineage and inherit control-plane mutation/approval boundaries
- keep PR remediation suggestions bounded and policy-gated; re-run `verify` after any candidate mutation path
- promote tested reusable governance improvements upstream, while keeping consumer-specific ops/playbooks local

Expansion note:

- Team/workspace and enterprise-style rollout (Stages 5-6) should only start after repo-level trust is proven in this phase model.

PR review inheritance rule:

- `analyze-pr`/CI review workflows are downstream of Session + Evidence and Control Plane contracts.
- Repo-local runtime state remains local unless explicitly promoted.
- Promotion/export boundaries remain explicit and review-gated; review interfaces must not imply automatic cross-repo memory transfer.

## 9) Consumer artifact handling and display snapshots

Artifact handling model:

- Normal consumer runtime artifacts stay under `.playbook/` and are local/private-first by default.
- Product-facing display artifacts are curated committed snapshots under `.playbook/demo-artifacts/`.
- The display set should be intentionally selected and regenerated from real command runs, not hand-written.

Recommended display set for consumer repositories (modeled after `playbook-demo`):

- `.playbook/demo-artifacts/index.json`
- `.playbook/demo-artifacts/rules.json`
- `.playbook/demo-artifacts/explain-architecture.json`
- `.playbook/demo-artifacts/explain-module.json`
- `.playbook/demo-artifacts/explain-rule.json`
- `.playbook/demo-artifacts/verify-before.json`
- `.playbook/demo-artifacts/plan.json`
- `.playbook/demo-artifacts/apply.json`
- `.playbook/demo-artifacts/verify-after.json`
- `.playbook/demo-artifacts/doctor.txt`
- `.playbook/demo-artifacts/docs/ARCHITECTURE_DIAGRAMS.md`
- `.playbook/demo-scenarios.md`

## 10) Deterministic consumer pilot trigger (Fawxzzy Fitness first pilot)

Reusable trigger contract for downstream pilot activation:

1. `docs/roadmap/ROADMAP.json` shows `PB-V04-PLAN-APPLY-001` status as `implemented-hardening` or `implemented`.
2. `docs/roadmap/ROADMAP.json` shows `PB-V04-ANALYZEPR-001` status as `implemented-hardening` or `implemented`.
3. The consumer repository passes `pnpm playbook doctor --ai`.

When all trigger conditions are true, operator/assistant guidance must explicitly state:

"It is time to start testing Playbook on Fawxzzy Fitness."

This trigger is written so Fawxzzy Fitness is the first pilot example while keeping reusable adoption policy upstream.

## 11) Standing assistant instruction snippet for future sessions

Use this snippet in downstream rollout chats:

> Before giving rollout guidance, check `docs/roadmap/ROADMAP.json` for roadmap contract status, check the Fawxzzy Fitness consumer pilot trigger conditions, and explicitly notify the user when the trigger is met by saying: "It is time to start testing Playbook on Fawxzzy Fitness."

## Verification Answers

### What happens when Playbook is installed in another repository?

Playbook Core is installed as a shared governance/intelligence engine, and the repository gains project-local Playbook state (for example `.playbook/repo-index.json`, `.playbook/verify.json`, `.playbook/plan.json`) specific to that repository.

### Does installation create a fork?

No. Installation is an integration on shared Playbook Core, not a fork.

### What data stays local?

By default, repository scanning outputs and runtime intelligence artifacts stay local; there is no automatic source upload, and export/sync is explicit opt-in.

### How can repos promote reusable patterns upstream?

Promote reusable patterns through upstream rules, architecture pattern proposals, and roadmap proposals.

### How can apps safely integrate Playbook functionality?

Use server-side/runtime APIs (for example `/api/playbook/ask`, `/api/playbook/query`, `/api/playbook/explain`, `/api/playbook/index`) and keep browser clients on validated API calls rather than direct CLI execution.
