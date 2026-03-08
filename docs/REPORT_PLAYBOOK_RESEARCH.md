# Playbook Deep Research Report

## Scope

This report captures a Playbook-first investigation of repository architecture, governance posture, risk signals, and command-surface behavior using local built CLI commands.

## Method

The research followed the repository AI operating ladder and preferred command authority:

1. `pnpm -r build`
2. `node packages/cli/dist/main.js ai-context --json`
3. `node packages/cli/dist/main.js ai-contract --json`
4. `node packages/cli/dist/main.js context --json`
5. `node packages/cli/dist/main.js index --json`
6. Query/explain/ask/rules/verify/docs/doctor/status/analyze-pr passes for cross-validation.

## Key Findings

### 1) Deterministic AI and remediation contracts are encoded and usable

- Repository architecture is consistently classified as `modular-monolith`.
- Command authority and AI operating order are explicitly represented in `ai-context`.
- Canonical deterministic remediation flow is explicit in `ai-contract`: `verify -> plan -> apply -> verify`.

### 2) Repository intelligence is healthy and coherent

- Index generation succeeded and produced `.playbook/repo-index.json` and `.playbook/repo-graph.json`.
- Four modules are indexed and dependency structure is coherent:
  - `@fawxzzy/playbook`
  - `@zachariahredfield/playbook-core`
  - `@zachariahredfield/playbook-engine`
  - `@zachariahredfield/playbook-node`
- Docs coverage reports all indexed modules as documented.

### 3) Governance checks pass, but documentation hygiene emits warnings

- `verify` passed with one warning (`playbook.config.json` absent; defaults used).
- `docs audit` reported warning-only findings:
  - planning-language leakage in non-approved planning surfaces,
  - backlog archive guidance gap,
  - historical cleanup/migration tracker candidate.
- `doctor` additionally recommends `.playbookignore` for artifact hygiene in a large repository.

### 4) Risk posture is low, but module ownership metadata is unassigned

- Module risk signals are low for sampled modules.
- Rule ownership exists for governance/docs/quality rules.
- Module ownership query reports empty owners and `unassigned` area for all modules.

### 5) `ask --repo-context` has answerability gaps

Even after indexing, several governance/workflow questions returned “cannot answer yet,” indicating an opportunity to improve deterministic question handling when answers exist in `ai-context`/`ai-contract` outputs.

### 6) `explain` target parsing inconsistency

- `explain @fawxzzy/playbook --json` resolves as `type: module`.
- `explain module:@fawxzzy/playbook --json` does not resolve equivalently.

## Prioritized Top 3 Improvements

1. **Assign module ownership metadata**
   - Populate module owners so `query module-owners` returns actionable ownership.
   - Benefit: better routing for remediation and review accountability.

2. **Improve `ask --repo-context` deterministic answerability**
   - Add targeted handling for AI ladder, remediation workflow, and governance placement questions.
   - Benefit: better agent bootstrap reliability and less fallback churn.

3. **Normalize `explain` target parsing for module-qualified inputs**
   - Accept `module:<name>` and `<name>` forms consistently.
   - Benefit: more predictable CLI contracts and easier automation.

## Commands Executed (Research Trace)

- `pnpm -r build`
- `node packages/cli/dist/main.js ai-context --json`
- `node packages/cli/dist/main.js ai-contract --json`
- `node packages/cli/dist/main.js context --json`
- `node packages/cli/dist/main.js index --json`
- `node packages/cli/dist/main.js query modules --json`
- `node packages/cli/dist/main.js query architecture --json`
- `node packages/cli/dist/main.js query dependencies --json`
- `node packages/cli/dist/main.js rules --json`
- `node packages/cli/dist/main.js explain architecture --json`
- `node packages/cli/dist/main.js explain @fawxzzy/playbook --json`
- `node packages/cli/dist/main.js ask "What is the preferred AI operating ladder in this repository?" --repo-context --json`
- `node packages/cli/dist/main.js ask "What is the canonical deterministic remediation workflow?" --repo-context --json`
- `node packages/cli/dist/main.js ask "Where should new command-surface validation requirements be documented?" --repo-context --json`
- `node packages/cli/dist/main.js verify --json`
- `node packages/cli/dist/main.js docs audit --json`
- `node packages/cli/dist/main.js status --json`
- `node packages/cli/dist/main.js doctor --dry-run --json`
- `node packages/cli/dist/main.js schema query --json`
- `node packages/cli/dist/main.js query docs-coverage --json`
- `node packages/cli/dist/main.js query rule-owners --json`
- `node packages/cli/dist/main.js query module-owners --json`
- `node packages/cli/dist/main.js query risk @fawxzzy/playbook --json`
- `node packages/cli/dist/main.js query risk @zachariahredfield/playbook-core --json`
- `node packages/cli/dist/main.js query impact @fawxzzy/playbook --json`
- `node packages/cli/dist/main.js analyze-pr --json`
