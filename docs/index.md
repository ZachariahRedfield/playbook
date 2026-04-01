# Playbook Documentation

Playbook is the deterministic repo runtime and trust layer between humans/AI agents and real repositories: deterministic intelligence, governance checks, and reviewed remediation loops.

Playbook is not a general-purpose chat assistant. It is a contract-first runtime for operating safely against production repositories.

## Canonical operating ladder

`ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify -> plan -> apply -> verify`

## Start here (truth boundaries first)

- **Live command truth (operator source):** [Command status index](./commands/README.md)
- **Future intent and sequencing:** [Product roadmap](./PLAYBOOK_PRODUCT_ROADMAP.md)
- **Current architecture and runtime boundaries:** [Architecture](./ARCHITECTURE.md)
- **Machine-readable roadmap commitments:** [Roadmap contract (`ROADMAP.json`)](./roadmap/ROADMAP.json)
- **Unscheduled ideas:** [Improvements backlog](./roadmap/IMPROVEMENTS_BACKLOG.md)

## Core references

- [Repository README](../README.md)
- [AI operating contract](../AGENTS.md)
- [FAQ](./FAQ.md)
- [Onboarding demo](./ONBOARDING_DEMO.md)
- [Consumer integration contract](./CONSUMER_INTEGRATION_CONTRACT.md)

## Research highlights

### Cognitive Dynamics Framework v0.1

Short summary: a doctrine-level model for how repository signals become compressed, stabilized, and recalibrated under governance without replacing deterministic command truth.

- Framework spec: [Cognitive Dynamics Framework v0.1](./research/COGNITIVE_DYNAMICS_FRAMEWORK_V0_1.md)

## Historical/transitional docs

- Archived docs index: [docs/archive/README.md](./archive/README.md)
- Archived roadmap snapshots: [docs/archive/roadmap/](./archive/roadmap/)

Rule: canonical operator truth should live in one clearly identified surface, not overlapping docs.
