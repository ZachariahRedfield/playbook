# What is Playbook?

Playbook is a governance layer that sits between AI coding agents and software repositories.

**AI → Playbook → Repo**

Instead of relying on implicit team norms, Playbook turns governance into deterministic checks that are explicit, reviewable, and CI-friendly.

## Deterministic governance

Playbook rules are written to be predictable and automatable:

- rules evaluate repository changes the same way locally and in CI
- failures include actionable evidence and clear fixes
- policy lives in versioned files, not hidden process knowledge

Playbook also includes deterministic repository analysis via `playbook analyze`, which detects common stack components (for example Next.js, Supabase, and Tailwind) using filesystem and dependency signals and can surface architecture suggestions in docs.

## What Playbook is not

Playbook is intentionally scoped. It is:

- not a linter
- not a code generator
- not an AI platform

It is a lightweight governance utility that helps teams keep code changes and engineering documentation aligned.
