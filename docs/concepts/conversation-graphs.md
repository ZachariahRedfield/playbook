# Conversation Graphs for AI-Assisted Engineering

Modern AI-assisted engineering workflows frequently run in parallel reasoning threads: one thread may handle CI debugging, another CLI UX design, and another architecture review. Traditional linear chat logs make this difficult to govern over time because they often introduce:

- context drift
- buried decisions
- fragmented reasoning across chats

Playbook introduces a structured **conversation graph model** that captures engineering reasoning in a deterministic, reusable format for agents and tooling.

## Graph model

Playbook models a development session as a Directed Acyclic Graph (DAG):

```text
Main Session
  ├── Branch: CI Debugging
  ├── Branch: CLI UX Design
  └── Branch: Architecture Review
```

Branches can later be merged back into a shared reasoning path.

Core properties:

- nodes represent reasoning checkpoints
- edges represent exploration paths
- merges reconcile decisions and constraints

This model keeps reasoning auditable while preserving the speed of parallel exploration.

## Session snapshot schema

A session snapshot is the canonical representation of reasoning state. It is deterministic and machine-readable, and it should be treated as the source of truth instead of raw chat transcripts.

```json
{
  "sessionId": "playbook-session-001",
  "checkpoint": "phase2-cli-design",
  "timestamp": "2026-03-05T00:00:00Z",
  "decisions": [
    {
      "id": "cli-tsc-build",
      "decision": "CLI builds using tsc instead of bundler",
      "rationale": "Avoid optional native module issues in CI",
      "alternatives": ["rollup", "esbuild"]
    }
  ],
  "constraints": [
    "CLI must run offline",
    "CLI must run inside CI",
    "Cloud must never be required"
  ],
  "openQuestions": [
    "How should Playbook publish GitHub Actions?",
    "Should CLI commands be namespaced?"
  ],
  "artifacts": [
    "docs/PLAYBOOK_PRODUCT_ROADMAP.md",
    "packages/cli/src/main.ts"
  ],
  "nextSteps": [
    "Implement demo repo",
    "Finalize npm distribution"
  ]
}
```

## Branching

Exploration can branch from any checkpoint.

Example:

```bash
playbook session branch ci-debug
```

This creates a new reasoning path while inheriting the previous snapshot.

Branches allow:

- isolated experimentation
- architectural alternatives
- debugging investigations

without polluting the main reasoning path.

## Merging

Playbook supports deterministic merges of reasoning branches.

Example command:

```bash
playbook session merge ci-debug cli-design
```

The merge operation:

- combines decisions
- merges artifacts
- reconciles constraints
- surfaces conflicts

Example merge report:

```json
{
  "merged": true,
  "conflicts": [
    {
      "type": "decision",
      "ours": "pnpm workspace",
      "theirs": "npm workspace"
    }
  ]
}
```

Playbook must always produce deterministic merge reports so agents and reviewers can rely on stable outcomes.

## Agent-facing workflows

Playbook is designed for AI coding agents and mixed human-agent teams.

Agents can:

- export session summaries
- checkpoint reasoning
- merge parallel explorations
- generate Playbook notes automatically

This ensures engineering knowledge remains captured even when work happens across multiple chats, branches, or agents.

## Relationship to Knowledge Engine

Conversation graphs feed directly into Playbook's knowledge lifecycle:

Playbook Notes  
↓  
Proposed Doctrine  
↓  
Promoted Doctrine

This defines a governance path from structured reasoning to durable engineering knowledge:

**structured reasoning → engineering knowledge**

## Future capabilities

Potential future features include:

- visual conversation graph explorer
- merge conflict resolution helpers
- cross-session knowledge linking
- automatic doctrine extraction
