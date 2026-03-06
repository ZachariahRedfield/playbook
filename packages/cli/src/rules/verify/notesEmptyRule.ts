import type { VerifyRule } from '../../lib/loadVerifyRules.js';

export const notesEmptyRule: VerifyRule = {
  id: 'notes.empty',
  description: 'Require notes entries when docs/PLAYBOOK_NOTES.md exists.',
  check: ({ failure }) => failure.id === 'notes.empty',
  policy: {
    id: 'notes.empty',
    description: 'Require notes entries in docs/PLAYBOOK_NOTES.md.'
  },
  explanation:
    'An empty notes file does not preserve the reasoning behind recent changes, which weakens team knowledge sharing.',
  remediation: [
    'Add a notes entry, for example: ## YYYY-MM-DD — Summary.',
    'Describe what changed, why it changed, and any follow-up work.'
  ]
};
