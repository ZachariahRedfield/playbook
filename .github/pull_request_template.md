## Roadmap linkage

- Feature ID(s): <!-- e.g. PB-V04-PLAN-APPLY-001 -->
- Why this change belongs to those IDs:

## Command and contract impact

- Commands affected:
- JSON/schema/contract files updated:
- Snapshot updates (if output changed):

## Validation

- [ ] `pnpm -r build`
- [ ] `pnpm test`
- [ ] `node scripts/validate-roadmap-contract.mjs`
- [ ] `node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id` (feature-id gate: PR title -> PR body -> `.playbook/pr-metadata.json`)
- [ ] `.playbook/pr-metadata.json` updated with canonical featureIds/title/body snippet for repo-owned PR metadata truth
- [ ] Optional: `pnpm pr:sync-metadata` attempted (warn-only if token cannot edit PR metadata)
- [ ] `node packages/cli/dist/main.js docs audit --ci --json`
