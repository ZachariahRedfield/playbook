import type { VerifyRule } from '../../lib/loadVerifyRules.js';

const RELEASE_VERSION_RULE_PREFIX = 'release.';

export const releaseVersionGovernanceRule: VerifyRule = {
  id: 'release.version-governance',
  description: 'Fail closed when release-relevant changes ship without coordinated version governance updates.',
  check: ({ failure }) => failure.id.startsWith(RELEASE_VERSION_RULE_PREFIX),
  policy: {
    id: 'release.version-governance',
    description: 'Require evidence-backed release/version governance updates for release-relevant changes.'
  },
  explanation:
    'Release-relevant diffs must carry the matching package-version and changelog governance updates so CI can enforce one canonical release gate instead of per-workflow heuristics.',
  remediation: [
    'Run `pnpm playbook release plan --json --out .playbook/release-plan.json` to generate the deterministic release artifact.',
    'Apply or mirror the approved version/changelog updates, then rerun `pnpm playbook verify --json`.'
  ]
};
