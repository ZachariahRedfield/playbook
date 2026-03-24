# Lifeline exports

This directory is the stable, machine-readable export surface that Lifeline can consume directly from a local Playbook checkout.

## Contract

- `schema-version.json` defines the versioned export contract metadata for this export family.
- `archetypes/*.yml` contains explicit archetype defaults that Lifeline can merge with app manifests later.

## Consumption model

- Lifeline reads these files from disk from the same Playbook repository that also powers local Playbook UI and CLI workflows.
- The Playbook UI or any Playbook long-running process does **not** need to be running for Lifeline to use these files.
- The export surface is intentionally plain YAML/JSON so it stays readable, reviewable, and low-churn.

## Current archetypes

- `next-web.yml`
- `node-web.yml`

## Stability guidance

Treat this directory as an exported contract.
Prefer additive, versioned changes over implicit behavior or UI-only coupling.
