# Architecture Diagram Generation

Playbook can generate deterministic Mermaid diagrams to summarize repository structure and internal package dependencies.

## What gets generated

- **Structure diagram**: top-level folders (`apps`, `packages`, `tools`, `src` by default) and workspace/package nodes with containment edges.
- **Dependency diagram**: workspace/package nodes with internal dependency edges.

## Data sources

1. Workspace dependency manifests (`package.json` dependencies/devDependencies/peerDependencies).
2. Fallback import scanning for TS/JS files when manifest edges are absent.

No network calls are used.

## Determinism and limits

- Nodes are sorted lexicographically.
- Edges are sorted lexicographically.
- Output includes no timestamps.
- Default caps: `maxNodes=60`, `maxEdges=120`.
- If caps are exceeded, overflow is collapsed and warnings are emitted in the generation footer.

## Usage
<!-- docs-merge:canonical-heading -->
> **Docs merge note:** Canonical section lives at [Usage](concepts/docs-merge.md#usage).


```bash
# Internal repo CI/local (after building workspace)
pnpm -r build
pnpm playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md

# Consumer-installed usage
pnpm playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md
```

By default both diagrams are generated. You can scope output with `--structure` or `--deps`.

## AI agent recommendation

Before structural edits:

1. Generate diagrams.
2. Orient on boundaries and internal dependency direction.
3. Keep diagrams updated in the same PR when architecture changes.
