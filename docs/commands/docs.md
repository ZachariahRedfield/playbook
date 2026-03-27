# `pnpm playbook docs audit`

`pnpm playbook docs audit` validates Playbook documentation governance with deterministic guardrails for the active docs canon.

## Usage

```bash
pnpm playbook docs audit
pnpm playbook docs audit --json
pnpm playbook docs audit --ci --json
pnpm playbook docs consolidate --json
pnpm playbook docs consolidate-plan --json
```

## Checks

1. Canonical required-anchor checks for current active docs and roadmap/archive anchors.
2. Single-roadmap and planning-surface governance (planning language stays on approved planning surfaces).
3. Active-surface package/install consistency (`@fawxzzy/playbook` and no unscoped/legacy package examples).
4. Active-surface legacy-link detection for superseded compatibility-stub doc paths.
5. Front-door canonical-ladder drift checks (`ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify -> plan -> apply -> verify`) with `analyze` treated as compatibility/lightweight.
6. Repo-scoped roadmap/story contract checks when a repository opts into `docs/ROADMAP.md`, including required roadmap sections, required `docs/stories/`, and required story headings.
7. Archive and compatibility-stub hygiene (general archive naming conventions, intentional redirect stubs, and cleanup-candidate reporting for ad hoc trackers).
8. Subapp repo truth-pack contract checks for `subapps/*` and `examples/subapps/*` (required files/directories, required `playbook/context.json` fields, and optional integration JSON validity when present).

## CI behavior

- `--ci` exits non-zero when any `error` findings are present.
- `warning` findings are reported but non-blocking.

## Governance patterns

- Pattern: Documentation architecture is an executable contract enforced by Playbook commands.
- Rule: Active docs must describe the deterministic runtime/trust-layer model and the scoped public package surface.
- Rule: Compatibility stubs and archive/history docs are intentionally preserved but excluded from active-surface drift checks.
- Failure Mode: Active-surface drift occurs when front-door docs regress to legacy package examples, superseded doc links, or analyze-first serious-user workflows.


## Consolidation seam

`pnpm playbook docs consolidate` is the proposal-only consolidation seam for protected singleton docs. It reads worker fragments plus the protected-surface registry, writes `.playbook/docs-consolidation.json`, and emits one compact operator brief centered on decision, affected surfaces, blockers, and next action.

- Rule: Consolidation is the only write boundary for protected singleton narrative docs.
- Pattern: Workers propose; consolidator integrates.
- Pattern: Shared narrative work is complete only when consolidation is complete.
- Failure Mode: Parallel docs work without consolidation becomes a merge-management problem, not a productivity gain.

Command reference: [`pnpm playbook docs consolidate`](docs-consolidate.md).
