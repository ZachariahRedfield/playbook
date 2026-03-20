# `pnpm playbook test-fix-plan`

Build deterministic test-only fix planning from a prior `test-triage` artifact.

## Usage

```bash
pnpm playbook test-fix-plan --from-triage .playbook/test-triage.json
pnpm playbook test-fix-plan --from-triage .playbook/test-triage.json --out .playbook/test-fix-plan.json --json
pnpm playbook schema test-fix-plan --json
```

## What it does

`test-fix-plan` is the command-surface seam between diagnosis and repair planning.

- It requires a prior `test-triage` artifact.
- It accepts only `autofix_plan_only` findings into the plan artifact.
- It rejects `review_required` findings instead of proposing hidden production edits.
- It always writes a stable artifact, defaulting to `.playbook/test-fix-plan.json`.

## Output contract

`pnpm playbook test-fix-plan --from-triage <artifact> --json` returns a stable artifact with:

- `status`: `ready` when every finding is low risk, otherwise `rejected`
- `actions`: deterministic low-risk test-only repair actions
- `blocked_findings`: risky findings that must remain review-gated
- `verification_commands`: reruns carried forward from accepted findings
- `governance`: embedded Rule / Pattern / Failure Mode context for operator trust

Use `pnpm playbook schema test-fix-plan --json` to inspect the machine-readable schema.

## Governance boundary

- Rule: every canonical command must have one stable artifact contract and one authoritative operator doc.
- Pattern: add remediation commands as artifact-producing seams before orchestration wrappers.
- Failure Mode: hidden CLI-only behavior without contract/docs coverage drifts faster than engine truth.
