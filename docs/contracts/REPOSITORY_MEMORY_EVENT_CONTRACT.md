# Repository Memory Event Contract

## Purpose

Define the deterministic, repository-local event envelope for `.playbook/memory/events/*.json` and `.playbook/memory/index.json`.

This is an architecture/contract document only. No runtime behavior change is required by this contract introduction.

## Scope

This contract governs **episodic memory artifacts** only.

- In scope: time-ordered execution/review/governance events.
- Out of scope: structural graph semantics in `.playbook/repo-graph.json`.

Rule: `.playbook/repo-graph.json` remains structural and is not the temporal event store.

## Event envelope (planned)

Each event record should be schema-versioned and deterministic:

```json
{
  "schemaVersion": "1.0",
  "eventId": "mem_evt_<deterministic-id>",
  "eventType": "verify.completed",
  "recordedAt": "2026-03-12T00:00:00.000Z",
  "repo": {
    "root": ".",
    "branch": "feature/repository-memory-model"
  },
  "actor": {
    "kind": "human|agent|ci",
    "id": "optional-stable-actor-id"
  },
  "command": {
    "name": "verify",
    "args": ["--json"],
    "artifacts": [".playbook/findings.json"]
  },
  "provenance": {
    "sources": [".playbook/repo-index.json"],
    "relatedFindingIds": ["optional-finding-id"]
  },
  "outcome": {
    "status": "success|failure|partial",
    "summary": "deterministic concise summary"
  }
}
```

## Index contract (planned)

`.playbook/memory/index.json` should provide deterministic lookup metadata:

- ordered event pointers
- coarse event counts by type/status/time window
- references to candidate replay/consolidation artifacts

Pattern: Fast Episodic Store, Slow Doctrine Store.

## Safety rules

Rule: Replay Is Human-Review-Oriented, Not Autonomous Mutation.
Rule: Promotion Required for Durable Doctrine.

Event ingestion must not directly promote doctrine or mutate repository source content without existing policy/remediation gates.

## Failure modes

Failure Mode: Memory Hoarding.
Failure Mode: Rebuilding Durable Memory From Current Repo State Only.
