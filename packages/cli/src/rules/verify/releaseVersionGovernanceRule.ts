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
    'Release-relevant diffs must carry matching package-version and changelog updates; generated release-plan artifacts are runtime aids, not committed source of truth.',
  remediation: [
    'Run `pnpm playbook release sync --check` to detect version/changelog mismatches and review actionable tasks.',
    'Run `pnpm playbook release sync` to materialize reviewed version/changelog updates through the canonical apply boundary.',
    'Rerun `pnpm playbook verify --json` after release sync reports aligned version/changelog state.'
  ]
};
