# Context Efficiency Strategy

Performance and token efficiency must guide architecture decisions as Playbook grows.

## Goal

Deliver high-signal repository intelligence with bounded runtime and bounded context size for humans, CI, and AI agents.

## Strategy pillars

1. **Index once, query many**
   - Build deterministic artifacts with `pnpm playbook index`.
   - Prefer `query`/`deps`/`explain`/`ask --repo-context` over repeated broad scans.

2. **Narrow context first**
   - Favor module-scoped and diff-scoped flows (`query impact <module>`, `ask --module`, `ask --diff-context`).
   - Return concise deterministic fields before verbose narrative output.

3. **Deterministic caching and artifact reuse**
   - Reuse `.playbook/repo-index.json` and `.playbook/repo-graph.json` across command workflows.
   - Treat regeneration as explicit, observable workflow step.

4. **Incremental architecture direction**
   - Prefer additive intelligence improvements over expensive full-recompute heuristics.
   - Keep graph/index enrichments low-cost and derivable from trusted metadata.

## Efficiency guardrails

- no hidden network dependency for core intelligence commands
- stable JSON output contracts to avoid repeated retry/parsing cost
- explicit stale/missing artifact guidance to prevent broad fallback scans
- command options for concise output modes where supported

## Observability targets

Track and regression-test:

- index generation time on representative repositories
- query/explain/ask response payload size bands
- command latency for diff-scoped vs full-context flows
- contract stability under additive schema evolution

