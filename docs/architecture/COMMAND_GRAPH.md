# Playbook CLI Command Dependency Graph

This document describes command-to-command and artifact dependencies in the Playbook CLI.

## Graph legend

- **Solid arrow (`A --> B`)**: command/data dependency (B requires artifact or state from A).
- **Dashed arrow (`A -.-> B`)**: soft dependency (B can run standalone but improves with A).
- **Artifact nodes**: deterministic files in `.playbook/` or docs outputs.

## Command + artifact graph

```mermaid
graph TD
  A[index] --> I[.playbook/repo-index.json]
  A --> G[.playbook/repo-graph.json]
  A --> M[.playbook/context/modules/*.md]

  I --> Q[query]
  I --> D[deps]
  I --> E[explain]
  I --> K[ask --repo-context]
  G --> R[graph]

  V[verify] --> F[findings JSON via --out]
  V --> RUN[.playbook/runs/*.json]

  F --> P[plan]
  V -.-> P
  P --> PLN[plan JSON via --out]
  P --> RUN

  PLN --> AP[apply --from-plan]
  P -.-> AP
  AP --> RUN
  AP --> SESS[.playbook/session.json]

  V --> DOC[doctor]
  A --> DOC
  DA[docs audit] --> DOC
  AA[audit architecture] --> DOC

  PR[analyze-pr] --> PRR[PR intelligence output]

  ORC[orchestrate] --> ORCA[.playbook/orchestrator/*]

  LE[learn draft] --> CAND[.playbook/knowledge/candidates.json]
  CAND --> MEM[memory promote/replay/prune]
  MEM --> KNOW[.playbook/knowledge/*.json]

  PAT[patterns promote] --> PRO[.playbook/patterns/promoted.json]

  PILOT[pilot] --> CTX[context]
  PILOT --> A
  PILOT --> Q
  PILOT --> V
  PILOT --> P
```

## Canonical remediation chain

`verify -> plan -> apply -> verify` remains the deterministic remediation backbone.

## High-value dependency notes

1. **Repository intelligence lane**: `index` is a hard prerequisite for `query`, `deps`, and strongly recommended before `ask --repo-context` / `explain`.
2. **Remediation lane**: `plan` can generate from live verify state, but reproducibility is strongest when it consumes a saved verify artifact and then feeds `apply --from-plan`.
3. **Execution evidence lane**: `verify`, `plan`, and `apply` all append run/session evidence, creating an implicit control-plane substrate consumed by session workflows.
4. **Meta-orchestration lane**: `pilot` is a composite command wrapper over `context/index/query/verify/plan`.
