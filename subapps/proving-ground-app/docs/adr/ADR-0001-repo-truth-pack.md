# ADR-0001: Use a lightweight committed repo truth pack for subapps

## Status
Accepted

## Context
Subapp context has drifted when knowledge lives only in chat transcripts or generated runtime artifacts.

## Decision
Adopt a lightweight committed truth pack (`playbook/context.json`, docs architecture/roadmap/adr, optional `playbook/app-integration.json`) as the source-of-truth surface for subapps.

## Consequences
- Improves continuity and machine ingestion reliability.
- Requires disciplined updates at milestone/architecture/phase/integration boundaries.
