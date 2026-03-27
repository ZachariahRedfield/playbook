# Proving Ground App Architecture

## System boundary
The proving-ground app owns contract validation experiments for repository truth ingestion and does not own Playbook core runtime behavior.

## Runtime shape
A lightweight service reads committed truth-pack files and emits normalized snapshots for Playbook indexing tests.

## Integration surfaces
- `playbook/context.json` parser
- `playbook/app-integration.json` parser
- playbook CLI test fixtures

## Invariants
- Committed truth-pack artifacts remain human-readable Markdown/JSON.
- Runtime snapshots are derived artifacts and must not replace committed truth files.
