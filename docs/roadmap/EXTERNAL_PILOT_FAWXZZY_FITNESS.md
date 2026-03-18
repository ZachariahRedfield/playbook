# External Pilot Migration Plan — Fawxzzy Fitness

## Pilot target

- Repository: `https://github.com/ZachariahRedfield/fawxzzy-fitness`
- Pilot role: **Primary external pilot target** for validating Playbook as an external deterministic runtime.

## Why this is the primary external pilot

Fawxzzy Fitness is the strongest near-term external proving ground because it already has real-world governance/runtime behavior and a substantial legacy Playbook surface in active repository structure and scripts.

This makes it ideal for validating compatibility-first migration behavior rather than synthetic migration assumptions.

## Coexistence-first migration policy

This pilot follows a coexistence-first strategy:

- Legacy Playbook surfaces in the target repo remain intact during phase-1 execution.
- New Playbook runs externally against the target repo.
- New Playbook writes runtime artifacts to `.playbook/` in the target repo.
- **No destructive cleanup occurs in phase 1.**

Rule — Migrate by Parity, Not Assumption
When replacing an older governance/runtime layer in a real repo, do not remove it until the replacement has proven equal or better coverage on the actual workflow.

Pattern — Coexistence-First External Pilot
For external pilot repos with existing tooling, run the new system alongside the old one first, collect capability mapping, then remove legacy surfaces in controlled slices.

Failure Mode — Premature Tooling Removal
Deleting legacy scripts before mapping real usage causes invisible workflow breakage and destroys migration confidence.

Failure Mode — Pilot Contamination
If the new Playbook starts by rewriting or deleting the old system, the pilot no longer measures external compatibility; it measures forced conversion.

## Deterministic legacy-surface inventory categories

Use the following deterministic categories while mapping every legacy surface:

- `KEEP_TEMPORARILY`
- `REPLACE_WITH_NEW_PLAYBOOK`
- `INVESTIGATE_USAGE`
- `REMOVE_AFTER_PARITY`

### Inventory mapping template

| Surface Type | Surface Identifier | Current Behavior | Observed Real Usage | Category | Replacement Command/Flow | Removal Preconditions | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `package.json script` | `playbook:update` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `package.json script` | `playbook:guardian` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `package.json script` | `playbook:auto` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `package.json script` | `playbook:doctor` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `package.json script` | `playbook:install` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `package.json script` | `playbook:status` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `package.json script` | `playbook:promote` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `package.json script` | `playbook:contracts` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `scripts/playbook/*` | `scripts/playbook/...` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `Playbook/tools/*` | `Playbook/tools/...` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |
| `docs/workflow reference` | `docs/...` | _fill_ | _fill_ | `INVESTIGATE_USAGE` | _fill_ | _fill_ | _fill_ |

## Migration phases

### Phase A — Coexistence

- Old Playbook layer remains intact in the external pilot repo.
- New Playbook runs externally against the repo.
- New Playbook writes artifacts to `.playbook/`.
- No legacy deletion.

### Phase B — Capability Mapping

- Inventory all legacy scripts/paths and docs references.
- Determine real usage frequency and workflow criticality.
- Map each surface to keep/replace/investigate/remove categories.

### Phase C — Parity Validation

- Run real operator workflows against Fawxzzy Fitness.
- Confirm new Playbook covers required governance/runtime behaviors.
- Capture evidence for replacement decisions.

### Phase D — Controlled Removal

- Remove only legacy surfaces proven redundant after parity.
- Update scripts/docs in the same PR as each removal.
- Verify no workflow regressions before merge.

## Pilot execution runbook (current command truth)

This command is the canonical execution contract for the pilot:

```bash
pnpm playbook pilot --repo ../fawxzzy-fitness
```

Implementation note:

- `playbook pilot --repo <path>` is the canonical top-level surface for first external baseline analysis.
- If the target repository is not present locally, treat the command list as runbook contract and execute when the pilot workspace is mounted.


## Pilot retrospective doctrine and next priorities

The first external pilot is now considered product-defining evidence rather than a one-off validation run.

Key retrospective findings:

- Playbook is operational in a real external repo.
- Governance materially improved the pilot by clarifying what was authoritative and what remained incomplete.
- Product improvements were real, but the biggest remaining gaps are now concentrated in external bootstrap, runtime health, improvement prioritization, doctrine extraction, and human interpretation of dense truth.

Priority direction exposed by the pilot:

1. external consumer bootstrap proof
2. environment/runtime health diagnostics
3. next-best-improvement analysis
4. post-merge doctrine extraction

Doctrine promoted from the pilot:

- stabilize tooling surface before governed product work
- first governed improvements should target correctness/performance seams with repeated logic and clear invariants
- shared aggregation boundary for reads, targeted invalidation boundary for writes
- mutation path -> affected canonical IDs -> centralized recompute
- tooling migration incomplete until runtime + governance bootstrap proof passes
