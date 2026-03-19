# Playbook Development Execution System v1

## 1. Executive decisions

1. **Command ownership converges into engine now**: every product command has one canonical implementation in `@zachariahredfield/playbook-engine`; CLI handlers become argument parsing + output adapters only.
2. **`analyze` becomes a compatibility composition command**: keep first-class UX, but route execution through engine-owned intelligence + governance pipeline. No separate duplicate logic.
3. **`graph` evolves (not replaced)** into the **Architecture Intelligence Graph** surface, with `graph` as stable entrypoint and optional `graph <subcommand>` family in v0.7.
4. **`verify` is the quality gate kernel**: governance rules, roadmap compliance, contract drift, docs audit integration all flow through deterministic verify profiles.
5. **Roadmap contract is mandatory for all feature work**: no roadmap item, no feature.
6. **Failure Intelligence Loop is promoted to roadmap feature** and is required to prevent repeat uncodified failures.

## 2. Canonical command model

| Command | Purpose | Canonical owner | Lifecycle | De-duplication strategy |
| --- | --- | --- | --- | --- |
| `analyze` | Top-level repository health summary | engine | compatibility-stable | Compose `index/query + verify + docs/audit` in engine; CLI wrapper only |
| `verify` | Deterministic governance and release gates | engine | stable | Single rule runtime; command-specific checks become plugins |
| `plan` | Deterministic remediation plan from findings | engine | stable | Reads normalized finding contract only |
| `apply` | Deterministic autofix execution | engine | stable | Executes engine plan tasks only |
| `index` | Build intelligence artifacts | engine/node | stable | Owns all artifact generation; no side generators |
| `graph` | Architecture intelligence graph output/exploration | engine/node | stable->extended | Keep base `graph`; add subcommands in v0.7 (`graph impact`, `graph boundaries`) |
| `query` | Structured reads from intelligence artifacts | engine | stable | Strict query domains; no narrative output |
| `ask` | Natural-language Q&A over indexed intelligence | engine | stable | Uses `query` backplane; no direct file inference by default |
| `explain` | Deterministic explanations for architecture/rules/modules | engine | stable | Uses graph + rule metadata; avoids `ask` overlap by template-backed explainers |
| `analyze-pr` | Deterministic change-risk/impact analysis | engine/node | stable | Must consume shared SCM context + architecture graph only |

## 3. Package boundary and plugin convergence plan

### Target ownership map
- `@fawxzzy/playbook` (CLI): command registration, args/options parsing, output rendering, exit codes.
- `@zachariahredfield/playbook-engine`: canonical command handlers, orchestration, plugin lifecycle, contracts.
- `@zachariahredfield/playbook-core`: pure domain models, schema/types, rule abstractions, taxonomy primitives.
- `@zachariahredfield/playbook-node`: filesystem/scm/process adapters and platform I/O.

### Migration sequence
1. Create engine command registry (`commandId -> handler`) and route CLI wrappers to it.
2. Move `analyze` orchestration into engine composition handler.
3. Move plugin loading into one engine plugin manager.
4. Delete duplicated loaders/wrappers after contract parity tests pass.

### Anti-patterns to eliminate
- Command logic in CLI package.
- Duplicate plugin registration paths per command.
- Commands reading raw git/filesystem without node adapter.
- Contract schema definitions duplicated across docs/tests/runtime.

## 4. Shared SCM context normalization system

### Ownership
- Primary: `playbook-node` (`scm/context.ts`)
- Contracts/types: `playbook-core`
- Consumers: `playbook-engine` commands (`analyze-pr`, `ask --diff-context`, diff-aware `verify` checks)

### API shape
```ts
interface ScmContext {
  repoRoot: string;
  headSha: string;
  baseSha: string | null;
  mode: 'branch' | 'detached-head' | 'shallow' | 'merge-commit';
  changedFiles: ChangedFile[];
  renameMap: Array<{ from: string; to: string; similarity: number }>;
  diagnostics: ScmDiagnostic[];
}
```

### Migration order
1. Build provider + fixtures.
2. Migrate `analyze-pr` first.
3. Migrate `ask --diff-context`.
4. Migrate diff-aware `verify` rules.

### Required edge-case matrix
- detached HEAD
- shallow clone missing merge base
- rename-heavy diffs (`Rxx`)
- deleted file dependencies
- submodule pointer changes
- dirty working tree + staged-only mode

## 5. Roadmap execution system

- Keep canonical machine roadmap in `docs/roadmap/ROADMAP.json`.
- Enforce schema with `scripts/validate-roadmap-contract.mjs`.
- Add `pnpm playbook roadmap verify` as CLI alias over the script in v1.0.
- PR template must include `Roadmap-ID: PB-V...`.
- CI checks:
  - roadmap contract valid
  - PR references at least one roadmap ID
  - touched command/docs/contracts map to roadmap entry.
- Merge automation updates roadmap item status (`planned -> in-progress -> implemented-hardening`) and appends release note fragment.

### Parallel-safe narrative consolidation slice (planned)

Before Playbook expands into managed subagents, hook execution, or broader worker automation, the roadmap should include a first-class planning slice for **Worker Fragment Consolidation for Shared Singleton Docs**.

Problem:
- worker partitioning can isolate code ownership and still leave merge hotspots on singleton narrative docs such as `docs/CHANGELOG.md`, roadmap rollups, and shared architecture summaries
- parallelizable work is not automatically parallel-safe when canonical narrative surfaces remain shared write targets

Planned approach:
- workers write structured lane-local fragments / receipts
- workers avoid direct edits to protected singleton narrative docs during parallel execution
- one deterministic final consolidation step updates canonical shared docs
- the slice becomes prerequisite infrastructure for future managed subagents / hooks orchestration

Acceptance criteria:
- define worker-local fragment / receipt shape
- define protected singleton doc surfaces
- define consolidation-step responsibilities
- define guardrails preventing direct concurrent edits to protected singleton docs
- connect the slice to the future path `worker partitioning / overlap detection -> worker-local fragments / receipts -> final consolidation pass -> managed subagents / hooks`

Rule: Shared singleton docs should be updated through worker-local fragments plus a deterministic consolidation pass, not direct concurrent edits from multiple workers.
Pattern: Workers own isolated implementation changes; a final consolidator worker owns canonical narrative artifacts such as changelogs, roadmap rollups, and shared summary docs.
Failure Mode: Allowing every worker to edit the same root-level docs creates merge hotspots, inconsistent summaries, and doc drift even when code ownership is otherwise well partitioned.

## 6. Contract / docs / tests enforcement model

### Blocking in sprint
- command JSON output changed without contract update.
- command behavior changed without tests.
- roadmap ID missing in PR.
- plugin registry parity checks failing.
- SCM normalization contract failures for diff-aware commands.

### Warning-only in sprint
- docs prose improvements outside touched command scope.
- non-critical architecture note drift.

### Contract change checklist
1. Update command contract spec (`docs/contracts/*`).
2. Update schema/snapshot tests.
3. Update command docs page.
4. Update roadmap item `contracts/tests/docs` references if new files added.
5. Run command verification suite.

## 7. Roadmap feature: Failure Intelligence Loop

- **feature_id**: `PB-V06-FAILURE-INTELLIGENCE-001`
- **version**: `v0.6`
- **goal**: convert incidents into codified prevention artifacts.
- **command surface**: `failure ingest`, `failure classify`, `failure suggest`, `failure scaffold` (scaffold in v0.6.1).
- **ownership**: engine + core + CLI.
- **taxonomy example**:
  - `contract-drift`
  - `boundary-violation`
  - `scm-nondeterminism`
  - `docs-sync-gap`
  - `rule-gap-repeat`
- **prevention-target mapping**: `taxonomy -> {rule_template, test_template, doc_target, command_guard}`.
- **generated outputs**: failure reports in `.playbook/failures/*.json`, suggestion bundle, optional scaffold patches.
- **prevention guarantee**: each closed failure requires linked prevention target IDs; CI blocks unresolved "codification_required" failures.

## 8. Roadmap feature: Architecture Intelligence Graph

- **feature_id**: `PB-V07-ARCH-INTELLIGENCE-GRAPH-001`
- **version**: `v0.7`
- **goal**: semantic graph as reusable reasoning substrate.
- **relationship**: supersedes current repo graph schema while preserving compatibility export.
- **command surface**: existing `graph` plus `graph impact`, `graph boundaries`, `graph risks`.
- **ownership**: engine/node with core graph contracts.
- **artifacts**:
  - `.playbook/repo-index.json` (entity index)
  - `.playbook/repo-graph.json` (compat view)
  - `.playbook/arch-graph.v2.json` (semantic graph canonical)
- **incremental updates**: file-hash based invalidation + SCM diff deltas.
- **self-analysis**: Playbook uses arch graph to detect boundary violations and PR risk scoring.

## 9. Gate strategy for 4-week sprint

| Gate | Policy |
| --- | --- |
| Roadmap validation | hard-fail |
| Docs audit for touched command docs/contracts | hard-fail |
| Contract/snapshot changes | hard-fail |
| Plugin registry checks | hard-fail |
| SCM normalization checks | hard-fail for diff-aware commands |
| Governance note drift not tied to touched scope | warning |
| Architecture boundary checks | warning week 1, hard-fail weeks 2-4 |

## 10. 4-week implementation sequence

### Week 0 (pre-sprint stabilization)
- Freeze command ownership RFC and roadmap contract field set.
- Implement package_ownership enforcement and PR Roadmap-ID policy.
- Exit: CI enforces roadmap schema and PR linkage.

### Week 1
- Implement unified engine command/plugin registry.
- Migrate `analyze` to composition handler.
- Exit: no command business logic remains in CLI.

### Week 2
- Deliver shared SCM normalization module + fixtures.
- Migrate `analyze-pr` and diff-aware ask path.
- Exit: analyze-pr deterministic across edge-case fixtures.

### Week 3
- Implement Failure Intelligence Loop v1 (`ingest/classify/suggest`).
- Integrate verify/doctor hooks for codification-required failures.
- Exit: repeated failure classes produce prevention suggestions automatically.

### Week 4
- Ship Architecture Intelligence Graph v2 + impact/risk query surfaces.
- Harden docs/contracts/tests synchronization gates.
- Exit: graph-backed impact/risk used by analyze-pr and explain.

## 11. First 5 foundational PRs

1. **PR1**: `PB-V1-DELIVERY-SYSTEM-001` — Enforce roadmap contract fields + PR Roadmap-ID checks.
2. **PR2**: `PB-V05-PACKAGE-BOUNDARIES-001` — Engine command registry and thin CLI adapters.
3. **PR3**: `PB-V04-ANALYZEPR-001` — Shared SCM context normalization module and fixtures.
4. **PR4**: `PB-V06-FAILURE-INTELLIGENCE-001` — Failure ingest/classify/suggest command family.
5. **PR5**: `PB-V07-ARCH-INTELLIGENCE-GRAPH-001` — Semantic graph artifact and graph impact/risk surfaces.

## 12. Example artifacts

### Roadmap JSON entry (shape)
```json
{
  "feature_id": "PB-V06-FAILURE-INTELLIGENCE-001",
  "version": "v0.6",
  "title": "Failure intelligence loop and prevention codification",
  "goal": "Capture failures as structured intelligence and deterministically map them into rules, tests, docs, and remediation scaffolds.",
  "commands": ["verify", "plan", "apply", "doctor", "failure"],
  "contracts": ["docs/contracts/FAILURE_INTELLIGENCE_CONTRACT.md"],
  "tests": ["tests/contracts/failure-intelligence.contract.test.ts"],
  "docs": ["docs/commands/failure.md"],
  "dependencies": ["PB-V05-PACKAGE-BOUNDARIES-001"],
  "package_ownership": ["@fawxzzy/playbook", "@zachariahredfield/playbook-engine"],
  "verification_commands": ["pnpm playbook failure suggest --json"],
  "status": "planned"
}
```

### PR template snippet
```md
## Roadmap linkage
- Roadmap-ID: PB-V06-FAILURE-INTELLIGENCE-001
- Contract changes: [ ] yes [ ] no
- Command surface changed: [ ] yes [ ] no
```

### Command ownership map (short)
| Command | Owner |
| --- | --- |
| verify/plan/apply | engine |
| index/query/ask/explain | engine |
| analyze-pr | engine + node adapter |
| CLI argv/rendering | cli |

### Plugin registry interface sketch
```ts
interface PlaybookPluginRegistry {
  registerCommandPlugin(commandId: string, plugin: CommandPlugin): void;
  resolve(commandId: string): readonly CommandPlugin[];
  list(): readonly RegisteredPlugin[];
}
```

### SCM context interface sketch
```ts
interface ScmContextProvider {
  load(input: { baseRef?: string; headRef?: string; mode?: 'staged' | 'workspace' }): Promise<ScmContext>;
}
```

### Failure taxonomy schema sketch
```json
{
  "failure_id": "FIL-2026-0001",
  "taxonomy": "contract-drift",
  "severity": "high",
  "root_cause": "command output changed without contract update",
  "prevention_targets": ["rule:contract-sync", "test:cli-contracts", "doc:COMMAND_CONTRACTS_V1"]
}
```

### Architecture graph artifact sketch
```json
{
  "schemaVersion": "2.0",
  "nodes": [{ "id": "module:packages/engine", "kind": "module" }],
  "edges": [{ "from": "module:packages/cli", "to": "module:packages/engine", "kind": "depends-on" }],
  "impactIndex": { "file:packages/engine/src/x.ts": ["command:analyze-pr"] }
}
```

## 13. Codex-ready implementation prompts

### Cluster 1: ownership + registry
- **Objective**: implement canonical engine command registry and thin CLI adapters.
- **Plan**: add registry, migrate analyze/verify/rules handlers, remove duplicate loaders, add parity tests.
- **Files**: `packages/engine/src/commands/*`, `packages/cli/src/main.ts`, `tests/contracts/plugin-contracts.test.ts`.
- **Verification**: `pnpm -r build`, `pnpm test -- plugin-contracts`.
- **Docs summary**: update command ownership tables in roadmap and product roadmap docs.

### Cluster 2: SCM normalization
- **Objective**: build shared SCM context provider and migrate analyze-pr.
- **Plan**: add node provider, core types, fixtures for detached/shallow/rename cases, wire analyze-pr to provider.
- **Files**: `packages/node/src/scm/*`, `packages/core/src/contracts/*`, `packages/engine/src/commands/analyze-pr/*`.
- **Verification**: `pnpm playbook analyze-pr --json`, contract fixture tests.
- **Docs summary**: update `docs/architecture/SCM_CONTEXT_LAYER.md` and analyze-pr command docs.

### Cluster 3: failure intelligence v1
- **Objective**: implement failure ingest/classify/suggest and prevention mapping.
- **Plan**: add failure taxonomy schema, command handlers, suggestion generator, verify hook for unresolved codification-required classes.
- **Files**: `packages/engine/src/failure/*`, `packages/cli/src/commands/failure.ts`, `docs/contracts/FAILURE_INTELLIGENCE_CONTRACT.md`.
- **Verification**: `pnpm playbook failure ingest --json --input ...`, `pnpm test -- failure-intelligence`.
- **Docs summary**: add `docs/commands/failure.md` and workflow updates in dev workflow/roadmap docs.
