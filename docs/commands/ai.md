# `playbook ai`

Proposal-only AI command surface.

## Subcommands

### `pnpm playbook ai propose --json`

Builds a deterministic proposal artifact from governed context and contract surfaces without mutation authority.

Allowed baseline inputs:

- `.playbook/ai-context.json` (or deterministic generated context fallback)
- `.playbook/ai-contract.json` (or deterministic generated contract fallback)
- `.playbook/repo-index.json`

Optional inputs when explicitly requested:

- `--include plan` -> `.playbook/plan.json`
- `--include review` -> `.playbook/pr-review.json`
- `--include rendezvous` -> `.playbook/rendezvous-manifest.json`
- `--include interop` -> `.playbook/lifeline-interop-runtime.json`

## Durable machine output

```bash
pnpm playbook ai propose --json --out .playbook/ai-proposal.json
```

The proposal artifact includes:

- proposal id
- proposal-only scope + non-mutation boundaries
- reasoning summary
- recommended next governed surface
- suggested artifact path
- blockers/assumptions
- confidence score
- provenance over source artifacts

## Governance rules

- Rule: AI must remain a proposal-only layer within deterministic systems.
- Pattern: AI -> proposal artifact -> route/plan/review -> apply -> verify.
- Failure Mode: Allowing AI to mutate state directly collapses auditability and reproducibility.
