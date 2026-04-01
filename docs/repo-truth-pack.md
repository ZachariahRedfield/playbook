# Repo Truth Pack Standard (Subapps)

## Objective
Create a lightweight, committed source-of-truth surface for subapps that Playbook can ingest without duplicating generated `.playbook/*` runtime artifacts.

## Why this exists
- **Rule:** Important project truth must live in the repo, not only in chat.
- **Pattern:** Lightweight structured context beats scattered undocumented state.
- **Failure Mode:** Chat-only context creates drift, loss of continuity, and weak retrieval.

## Standard truth-pack layout
Each subapp should commit a minimal truth pack rooted at the subapp directory.

```text
<subapp-root>/
  playbook/context.json
  docs/architecture.md
  docs/roadmap.md
  docs/adr/
  playbook/app-integration.json   # required when integrated
  playbook/runtime-manifest.json  # required when integrated
```

## `playbook/context.json` required fields
The validator requires these fields:
- `repo_id`
- `repo_name`
- `mission`
- `current_phase`
- `current_focus`
- `invariants`
- `dependencies`
- `integration_surfaces`
- `next_milestones`
- `open_questions`
- `last_verified_timestamp`

## Update cadence
Refresh the truth pack whenever one of these happens:
- milestone boundary
- architecture change
- phase change
- new integration surface

## Validation
`pnpm playbook docs audit --json` now validates subapp truth packs under:
- `subapps/*`
- `examples/subapps/*`

Validation includes:
- required files and `docs/adr/` directory presence
- required context fields in `playbook/context.json`
- JSON validity for optional `playbook/app-integration.json` when present
- required `playbook/runtime-manifest.json` for integrated subapps
- required runtime manifest fields:
  - `app_identity`
  - `runtime_role`
  - `runtime_status`
  - `signal_groups`
  - `state_snapshot_types`
  - `bounded_action_families`
  - `receipt_families`
  - `integration_seams`
- Fitness-aligned integrated subapps must set `external_truth_contract_ref` in `playbook/runtime-manifest.json`
- consumed aggregate artifact at `.playbook/runtime-manifests.json` (read-only control-plane surface, sourced from subapp manifests)
- non-integrated subapps remain unaffected by runtime manifest requirements


## `playbook/runtime-manifest.json` (integrated subapps)
Integrated subapps must commit one runtime manifest that acts as deterministic repo-local runtime truth for:
- signal groups
- state snapshot types
- bounded action families
- receipt families
- integration seams

Rule:
- Integrated apps must expose one committed runtime manifest as repo-local truth that Playbook consumes into `.playbook/runtime-manifests.json`.

Pattern:
- Repo Truth Pack -> runtime manifest -> consumed control-plane context.

Failure Mode:
- A runtime manifest that is only validated, never consumed, becomes governance theater instead of a real seam.

## External truth contract boundary (Fitness)

When a subapp integration depends on the Fitness contract, treat that contract as the
authoritative external truth source.

Boundary rules:
- This repository **consumes** the Fitness contract; it does not redefine or fork the contract.
- Playbook adapter surfaces (for example `pnpm playbook interop fitness-contract`) must be
  derived from the Fitness contract boundary and stay schema-compatible with the upstream contract.
- Fitness-aligned `playbook/runtime-manifest.json` files must reference that consumed boundary via
  `external_truth_contract_ref` and must not duplicate/reinterpret Fitness action or receipt semantics.
- If direct contract import is unavailable in a given environment, local mirror artifacts must be
  exact mirrors of the external contract (field names, types, and semantics), not interpretation layers.

Recommended `playbook/app-integration.json` annotation (optional but preferred for explicitness):

```json
{
  "integration_id": "playbook-proving-ground-app",
  "status": "integrated",
  "surfaces": ["repo-truth-pack-ingest-v1", "fitness-contract-consumer-v1"],
  "external_truth": {
    "source": "fitness-contract",
    "mode": "consume",
    "adapter": "playbook-interop-fitness-contract",
    "mirror_policy": "must-match-exactly-when-direct-import-unavailable"
  }
}
```

## Templates and example
- Template: `templates/repo/subapps/_truth-pack-template/`
- Example: `subapps/proving-ground-app/`
