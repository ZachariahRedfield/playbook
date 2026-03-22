import type { VerifyRule } from '../../lib/loadVerifyRules.js';

const PROTECTED_DOC_RULE_PREFIX = 'protected-doc.';

export const protectedDocGovernanceRule: VerifyRule = {
  id: 'protected-doc.governance',
  description: 'Fail closed when protected-doc consolidation is unresolved or drift-conflicted.',
  check: ({ failure }) => failure.id.startsWith(PROTECTED_DOC_RULE_PREFIX),
  policy: {
    id: 'protected-doc.governance',
    description: 'Require protected singleton-doc consolidation to be reviewed, conflict-free, and drift-free before merge.'
  },
  explanation:
    'Protected singleton docs remain a governed merge boundary. Verify must fail closed until reviewed consolidation exists, conflicts are resolved, and guarded apply shows no singleton-doc drift.',
  remediation: [
    'Create or refresh `.playbook/docs-consolidation-plan.json` from the reviewed consolidation artifacts.',
    'Resolve protected-doc conflicts or drift before retrying apply or merge.'
  ]
};
