# Week 0 / Week 1 Execution Validator and Build Queue

This document operationalizes the accepted roadmap baseline into an execution-grade queue for immediate implementation. It is intentionally implementation-ordered and resolves only execution-critical ambiguity.

## 1) Baseline validation (execution-critical only)

### 1.1 Contradictions and duplicated authority

1. **Foundational PR sequence conflict**
   - `docs/roadmap/PLAYBOOK_EXECUTION_SYSTEM_V1.md` defines PR1 as delivery-gates and PR2 as engine registry.
   - `docs/roadmap/IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md` defines PR1/PR2/PR3 as package-boundary work first and defers delivery-gates to PR5.
   - **Execution impact**: merge order ambiguity and inconsistent gate timing.
   - **Decision**: adopt `Execution System v1` ordering for Week 0/1 (`delivery gates` first, then `command ownership`).

2. **Week allocation conflict for PB-V06/PB-V07**
   - `PLAYBOOK_EXECUTION_SYSTEM_V1.md` places Failure Intelligence in Week 3 and Architecture Graph in Week 4.
   - `IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md` places Graph start in Week 4 but also begins graph internals while delivering Failure Intelligence in the same week.
   - **Execution impact**: staffing and acceptance criteria can drift.
   - **Decision**: keep Week 3 = PB-V06 first usable slice; Week 4 = PB-V07 thin slice + hardening.

3. **Roadmap authority wording drift**
   - `docs/PLAYBOOK_PRODUCT_ROADMAP.md` says “Only one roadmap exists ... `docs/PLAYBOOK_PRODUCT_ROADMAP.md`.”
   - `docs/roadmap/ROADMAP.json` is already treated as machine-authoritative contract and CI source.
   - **Execution impact**: unclear tie-breaker during release gating.
   - **Decision**: strategic narrative authority = `docs/PLAYBOOK_PRODUCT_ROADMAP.md`; delivery contract authority = `docs/roadmap/ROADMAP.json`.

### 1.2 Missing dependency links / ownership / gate clarity

4. **No committed command ownership map artifact**
   - Decision exists in multiple docs, but no canonical machine-readable map file.
   - **Impact**: cannot enforce touched-command ownership checks deterministically.

5. **No committed plugin registry contract type file path in roadmap/contracts references**
   - Registry intent exists, but no contract anchor under `docs/contracts/` for CI/docs audit coupling.

6. **SCM normalization edge-case matrix is specified but fixture matrix contract path is not fixed**
   - **Impact**: week-2 diff behavior can regress without deterministic fixture coverage checks.

7. **Gate classification scattered across docs**
   - hard-fail/advisory policy appears in more than one file with slight wording differences.
   - **Impact**: CI friction from inconsistent expectations.

## 2) Final product model (confirmed)

| Command | Purpose | Canonical owner | Status | Overlap rule | Implementation implication |
|---|---|---|---|---|---|
| analyze | Top-level repository health UX | engine | compatibility-stable | Must compose index/query + verify + docs/audit; no bespoke CLI/core domain logic | Migrate all analyze orchestration into engine composition handler |
| verify | Deterministic governance gate kernel | engine | stable | Only authoritative finding source for plan | Centralize rule runtime + profile switching in engine |
| plan | Deterministic remediation planner | engine | stable | Inputs only verify findings contract | Enforce strict finding schema dependency |
| apply | Deterministic remediation executor | engine | stable | Executes plan tasks only; no ad-hoc mutation | Keep boundary checks and trust model in engine |
| index | Build intelligence artifacts | engine + node | stable | Sole producer of index/graph contract artifacts | Add incremental internals without contract drift |
| graph | Stable architecture graph surface | engine + node | stable external / evolving internal | Keep `graph` contract stable while v2 internals evolve | Export compatibility view from architecture graph core |
| query | Structured contract-backed reads | engine | stable | Deterministic structured retrieval only; no narrative | Expand domains through typed query handlers |
| ask | NL interface over trusted artifacts | engine | stable | Uses query/index context; no broad ad-hoc repo inference in repo-context mode | Keep source reporting deterministic |
| explain | Deterministic explainers for rule/module/architecture | engine | stable | Template-backed explanations; not freeform ask duplicate | Keep explain targets typed and contract-backed |
| analyze-pr | Diff-aware impact/risk surface | engine + node | stable | Must use shared SCM normalization + graph intelligence | First consumer of SCM context provider and graph risk paths |

### Final quick-start recommendation
1. `playbook ai-context --json`
2. `playbook ai-contract --json`
3. `playbook index --json`
4. `playbook query modules --json`
5. `playbook verify --json`
6. `playbook plan --json`
7. `playbook apply --from-plan .playbook/plan.json`

### Final AI operating ladder
`ai-context -> ai-contract -> context -> index -> query/explain -> ask --repo-context -> verify -> plan -> apply -> verify`

### Exact README changes required
1. In **Quick Start**, keep `analyze` as compatibility UX, but move deterministic technical flow to `ai-context + ai-contract + index` first.
2. In **CLI Commands**, label `analyze` as compatibility composition command.
3. In **AI Bootstrap**, keep the ladder string exactly aligned with the final operating ladder above.
4. Add one sentence clarifying `docs/PLAYBOOK_PRODUCT_ROADMAP.md` (strategic) vs `docs/roadmap/ROADMAP.json` (delivery contract).

## 3) Execution gaps blocking Week 0

### Must fix before Week 0
1. **Command ownership map artifact** (e.g. `docs/contracts/COMMAND_OWNERSHIP_MAP_V1.yaml`).
2. **PR template hard field for roadmap IDs** (single-line parseable key `Roadmap-ID:` plus optional multi-ID list).
3. **Roadmap validator wiring in CI with PR metadata enforcement** (`--ci --enforce-pr-feature-id` in PR workflows).
4. **Single gate matrix source file** for hard-fail vs advisory to remove distributed ambiguity.
5. **Plugin registry contract type anchor** (docs + core types path defined in roadmap entry references).

### Can fix during Week 1
6. **SCM fixture matrix directory contract** and deterministic fixture naming convention.
7. **Contract snapshot location convention** for new command surfaces (`tests/contracts/**`).
8. **Branch policy wording** in dev workflow for merge ordering and rebase expectations.

### Advisory only
9. **Roadmap docs cross-links cleanup** for reduced narrative duplication.
10. **Optional CLI `roadmap verify` alias polish** after validator enforcement lands.

## 4) First five foundational PRs (validated and normalized)

### PR1 — PB-V1-DELIVERY-SYSTEM-001 (delivery gates first)
- **Ordering**: correct as first.
- **Hidden dependencies**: PR template parseability and CI workflow coverage must exist before strict enforcement.
- **Scope risk**: medium if combined with broad workflow refactors.
- **Split**: keep as single PR if limited to validator + template + workflow wiring + docs checklist.
- **Acceptance criteria**:
  - roadmap contract validator enforces required fields;
  - PR workflows enforce `Roadmap-ID` linkage;
  - docs audit included in delivery checklist docs.
- **Verification commands**:
  - `node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id`
  - `node packages/cli/dist/main.js docs audit --json`
  - `pnpm -r build`
- **Required updates**: `docs/roadmap/README.md`, `docs/PLAYBOOK_DEV_WORKFLOW.md`, PR template.

### PR2 — PB-V05-PACKAGE-BOUNDARIES-001 (engine command registry skeleton)
- **Ordering**: correct after PR1.
- **Hidden dependencies**: command ownership map must be merged (from PR1 or PR2 pre-step).
- **Scope risk**: medium-high if it migrates command behavior in same PR.
- **Split recommendation**: split into **PR2A registry scaffold** and **PR2B CLI routing migration**.
- **Acceptance criteria**:
  - engine registry dispatch exists;
  - CLI wrappers route through engine dispatch for migrated commands;
  - no regression in verify/plan/apply command envelopes.
- **Verification commands**:
  - `pnpm -r build`
  - `pnpm -r test`
  - `node packages/cli/dist/main.js verify --json`
  - `node packages/cli/dist/main.js plan --json`
- **Required updates**: boundary refactor plan + command contract ownership wording.

### PR3 — PB-V05-PACKAGE-BOUNDARIES-001 (analyze composition migration)
- **Ordering**: correct after registry scaffold.
- **Hidden dependencies**: plugin registry API seam must be available to avoid duplicate loading.
- **Scope risk**: medium due to compatibility expectations.
- **Split recommendation**: keep separate from plugin registry consolidation.
- **Acceptance criteria**:
  - analyze orchestration is engine-owned;
  - CLI analyze remains UX-compatible;
  - contract snapshots updated if envelope fields change.
- **Verification commands**:
  - `node packages/cli/dist/main.js analyze --json`
  - `node packages/cli/dist/main.js verify --json`
  - `pnpm -r test`
- **Required updates**: README analyze positioning and boundary plan progress notes.

### PR4 — PB-V04-ANALYZEPR-001 (SCM normalization + analyze-pr)
- **Ordering**: correct after core ownership convergence starts.
- **Hidden dependencies**: agreed SCM context interface and fixture matrix path.
- **Scope risk**: high.
- **Split recommendation**: split into **PR4A provider + fixtures** and **PR4B analyze-pr migration**.
- **Acceptance criteria**:
  - shared provider implemented in node/core contracts;
  - analyze-pr consumes provider;
  - detached/shallow/rename/deleted/submodule/dirty fixtures pass.
- **Verification commands**:
  - `node packages/cli/dist/main.js analyze-pr --json`
  - `pnpm -r test -- analyze-pr`
  - `pnpm -r build`
- **Required updates**: SCM context architecture doc, analyze-pr command doc, roadmap refs if new fixture files/contracts added.

### PR5 — PB-V06-FAILURE-INTELLIGENCE-001 (first usable slice)
- **Ordering**: keep after delivery + ownership + SCM foundation.
- **Hidden dependencies**: plugin registry/checkpoint hooks for verify/doctor integration.
- **Scope risk**: medium-high.
- **Split recommendation**: **PR5A ingest/classify/suggest contracts**, **PR5B verify/doctor codification gate**.
- **Acceptance criteria**:
  - failure taxonomy schema + command contracts exist;
  - prevention-target mappings generated;
  - unresolved codification-required failure blocks closure path.
- **Verification commands**:
  - `node packages/cli/dist/main.js failure ingest --json --input .playbook/failures/sample.json`
  - `node packages/cli/dist/main.js failure suggest --json`
  - `pnpm -r test -- failure-intelligence`
- **Required updates**: failure contract doc, command docs, dev workflow closure policy.

## 5) Final execution queue (Week 0 / Week 1)

### Branch strategy
- Long-lived integration branch: `release/v0.5-weekly-execution`.
- PR branches: `feat/<feature-id>-<short-scope>`.
- Rebase required before merge; squash merge with roadmap ID in title.

### Week 0 queue

1. **PR W0-1** (`PB-V1-DELIVERY-SYSTEM-001`)
   - Scope: roadmap validator enforcement + PR template `Roadmap-ID` + CI workflow wiring.
   - Docs: `docs/roadmap/README.md`, `docs/PLAYBOOK_DEV_WORKFLOW.md`.
   - Contracts: roadmap contract validation behavior docs.
   - CI/script: ensure `--ci --enforce-pr-feature-id` runs on PR workflows.
   - Exit: PRs fail without valid roadmap ID and invalid roadmap contract.

2. **PR W0-2** (`PB-V1-DELIVERY-SYSTEM-001` + `PB-V05-PACKAGE-BOUNDARIES-001`)
   - Scope: add command ownership map artifact + plugin registry contract stub paths.
   - Docs: boundary plan + command contracts reference map.
   - Contracts: ownership map + registry contract anchor.
   - CI/script: add ownership map validation hook (advisory in Week 0).
   - Exit: ownership and registry authorities become machine-readable.

### Week 1 queue

3. **PR W1-1** (`PB-V05-PACKAGE-BOUNDARIES-001`)
   - Scope: engine command registry scaffold (PR2A).
   - Docs: boundary refactor progress and ownership map references.
   - Contracts: registry interface contract snapshot.
   - CI/script: plugin invariants check (advisory this PR, hard-fail next PR).
   - Exit: canonical dispatch path exists.

4. **PR W1-2** (`PB-V05-PACKAGE-BOUNDARIES-001`)
   - Scope: CLI thin routing migration for verify/plan/apply/rules (PR2B).
   - Docs: command contract ownership notes.
   - Contracts: update snapshots where envelopes changed.
   - CI/script: plugin invariants hard-fail.
   - Exit: migrated commands have no CLI business logic.

5. **PR W1-3** (`PB-V05-PACKAGE-BOUNDARIES-001`)
   - Scope: analyze composition migration (PR3).
   - Docs: README quick-start clarification + boundary docs.
   - Contracts: analyze compatibility contract updates (if output changed).
   - CI/script: analyze parity smoke checks.
   - Exit: analyze is engine-owned compatibility composition.

6. **PR W1-4** (`PB-V04-ANALYZEPR-001`)
   - Scope: SCM provider + fixture matrix scaffold (PR4A start).
   - Docs: SCM context contract doc + fixture policy.
   - Contracts: SCM context interface schema/types.
   - CI/script: fixture coverage check advisory.
   - Exit: shared normalized SCM context available to consumers.

## 6) Delivery gate matrix (final)

| Gate | Week 0 | Week 1 | Week 2+ |
|---|---|---|---|
| Roadmap validation | hard-fail | hard-fail | hard-fail |
| PR feature ID enforcement | hard-fail | hard-fail | hard-fail |
| docs audit (touched governance/command docs) | hard-fail | hard-fail | hard-fail |
| contract snapshot changes when JSON changes | hard-fail | hard-fail | hard-fail |
| plugin registry invariants | advisory | hard-fail (for migrated commands) | hard-fail |
| SCM normalization fixture coverage | advisory (setup) | advisory (scaffold) | hard-fail (diff-aware commands) |
| governance notes drift outside touched scope | advisory | advisory | advisory |
| architecture boundary checks | advisory | advisory | hard-fail |

## 7) PB-V06 Failure Intelligence operationalization

### Thinnest first usable slice
- Implement `failure ingest`, `failure classify`, `failure suggest` with deterministic JSON contracts.
- No scaffold patch generation in first slice (defer to v0.6.1).

### Ownership
- Engine: ingestion/classification/suggestion pipeline and prevention mapping.
- Core: taxonomy types/schema utilities.
- CLI: command wiring/output formatting.
- Node: optional file ingestion adapters.

### Command surface (first slice)
- `playbook failure ingest --input <file> --json`
- `playbook failure classify --id <failure-id> --json`
- `playbook failure suggest --id <failure-id> --json`

### Schema/contracts
- `docs/contracts/FAILURE_TAXONOMY_SCHEMA.json` (taxonomy + severity + recurrence + codification flags).
- `docs/contracts/FAILURE_INTELLIGENCE_CONTRACT.md` (command envelopes + lifecycle).
- Contract snapshots under `tests/contracts/failure-intelligence.*`.

### Taxonomy (v1)
- `contract-drift`
- `boundary-violation`
- `scm-nondeterminism`
- `docs-sync-gap`
- `rule-gap-repeat`

### Prevention-target mapping shape
```json
{
  "failure_id": "FIL-2026-0001",
  "taxonomy": "contract-drift",
  "codification_required": true,
  "prevention_targets": [
    { "type": "rule", "id": "rule:contract-sync" },
    { "type": "test", "id": "test:cli-contracts" },
    { "type": "doc", "id": "doc:COMMAND_CONTRACTS_V1" },
    { "type": "gate", "id": "gate:contracts-updated" }
  ]
}
```

### Generated outputs
- `.playbook/failures/failure-log.json`
- `.playbook/failures/suggestions/<failure_id>.json`
- optional `.playbook/failures/summary.json`

### Remediation scaffold scope
- First slice: suggestion-only output.
- Next slice: deterministic scaffold templates for rule/test/doc stubs.

### Merge criteria and PR flow insertion
- Run in PR validation as advisory in first merge, hard-fail once stable:
  - if `codification_required=true` and no prevention targets linked, PR cannot mark failure closed.
- **Prevents “fixes that never become system rules”** by requiring closure evidence that links failure to at least one codified guardrail artifact (rule/test/doc/gate).

## 8) PB-V07 Architecture Intelligence Graph operationalization

### Thinnest first usable slice
- Build internal semantic graph cache and compatibility exporter.
- Keep `graph` command output stable while adding internal impact traversal used by `analyze-pr`.

### Relationship to current artifacts
- `repo-index.json`: index entities and metadata.
- `arch-graph.v2.json` (new internal canonical artifact): semantic nodes/edges/risk signals.
- `repo-graph.json`: stable compatibility export derived from `arch-graph.v2.json`.

### Stable external vs evolving internal
- Stable: `playbook graph --json` envelope + compatibility fields.
- Evolving internal: semantic relationship types, impact score factors, boundary/risk annotations.

### Incremental update approach
- Full rebuild default.
- Add hash/diff-based partial update for changed files/modules.
- Fallback to full rebuild on invalidation or schema mismatch.

### First impacted commands
1. `analyze-pr` (impact/risk hints)
2. `query impact` / `query risk`
3. `explain architecture`

### First contract artifacts
- `docs/contracts/ARCHITECTURE_INTELLIGENCE_GRAPH_CONTRACT.md`
- `tests/contracts/architecture-graph.contract.test.ts`
- compatibility snapshots for `graph` command output.

### First validation tests
- graph build determinism snapshot test;
- impact traversal regression fixture;
- analyze-pr contract test proving same diff => same impact/risk output.

### First self-analysis usage inside Playbook
- Add CI smoke step that runs:
  - `playbook index --json`
  - `playbook graph --json`
  - `playbook analyze-pr --json`
- Assert generated risk/impact payload contracts in this repo.

## 9) Concrete artifact specs (implementation-ready)

### 9.1 Roadmap JSON update example
```json
{
  "feature_id": "PB-V1-DELIVERY-SYSTEM-001",
  "status": "in-progress",
  "dependencies": ["PB-V05-PACKAGE-BOUNDARIES-001"],
  "verification_commands": [
    "node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id",
    "node packages/cli/dist/main.js docs audit --json"
  ]
}
```

### 9.2 PR template snippet
```md
## Roadmap linkage
Roadmap-ID: PB-V1-DELIVERY-SYSTEM-001
Related-IDs: PB-V05-PACKAGE-BOUNDARIES-001

## Contract impact
- Contracts changed: [ ] yes [ ] no
- Snapshots updated (if JSON changed): [ ] yes [ ] n/a
```

### 9.3 Command ownership map (`docs/contracts/COMMAND_OWNERSHIP_MAP_V1.yaml`)
```yaml
schemaVersion: "1.0"
ownership:
  analyze:
    owner: "@zachariahredfield/playbook-engine"
    lifecycle: "compatibility-stable"
  verify: { owner: "@zachariahredfield/playbook-engine", lifecycle: "stable" }
  plan: { owner: "@zachariahredfield/playbook-engine", lifecycle: "stable" }
  apply: { owner: "@zachariahredfield/playbook-engine", lifecycle: "stable" }
  index: { owner: "@zachariahredfield/playbook-engine", adapters: ["@zachariahredfield/playbook-node"], lifecycle: "stable" }
  graph: { owner: "@zachariahredfield/playbook-engine", adapters: ["@zachariahredfield/playbook-node"], lifecycle: "stable" }
  query: { owner: "@zachariahredfield/playbook-engine", lifecycle: "stable" }
  ask: { owner: "@zachariahredfield/playbook-engine", lifecycle: "stable" }
  explain: { owner: "@zachariahredfield/playbook-engine", lifecycle: "stable" }
  analyze-pr: { owner: "@zachariahredfield/playbook-engine", adapters: ["@zachariahredfield/playbook-node"], lifecycle: "stable" }
```

### 9.4 Plugin registry interface
```ts
export type PluginCapability = 'verifyRule' | 'analyzeDetector' | 'explainProvider' | 'checkProvider';

export interface PlaybookPlugin {
  id: string;
  capability: PluginCapability;
  version: string;
}

export interface PlaybookPluginRegistry {
  register(plugin: PlaybookPlugin): void;
  resolve(capability: PluginCapability): readonly PlaybookPlugin[];
  invariants(): { ok: boolean; violations: string[] };
}
```

### 9.5 SCM context interface
```ts
export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface NormalizedScmContext {
  repoRoot: string;
  headSha: string;
  baseSha: string | null;
  mode: 'branch' | 'detached-head' | 'shallow' | 'merge-commit';
  changedFiles: ChangedFile[];
  renameMap: Array<{ from: string; to: string; similarity: number }>;
  diagnostics: Array<{ code: string; message: string; severity: 'info' | 'warn' | 'error' }>;
}
```

### 9.6 Failure taxonomy schema (JSON Schema excerpt)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PlaybookFailureTaxonomy",
  "type": "object",
  "required": ["failure_id", "taxonomy", "severity", "codification_required", "prevention_targets"],
  "properties": {
    "failure_id": { "type": "string", "pattern": "^FIL-[0-9]{4}-[0-9]{4}$" },
    "taxonomy": { "enum": ["contract-drift", "boundary-violation", "scm-nondeterminism", "docs-sync-gap", "rule-gap-repeat"] },
    "severity": { "enum": ["low", "medium", "high", "critical"] },
    "codification_required": { "type": "boolean" },
    "prevention_targets": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "id"],
        "properties": {
          "type": { "enum": ["rule", "test", "doc", "gate"] },
          "id": { "type": "string", "minLength": 1 }
        }
      },
      "minItems": 1
    }
  }
}
```

### 9.7 Architecture graph artifact schema (v2 excerpt)
```json
{
  "schemaVersion": "2.0",
  "generatedAt": "2026-03-08T00:00:00Z",
  "nodes": [{ "id": "module:packages/engine", "kind": "module" }],
  "edges": [{ "from": "module:packages/cli", "to": "module:packages/engine", "kind": "depends-on" }],
  "riskSignals": [{ "node": "module:packages/engine", "score": 0.62, "reasons": ["high-change-frequency"] }],
  "impactIndex": { "file:packages/engine/src/commands/analyzePr.ts": ["command:analyze-pr"] }
}
```

## 10) Codex-ready build prompts (aligned to Week 0/1 queue)

### Cluster 1 — Delivery gates and roadmap enforcement
- **Objective**
  - Implement hard-fail delivery gates for roadmap contract validity and PR feature-ID linkage.
- **Plan**
  1. Update roadmap validator wiring in PR workflows to include `--ci --enforce-pr-feature-id`.
  2. Standardize PR template with parseable `Roadmap-ID` field.
  3. Add one source-of-truth gate matrix doc section in dev workflow docs.
- **Files**
  - `scripts/validate-roadmap-contract.mjs`
  - `.github/pull_request_template.md`
  - `.github/workflows/ci.yml`
  - `docs/roadmap/README.md`
  - `docs/PLAYBOOK_DEV_WORKFLOW.md`
- **Verification**
  - `pnpm -r build`
  - `node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id`
  - `node packages/cli/dist/main.js docs audit --json`
- **Docs summary**
  - Clarify strategic vs contract roadmap authority and document gate failure semantics.

### Cluster 2 — Engine command registry + thin CLI routing
- **Objective**
  - Establish canonical engine dispatch and remove CLI business logic from migrated command paths.
- **Plan**
  1. Add engine registry abstraction and command dispatch API.
  2. Route CLI handlers for verify/plan/apply/rules through engine dispatch.
  3. Add plugin invariant checks for migrated paths.
- **Files**
  - `packages/engine/src/commands/*`
  - `packages/engine/src/plugins/*`
  - `packages/cli/src/commands/*`
  - `docs/architecture/V1_BOUNDARY_REFACTOR_PLAN.md`
  - `docs/contracts/COMMAND_CONTRACTS_V1.md`
- **Verification**
  - `pnpm -r build`
  - `pnpm -r test`
  - `node packages/cli/dist/main.js verify --json`
  - `node packages/cli/dist/main.js plan --json`
- **Docs summary**
  - Update canonical ownership references and migrated command boundary notes.

### Cluster 3 — Analyze migration + SCM normalization foundation
- **Objective**
  - Complete analyze composition ownership migration and start shared SCM context provider with fixture matrix scaffolding.
- **Plan**
  1. Move analyze orchestration into engine compatibility composition.
  2. Add SCM context contracts in core and provider scaffold in node.
  3. Add fixture matrix directory + first deterministic fixture cases.
- **Files**
  - `packages/engine/src/analyze/*`
  - `packages/cli/src/commands/analyze.ts`
  - `packages/core/src/scm/*`
  - `packages/node/src/scm/*`
  - `tests/fixtures/scm/*`
  - `docs/architecture/SCM_CONTEXT_LAYER.md`
- **Verification**
  - `pnpm -r build`
  - `pnpm -r test`
  - `node packages/cli/dist/main.js analyze --json`
  - `node packages/cli/dist/main.js analyze-pr --json`
- **Docs summary**
  - Mark analyze as compatibility composition and codify SCM edge-case fixture requirements.
