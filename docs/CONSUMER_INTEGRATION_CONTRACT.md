# Playbook Consumer Integration Contract

## Purpose

This contract defines how external repositories ("consumer repositories") install and operate Playbook while preserving the core product as a shared upstream engine.

Playbook integration follows a **shared core + project-local Playbook state** model:

- Playbook core remains reusable and centrally maintained.
- Runtime intelligence artifacts belong to each consumer repository.
- Installing Playbook in another repository **does not create a fork**.

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

- project-local Playbook state
- repository intelligence index
- verify results
- remediation plans
- architecture documentation generated or maintained for that repository
- optional repository-specific rule packs or extensions

### Non-fork guarantee

Installing Playbook in a repository creates local integration artifacts and configuration on top of shared Playbook Core. It does **not** require copying or forking Playbook Core into the consumer repository.

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

## 4) Upstream Promotion Model

Consumer repositories produce three classes of intelligence:

- **Repo-local knowledge**: decisions and findings that remain specific to one repository.
- **Reusable patterns**: governance/rule/architecture patterns that apply across repositories.
- **Product gaps**: missing capabilities that require upstream Playbook improvements.

Promotion expectations:

- Repo-local knowledge remains local by default.
- Reusable patterns should be promoted upstream through:
  - new rules
  - architecture patterns
  - roadmap proposals
- Product gaps should be promoted as issues, roadmap items, or targeted design proposals.

This keeps local implementation autonomy while strengthening shared Playbook Core.

## 5) Extension Model

Preferred customization mechanisms inside consumer repositories:

- configuration (`playbook.config.json` and related config surfaces)
- rule packs
- plugin extensions

Avoid this anti-pattern:

- forking or vendoring Playbook Core into consumer repositories for per-project customization

Extension-first customization preserves upgradeability, deterministic behavior, and clear ownership boundaries.

## 6) Embedded Runtime / API Direction

Future integration direction is server-integrated Playbook functions exposed through application APIs, for example:

- `/api/playbook/ask`
- `/api/playbook/query`
- `/api/playbook/explain`
- `/api/playbook/index`

Integration rules for application clients:

- Browser clients should call validated server APIs/actions.
- Browser clients should not execute arbitrary local CLI commands directly.
- Deterministic governance and policy enforcement should remain server-side.

This direction enables safer product integrations (dashboards, control planes, internal platforms) without weakening governance boundaries.

## 7) Example Consumer Repository Layout

```text
repo/
  .playbook/
  playbook.config.json
  docs/
  src/
```

Interpretation:

- `.playbook/` is project-local Playbook runtime intelligence.
- `playbook.config.json` captures repository-specific policy/configuration.
- `docs/` and `src/` remain consumer-owned repository domains.

## 8) Phased downstream consumer rollout (reusable)

Use this phased sequence for real downstream repositories so adoption remains deterministic and low risk.

### Phase 1 — bootstrap / read-only intelligence

- install Playbook in the consumer repository
- run read-only repository intelligence commands first (`context`, `ai-context`, `index`, `query`, `explain`)
- confirm operators can inspect architecture and rule surfaces before running mutation workflows

### Phase 2 — verify-only governance

- run `verify` only on active branches to establish governance baseline and findings quality
- treat findings and docs alignment as onboarding output; do not run `apply` yet
- confirm baseline safety and trust in deterministic findings/contracts

### Phase 3 — plan/apply pilot on low-risk branches

- enable `plan` and `apply` for tightly scoped, low-risk maintenance branches
- require human review of plan tasks before apply execution
- keep repository-specific implementation details local; only promote reusable rule/pattern improvements upstream

### Phase 4 — analyze-pr / CI rollout

- add `analyze-pr` for deterministic PR intelligence
- wire `verify` and selected intelligence commands into CI for repeatable policy checks
- promote tested reusable governance improvements upstream, while keeping consumer-specific ops/playbooks local

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
3. The consumer repository passes `npx --yes @fawxzzy/playbook doctor --ai`.

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
