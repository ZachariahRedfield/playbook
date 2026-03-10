# Policy Model

Playbook policy is intentionally simple: a small vocabulary with deterministic outcomes.

## Contract

A stable expectation for how a repo is governed.

**Example:** "Changes under `src/**` must include a notes update."

## Guardrail

A practical enforcement that prevents drift from a contract.

**Example:** `pnpm playbook verify` fails when code changed but `docs/PLAYBOOK_NOTES.md` was not touched.

## Pattern

A reusable way to apply governance repeatedly.

**Example:** "For any service repo, keep architecture docs and change notes current."

## Decision

A documented choice that explains why a rule or architecture direction exists.

**Example:** "Use notes-on-change as the default rule for traceability."

## Failure Mode

A known way governance can break down.

**Example:** Teams merge implementation changes without recording intent, causing lost context for future humans and agents.
