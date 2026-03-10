# Meta-Playbook Introspection

## Purpose

Meta-Playbook lets Playbook analyze its own artifact stream to produce system-level findings and improvement proposals.

The meta layer is observational and advisory only.

## Artifact scope

Meta analysis reads the deterministic lifecycle artifacts:

- run cycles
- graph snapshots
- graph groups
- candidate patterns
- promoted pattern cards
- promotion decisions
- contract history

Meta artifacts are emitted under:

- `.playbook/meta/meta-findings.json`
- `.playbook/meta/meta-patterns.json`
- `.playbook/meta/meta-telemetry.json`
- `.playbook/meta/proposals/*.json`

## System findings

Current findings cover:

- promotion latency
- rejection rate
- pattern reuse
- contract drift
- entropy trends
- duplication

These findings must reference source artifacts so reviewers can inspect the evidence path deterministically.

## Doctrine safety boundary

Rule:
Meta-Playbook may observe and propose improvements but cannot mutate doctrine automatically.

Pattern:
Self-analysis allows reasoning systems to optimize their own learning process.

Failure Mode:
Without introspection the system accumulates knowledge but never improves its reasoning behavior.

## Governance behavior

Meta findings may create improvement proposals under `.playbook/meta/proposals/`.

Those proposals are drafts and must flow through normal review and governance commands before any doctrine change can occur.

The meta layer never writes to pattern-card artifacts or contract artifacts directly.

## Minimal reasoning engine role

Meta introspection is one of the seven minimum layers in the minimal reasoning engine loop:

`observe -> atomize -> connect -> compress -> govern -> enforce -> reflect`

For the bounded Fawxzzy Fitness pilot, meta outputs should focus on:

- artifact quality and lineage completeness
- repeated failure motifs in verify/promotion flows
- bounded proposals for operator review queues

Meta introspection remains proposal-only in the pilot and must not perform automatic contract mutation or autonomous doctrine tuning.
