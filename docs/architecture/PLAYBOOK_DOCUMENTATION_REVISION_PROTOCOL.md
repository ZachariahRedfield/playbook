# Playbook Documentation Revision Protocol

## Purpose

This protocol defines how high-value Playbook docs are revised without blurring provenance.

It separates every substantial revision into three layers:

1. **Fact** — what was observed or executed.
2. **Interpretation** — what the facts imply.
3. **Narrative** — how we present the story for operator understanding.

Rule: Documentation updates must preserve the difference between observed fact, interpretation, and narrative framing.
Pattern: Revise meaning without rewriting provenance.
Failure Mode: High-value docs that blend fact and interpretation silently mutate doctrine.

## Layer contract

### 1) Fact layer (evidence)

What it contains:
- command results, artifacts, timestamps, repository changes, incident chronology
- links/paths to source artifacts (`.playbook/*`, CI logs, receipts, PR references)

When it may change:
- only when evidence was wrong, incomplete, or superseded by newly verified evidence
- never to make a story cleaner

Required evidence/review:
- direct artifact or command evidence must be cited in the revision notes/PR
- at least one reviewer confirms provenance is preserved

### 2) Interpretation layer (meaning)

What it contains:
- explanation of why an event happened
- inferred root causes, risk framing, and lessons

When it may change:
- when new evidence changes prior conclusions
- when prior interpretation is shown to be incomplete or invalid

Required evidence/review:
- must reference the supporting fact entries it depends on
- reviewer validates that interpretation updates do not alter fact history

### 3) Narrative layer (communication)

What it contains:
- ordering, emphasis, and wording for readability
- audience framing (operator, maintainer, roadmap reader)

When it may change:
- any time clarity can improve
- without changing factual provenance or interpreted meaning

Required evidence/review:
- no additional artifact evidence needed for wording-only edits
- reviewer confirms narrative edits do not introduce new claims

## Revision gate for high-value docs

Apply this gate to roadmap, workflow, architecture doctrine, and command-governance docs:

1. Mark each changed statement as Fact, Interpretation, or Narrative.
2. If Fact changed, include evidence source(s).
3. If Interpretation changed, link to the underlying Fact entries.
4. If Narrative changed, confirm “presentation-only” in the PR summary.

Docs-audit enforcement scope (path-scoped, opt-in):

- `docs/postmortems/*.md`
- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`
- `docs/PLAYBOOK_DEV_WORKFLOW.md`

For governed docs under this gate, include explicit `## Fact`, `## Interpretation`, and `## Narrative` sections so revision layers are machine-auditable where doctrine value is highest.

## Compact example (same incident across layers)

Incident: CI remediation loop stopped after one bounded autofix attempt.

- **Fact**
  - `pnpm playbook test-autofix --input .playbook/ci-failure.log --json` returned `finalStatus: blocked_repeat_signature`.
  - `.playbook/test-autofix-history.json` recorded one failed prior attempt for the same signature.

- **Interpretation**
  - Repeat-policy gating worked as intended: it prevented replaying a known-bad repair and escalated to review.

- **Narrative**
  - “Playbook chose safety over churn by stopping after evidence showed the same repair path already failed.”

## Non-goals

- This protocol does not add a new command family.
- This protocol does not replace existing verify/plan/apply governance.
- This protocol does not auto-promote doctrine changes.
