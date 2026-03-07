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
