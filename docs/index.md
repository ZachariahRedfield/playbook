# Playbook Documentation

Playbook is the deterministic repo runtime and trust layer between humans/AI agents and real repositories: deterministic intelligence, governance checks, and reviewed remediation loops.

Playbook is not a general-purpose chat assistant. It is a contract-first runtime for operating safely against production repositories.

## Canonical operating ladder

`ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify -> plan -> apply -> verify`

## Start here

- [Repository README](../README.md)
- [AI operating contract](../AGENTS.md)
- [Architecture](./ARCHITECTURE.md)
- [Command inventory](./commands/README.md)
- [Product roadmap](./PLAYBOOK_PRODUCT_ROADMAP.md)
- [Repository memory system architecture](./architecture/REPOSITORY_MEMORY_SYSTEM_V1.md)
- [Structural graph + memory integration](./architecture/STRUCTURAL_GRAPH_AND_MEMORY_INTEGRATION_V1.md)
- [Control plane / agent runtime v1](./architecture/CONTROL_PLANE_AND_AGENT_RUNTIME_V1.md)
- [Business strategy](./PLAYBOOK_BUSINESS_STRATEGY.md)
- [Consumer integration contract](./CONSUMER_INTEGRATION_CONTRACT.md)
- [FAQ](./FAQ.md)
- [AI agent context](./AI_AGENT_CONTEXT.md)
- [Onboarding demo](./ONBOARDING_DEMO.md)
- [GitHub setup](./GITHUB_SETUP.md)

`docs/commands/README.md` is the authoritative command-state snapshot.
