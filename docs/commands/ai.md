# `playbook ai`

Proposal-only AI command surface.

## Subcommands

### `pnpm playbook ai propose --json`

Builds a deterministic proposal artifact from governed context and contract surfaces without mutation authority.

Allowed baseline inputs:

- `.playbook/ai-context.json` (or deterministic generated context fallback)
- `.playbook/ai-contract.json` (or deterministic generated contract fallback)
- `.playbook/repo-index.json`
- `.playbook/runtime-manifests.json` consumed through `ai-context` / `context` when present (read-only, additive)

Optional inputs when explicitly requested:

- `--include plan` -> `.playbook/plan.json`
- `--include review` -> `.playbook/pr-review.json`
- `--include rendezvous` -> `.playbook/rendezvous-manifest.json`
- `--include interop` -> `.playbook/lifeline-interop-runtime.json`

Target profiles:

- default (`--target general`): repository/governance proposal-only output
- `--target fitness`: proposal-only bounded Fitness request suggestion validated against canonical Fitness contract mirror

## Durable machine output

```bash
pnpm playbook ai propose --json --out .playbook/ai-proposal.json
```

The proposal artifact includes:

- proposal id
- proposal-only scope + non-mutation boundaries
- reasoning summary
- recommended next governed surface
- optional `fitnessRequestSuggestion` only when `--target fitness` is requested
- suggested artifact path
- blockers/assumptions
- confidence score
- provenance over source artifacts

## Governance rules

- Rule: AI must remain a proposal-only layer within deterministic systems.
- Rule: AI may interpret canonical external contracts, but may not widen or execute them directly.
- Rule: AI proposals may be compiled into bounded interop request drafts, but may not execute interop requests directly.
- Failure Mode: Operators manually re-translating proposal artifacts into execution requests recreate hidden session state and reduce auditability.
- Pattern: AI context -> proposal artifact -> interop request draft -> explicit interop emit -> receipt -> updated truth.
- Pattern: AI -> proposal artifact -> route/plan/review -> apply -> verify.
- Failure Mode: Allowing AI to mutate state directly collapses auditability and reproducibility.
- Failure Mode: Letting AI skip from interpretation to execution collapses the request/receipt boundary and makes the Fitness seam untrustworthy.
