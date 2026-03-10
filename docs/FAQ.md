# Playbook FAQ

## What is Playbook?

Playbook is a deterministic repo runtime and trust layer for humans and AI agents. It provides deterministic repository intelligence, governance validation, and reviewed remediation loops for real repositories.

## Is Playbook a chat assistant?

No. Playbook is not a general-purpose chat assistant. It is the runtime between assistants and production codebases, with explicit contracts, deterministic findings, and policy-gated change loops.

## How should serious users start?

Use the canonical ladder:

`ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify -> plan -> apply -> verify`

This sequence starts with deterministic context and repository intelligence, then moves into validation and bounded remediation.

## Does `verify` modify my code?

No. `verify` is validation/governance. It checks repository state against deterministic rules and reports findings; it does not apply code changes.

## What do `plan` and `apply` do?

`plan` converts `verify` findings into deterministic, reviewable remediation tasks. `apply` executes bounded tasks from a generated plan artifact (for example `.playbook/plan.json`) so changes stay explicit and auditable.

## Is Playbook local/private-first?

Yes. Playbook is local/private-first by default. Repository observations and generated artifacts are intended to stay local unless a team intentionally commits or exports specific contract artifacts.

## Does Playbook require a specific framework?

No. Playbook is framework-agnostic and designed to work across repository types while enforcing deterministic governance and remediation workflows.

## What package should I install or use with `npx`?

Use the scoped package `@fawxzzy/playbook`.

- Install: `npm install -g @fawxzzy/playbook`
- Install-free: `pnpm playbook <command>`

Do not rely on unscoped `playbook` as an `npx` target.
