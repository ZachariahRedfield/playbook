# Product Vision

Playbook turns repository governance into deterministic checks that both humans and AI agents can follow.

## Core flow: AI → Playbook → Repo

1. **AI (or developer) proposes a change**.
2. **Playbook evaluates the change** against explicit governance rules.
3. **The repo stays healthy** because architecture and notes discipline are enforced in CI and local workflows.

## What Playbook enforces today

Playbook currently provides:

- **Deterministic governance rules** through `verify` (for example, requiring notes updates when key code paths change).
- **Documentation discipline** through a standard docs baseline and config-driven doc paths.
- **Repository intelligence signals** through `analyze` detectors (currently Next.js, Supabase, Tailwind by default).

## What Playbook will enforce later (planned)

Roadmap direction includes:

- More rule types and policy packs.
- More analyzers/detectors for broader stacks.
- Organization-level playbooks shared across multiple repos.

These are planned capabilities, not all fully implemented today.

## Platform stance

Playbook as a product is **language-agnostic, agent-agnostic, and platform-agnostic**.

The current CLI implementation is **Node-based (for now)** so teams can adopt it quickly, while policy concepts remain independent of any single runtime.
