# Playbook 4-Week Implementation Operating Plan (Execution Baseline)

This plan operationalizes the existing roadmap and execution-system baseline for the next 4 weeks. It preserves accepted contracts and focuses on implementation sequence.

## 1) Executive Decisions

1. **Canonical command ownership**: all command behavior is canonical in `@zachariahredfield/playbook-engine`; CLI remains thin transport and rendering.
2. **`analyze` decision**: keep `analyze` in UX, but treat it as a **compatibility composition command** over `index/query + verify + docs/audit` (engine-owned orchestration).
3. **`graph` decision**: keep `graph` as external stable surface; evolve internals into the Architecture Intelligence Graph while retaining `.playbook/repo-graph.json` compatibility.
4. **`verify` decision**: `verify` is the deterministic gate kernel for governance + roadmap/docs/contracts checks through explicit profiles.
5. **Product model unification**: governance and repository intelligence are one system: intelligence artifacts feed governance decisions and remediation.
6. **Failure Intelligence**: every accepted high-severity failure must map to prevention targets (rule/test/doc/check) before closure.
7. **Knowledge lifecycle gating**: repository knowledge evolution is internal-first and must follow `observation/extraction -> canonicalization -> deterministic comparison -> bucketing/compaction -> promotion -> retirement`; no broad public `pnpm playbook knowledge *` surface in this horizon.

## 2) Baseline Consistency Check (Execution-Critical)

### Critical alignments already present
- Roadmap-as-contract, feature IDs, and CI validation are documented and active.
- Execution-system v1 already states engine-canonical command ownership and analyze compatibility composition.
- Product roadmap already recognizes architecture intelligence direction and SCM hardening.

### Execution-critical drift/ambiguity
1. **Quick-start drift**: README still leads with `analyze` as a first command and implies broad governance-first posture; AI ladder and repository intelligence docs present a richer index/query-first model.
2. **Ownership ambiguity in practice**: docs define engine canonical ownership, but current package behavior still shows split patterns (especially around analyze/plugin/SCM paths).
3. **Command-overlap ambiguity**:
   - `ask` and `explain` can appear overlapping without strict boundary language.
   - `graph` is documented as output surface but not yet fully described as semantic architecture layer.
4. **Delivery policy partially distributed**: roadmap validation, docs audit, contract updates, and PR feature-ID enforcement are spread across multiple docs rather than one operator checklist.
5. **Failure-intelligence closure gap**: failure codification is planned, but closure criteria are not yet enforced in merge-time gates.

## 3) Canonical Command Model

| Command | Purpose | Canonical owner | Status | Boundary rule | Evolution path |
|---|---|---|---|---|---|
| analyze | high-level health summary | engine | compatibility-stable | compose only; no bespoke logic outside engine | retain UX; later expose explicit composition profile |
| verify | deterministic governance gates | engine | stable | rule/runtime gate kernel | add profiles: local, ci, release |
| plan | deterministic remediation plan | engine | stable | consumes verify findings only | add prevention-target tasks |
| apply | deterministic safe execution | engine | stable | executes plan tasks only | optional scaffold generation |
| index | build intelligence artifacts | engine+node | stable | only source for index artifacts | add incremental rebuild |
| graph | architecture graph surface | engine+node | stable | external contract stable; internals evolve | graph v2 sub-queries/impact endpoints |
| query | structured deterministic retrieval | engine | stable | no narrative prose | expand domains (risk, impact, boundaries) |
| ask | NL interface over trusted artifacts | engine | stable | no ad-hoc inference when repo-context requested | consume graph v2 reasoner |
| explain | deterministic explainers | engine | stable | template-backed explanation, not open-ended Q&A | deeper rule/module/impact templates |
| analyze-pr | diff-aware impact/risk intelligence | engine+node | stable | must use shared SCM context and graph | richer CI/github review output contracts |

### Recommended quick-start (final)
1. `pnpm playbook ai-context --json`
2. `pnpm playbook index --json`
3. `pnpm playbook query modules --json`
4. `pnpm playbook verify --json`
5. `pnpm playbook plan --json`
6. `pnpm playbook apply --from-plan .playbook/plan.json`

### Final AI operating ladder
`ai-context -> ai-contract -> context -> index -> query/explain -> ask --repo-context -> verify -> plan -> apply -> verify`

### README placement decision
- Keep `analyze` visible for onboarding familiarity.
- Do **not** keep it as the sole first command in technical quick-start; promote `ai-context + index` first for deterministic model alignment.

## 4) Package Boundary + Plugin Convergence Plan

### Target ownership map
- `packages/cli`: argument parsing, output format adapters, exit codes, command registration.
- `packages/engine`: canonical command handlers, orchestration, plugin lifecycle, rule execution.
- `packages/core`: pure contracts/types/taxonomies and schema utilities.
- `packages/node`: SCM/filesystem/process adapters and normalization.

### Unified plugin registry shape
- Engine-owned registry with one load path, typed capability declarations (`verifyRule`, `analyzeDetector`, `explainProvider`, `checkProvider`).
- CLI cannot load plugins directly.

### Migration sequence
1. Introduce `engine` command registry and route all CLI handlers through it.
2. Move analyze composition logic fully to engine.
3. Converge plugin loading to a single engine registry.
4. Remove duplicate loaders/adapters in CLI/core.

### First migration candidate
- `analyze` command path (highest drift risk and clearest convergence value).

### Prohibited anti-patterns
- Domain logic in CLI.
- Multiple plugin loaders for same capability.
- Command-specific SCM diff implementations bypassing shared node adapter.
- Output contracts defined outside core schema + docs/contracts + snapshots.

## 5) Shared SCM Context Normalization Plan

### Ownership and API
- Primary implementation: `packages/node`.
- Types/contracts: `packages/core`.
- Consumers: `analyze-pr`, `ask --diff-context`, diff-aware `verify` checks.

```ts
interface NormalizedScmContext {
  repoRoot: string;
  baseRef: string | null;
  headRef: string;
  headSha: string;
  baseSha: string | null;
  mode: 'pr' | 'push' | 'detached' | 'shallow';
  changedFiles: Array<{
    path: string;
    status: 'A' | 'M' | 'D' | 'R' | 'C';
    previousPath?: string;
  }>;
  diagnostics: Array<{ code: string; severity: 'info' | 'warn' | 'error'; message: string }>;
}
```

### Normalization steps
1. Resolve base/head refs deterministically.
2. Compute merge-base with fallback diagnostics.
3. Parse changed files with rename normalization.
4. Canonical sort and stable envelope output.
5. Persist optional debug artifact for CI replay.

### Contract-test matrix
- detached HEAD
- shallow clone without merge-base
- rename-heavy diff
- deleted-file dependency graph impact
- staged-only vs full-worktree mode
- submodule pointer changes
- no-diff clean branch

### Migration order
1. `analyze-pr`
2. `ask --diff-context`
3. diff-aware `verify` checks

### Determinism protections
- identical output ordering in local and CI.
- explicit diagnostics instead of silent fallbacks.
- fixture-based SCM contract tests checked in.

## 6) Delivery System and CI Gate Model

### Operational flow
`roadmap item -> design -> implementation -> contracts -> docs -> verification -> PR -> roadmap status update`

### Planned command surface
- Add `pnpm playbook roadmap verify` as CLI mirror over roadmap validator script.

### Required PR metadata
- `Roadmap-ID: PB-V...`
- command surfaces changed
- contracts updated
- docs updated
- validation evidence commands

### Gate classification

**Blocking now**
- roadmap contract validation
- PR contains valid roadmap feature ID
- command contract docs/snapshots updated when command outputs change
- docs audit for docs/governance changes
- build + tests

**Advisory during sprint**
- full architecture graph incremental-performance thresholds
- failure-intelligence scaffold generation completeness
- non-critical advisory governance checks

**Blocking later (by Week 4)**
- failure prevention-target mapping required for P0/P1 defects
- diff-aware commands must consume normalized SCM context only
- roadmap status transition automation on merge

### Merge hooks
- auto-update feature status evidence artifact.
- append release-note/changelog snippets from roadmap-tagged PR metadata.

## 7) Failure Intelligence Implementation Plan

### Ownership
- Engine: ingestion pipeline, classifier, suggestion generator.
- Core: taxonomy + prevention target schemas.
- CLI: `failure` command group wrappers.

### Command surface
- `pnpm playbook failure ingest --from <json>`
- `pnpm playbook failure classify --id <id> --json`
- `pnpm playbook failure suggest --id <id> --json`
- `pnpm playbook failure scaffold --id <id> --dry-run`

### Taxonomy
- dimensions: layer, failure_type, determinism, recurrence, severity, trigger_surface.

### Prevention-target mapping
- map each class to required artifacts:
  - rule delta
  - test delta
  - docs delta
  - CI/check delta

### Generated outputs
- machine-readable prevention plan JSON
- suggested rule/test/doc/check patch set outline
- optional scaffold files (template tests/docs/rule stubs)

### Required contracts/tests/docs
- contract schema for failure record + classification + suggestions.
- snapshot tests for deterministic classification.
- integration tests for ingest->classify->suggest flow.
- docs: failure lifecycle + close criteria + examples.

### Verification commands
- `pnpm playbook failure classify --id demo --json`
- `pnpm -r test`
- `pnpm playbook verify --json`

### Operational trap prevention (explicit)
A failure cannot be marked closed until prevention-target mapping is complete and at least one codified artifact (rule/test/doc/check) is linked in PR evidence.

## 8) Architecture Intelligence Graph Implementation Plan

### Ownership
- Engine: semantic graph builder + query APIs.
- Node: extraction adapters and filesystem traversal.
- Core: graph schema and stable contract types.

### External surface
- keep `graph` command stable.
- add optional sub-queries (`graph impact`, `graph risk`, `graph boundaries`) while preserving v1 output compatibility.

### Artifact model relationship
- `.playbook/repo-index.json`: module/file summary index.
- `.playbook/repo-graph.json`: stable graph contract artifact.
- internal semantic graph cache: richer representation not directly exposed.

### Incremental strategy
- baseline full build remains default.
- add fingerprint-based incremental updates by module/file.
- fallback to full rebuild on invalidation.

### Impact/risk model
- changed nodes -> boundary traversal -> affected modules/services/functions -> risk scoring by boundary crossings + ownership + hotspot metadata.

### Required contracts/tests/docs
- schema versioned graph contract for external artifact.
- query/explain/analyze-pr contract snapshots tied to graph semantics.
- fixture repositories for impact/risk regression tests.
- docs: graph v2 concepts, compatibility policy, command usage.

### Verification commands
- `pnpm playbook index --json`
- `pnpm playbook graph --json`
- `pnpm playbook query impact <module> --json`
- `pnpm playbook analyze-pr --json`

### Self-analysis usage
Playbook must run graph-powered `analyze-pr` and `query impact/risk` against its own repo in CI smoke paths to prevent architecture-intelligence regressions.

## 9) Knowledge Lifecycle Sequencing (Internal-First)

This 4-week window treats deterministic knowledge lifecycle contracts as architecture guardrails, not optional enhancements.

### Stage definitions
- **Observed evidence**: raw extraction outputs from runtime/repository analysis.
- **Compacted candidates**: canonicalized + deterministically compared outputs that survive bucketing.
- **Promoted reusable knowledge**: patterns/rules/contracts elevated only after trust-threshold checks.
- **Retired knowledge**: superseded/deprecated/merged/removed artifacts under explicit lifecycle policy.

### Architectural risk statement
Uncontrolled accumulation of patterns/candidates without compaction and retirement turns deterministic intelligence into low-trust memory sprawl, degrading determinism, retrieval quality, and operator trust.

### Sequencing constraints
1. Promotion is blocked unless canonicalization, deterministic comparison, and compaction evidence exists.
2. Compaction is the trust-preserving bridge between extraction and promotion.
3. Retirement policy implementation is required to prevent stale or duplicative artifact growth.
4. Public command-surface expansion for knowledge management is deferred until lifecycle/trust contracts are stable.

## 10) 4-Week Sprint Sequence

### Week 0 (pre-sprint stabilization)
- freeze command ownership decisions.
- publish this plan + PR template Roadmap-ID requirements.
- add `roadmap verify` wrapper command skeleton.
- add knowledge lifecycle contract notes to roadmap/docs surfaces (observation -> canonicalization -> comparison -> compaction -> promotion -> retirement).

**Exit criteria**: baseline docs aligned; CI enforces roadmap ID.

### Week 1
- deliver package-boundary convergence slice: CLI->engine command registry + analyze migration start.
- introduce unified plugin registry contract.

**Exit criteria**: analyze path canonical in engine; no duplicate plugin load paths for migrated commands.

### Week 2
- ship SCM normalization MVP and migrate `analyze-pr`.
- add SCM edge-case contract test fixtures.

**Exit criteria**: analyze-pr consumes shared normalized SCM context in local + CI deterministically.

### Week 3
- migrate `ask --diff-context` + diff-aware verify checks to shared SCM.
- implement delivery-system hard gates and docs/contract coupling checks.

**Exit criteria**: all diff-aware commands share SCM provider; CI gate matrix active.

### Week 4
- implement Failure Intelligence first usable slice (ingest/classify/suggest + close criteria gate).
- begin Architecture Intelligence Graph v2 internals behind stable graph surface.

**Exit criteria**: failure codification loop executable in PR flow; graph v2 internal model powering at least one impact/risk path.

## 11) First 5 Foundational PRs

1. **PR: Engine command registry + thin CLI routing scaffold**
   - feature_id: `PB-V05-PACKAGE-BOUNDARIES-001`
   - objective: single canonical command dispatch path.
   - touches: `packages/cli/src/commands/*`, `packages/engine/src/*`.
   - verification: build/test/verify/docs audit.
   - risk: medium.
   - order reason: foundation for every later migration.

2. **PR: Analyze composition migration to engine**
   - feature_id: `PB-V05-PACKAGE-BOUNDARIES-001`
   - objective: remove analyze drift hotspot.
   - touches: `packages/engine/src/analyze/*`, `packages/cli/src/commands/analyze.ts`, snapshots.
   - verification: analyze/verify snapshots + smoke.
   - risk: medium-high.
   - order reason: highest leverage drift reduction.

3. **PR: Unified plugin registry v1**
   - feature_id: `PB-V05-PACKAGE-BOUNDARIES-001`
   - objective: one plugin registry for verify/explain/analyze capabilities.
   - touches: `packages/engine/src/plugins/*`, engine command initialization.
   - verification: plugin loading tests + rules/explain checks.
   - risk: medium.
   - order reason: prevents new divergence during upcoming work.

4. **PR: Shared SCM normalization + analyze-pr migration**
   - feature_id: `PB-V04-ANALYZEPR-001`
   - objective: deterministic diff context contract and analyze-pr adoption.
   - touches: `packages/node/src/*scm*`, `packages/engine/src/pr/analyzePr.ts`, contracts/tests.
   - verification: analyze-pr contracts in fixture matrix.
   - risk: high.
   - order reason: unblock diff-aware commands safely.

5. **PR: Delivery gates hardening + roadmap verify surface**
   - feature_id: `PB-V1-DELIVERY-SYSTEM-001`
   - objective: enforce roadmap/contracts/docs coupling in CI.
   - touches: CLI command surface, scripts validator wiring, PR template/docs.
   - verification: roadmap validator CI mode + docs audit + command contract checks.
   - risk: medium.
   - order reason: locks in process before failure-intelligence/graph expansion.

## 12) Example Artifacts

### A) Roadmap JSON entry update (example)
```json
{
  "feature_id": "PB-V05-PACKAGE-BOUNDARIES-001",
  "status": "in-progress",
  "milestone": "2026-Wk1",
  "verification_commands": [
    "pnpm -r build",
    "pnpm -r test",
    "pnpm playbook verify --json"
  ],
  "dependencies": [
    "PB-V04-PLAN-APPLY-001",
    "PB-V04-ANALYZEPR-001"
  ]
}
```

### B) PR template snippet
```md
## Roadmap linkage
Roadmap-ID: PB-V05-PACKAGE-BOUNDARIES-001

## Surface changed
Commands:
Contracts:
Docs:

## Validation
- [ ] pnpm -r build
- [ ] pnpm -r test
- [ ] node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id
```

### C) Command ownership map
```yaml
analyze: engine (compatibility composition)
verify: engine
plan: engine
apply: engine
index: engine+node
graph: engine+node
query: engine
ask: engine
explain: engine
analyze-pr: engine+node
cli: parsing+rendering only
```

### D) Plugin registry interface sketch
```ts
export interface PlaybookPluginRegistry {
  registerRule(plugin: VerifyRulePlugin): void;
  registerAnalyzer(plugin: AnalyzeDetectorPlugin): void;
  registerExplainer(plugin: ExplainProviderPlugin): void;
  listCapabilities(): RegistryCapability[];
}
```

### E) SCM context interface sketch
```ts
export interface ScmContextProvider {
  resolve(input: { repoRoot: string; mode: 'ci' | 'local'; stagedOnly?: boolean }): Promise<NormalizedScmContext>;
}
```

### F) Failure taxonomy schema sketch
```json
{
  "schemaVersion": "1.0",
  "failure": {
    "id": "FAIL-2026-0001",
    "layer": "engine",
    "failure_type": "contract-drift",
    "severity": "high",
    "recurrence": "repeat",
    "trigger_surface": "analyze-pr"
  },
  "prevention_targets": ["rule", "test", "docs", "ci-check"]
}
```

### G) Architecture graph schema sketch
```json
{
  "schemaVersion": "2.0",
  "nodes": [
    {"id": "module:packages/engine", "kind": "module"},
    {"id": "file:packages/engine/src/pr/analyzePr.ts", "kind": "file"}
  ],
  "edges": [
    {"from": "file:packages/engine/src/pr/analyzePr.ts", "to": "module:packages/node", "kind": "depends_on"}
  ],
  "derived": {
    "boundaries": [],
    "impactPaths": [],
    "riskSignals": []
  }
}
```

## 13) Codex-Ready Implementation Prompts

### Cluster 1: Package boundaries + command registry
**Objective**
Implement canonical engine command registry and migrate CLI handlers to thin wrappers.

**Plan**
1. Add engine registry abstraction.
2. Route CLI command handlers through registry.
3. Migrate `analyze` orchestration to engine composition.
4. Remove duplicate command logic paths.

**Files**
- `packages/engine/src/*`
- `packages/cli/src/commands/*`
- `docs/architecture/V1_BOUNDARY_REFACTOR_PLAN.md`
- `docs/contracts/COMMAND_CONTRACTS_V1.md`

**Verification**
- `pnpm -r build`
- `pnpm -r test`
- `pnpm playbook analyze --json`
- `pnpm playbook verify --json`

**Docs summary**
Update boundary plan and command contract docs to reflect engine canonical ownership and compatibility status for `analyze`.

### Cluster 2: Shared SCM normalization
**Objective**
Create normalized SCM context provider and migrate `analyze-pr`.

**Plan**
1. Implement provider in node package.
2. Add core contracts/types.
3. Migrate `analyze-pr` to provider.
4. Add edge-case contract fixtures and snapshots.

**Files**
- `packages/node/src/*scm*`
- `packages/core/src/*scm*`
- `packages/engine/src/pr/analyzePr.ts`
- `tests/contracts/analyze-pr*.json`

**Verification**
- `pnpm -r build`
- `pnpm -r test`
- `pnpm playbook analyze-pr --json`

**Docs summary**
Document deterministic SCM normalization behavior and diff edge-case guarantees.

### Cluster 3: Delivery system hardening
**Objective**
Operationalize roadmap/contracts/docs CI gate model with roadmap verify surface.

**Plan**
1. Add `pnpm playbook roadmap verify` command wrapper.
2. Enforce roadmap feature ID linkage in PR validation flow.
3. Couple command output changes to contracts/docs/snapshots.
4. Wire docs audit and verification checks as explicit gates.

**Files**
- `packages/cli/src/commands/*roadmap*`
- `scripts/validate-roadmap-contract.mjs`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/roadmap/README.md`
- `docs/PLAYBOOK_DEV_WORKFLOW.md`

**Verification**
- `pnpm -r build`
- `node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id`
- `pnpm playbook docs audit --json`

**Docs summary**
Add one canonical operator checklist for roadmap-driven delivery and gate states (blocking/advisory timeline).
