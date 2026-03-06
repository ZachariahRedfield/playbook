import type { VerifyRule } from '../../lib/loadVerifyRules.js';

export const requireNotesOnChangesRule: VerifyRule = {
  id: 'requireNotesOnChanges',
  description: 'Require notes updates whenever source files change.',
  check: ({ failure }) => failure.id === 'requireNotesOnChanges',
  policy: {
    id: 'requireNotesOnChanges',
    description: 'Require notes updates for configured source changes.'
  },
  explanation:
    'When source code changes, the notes log ensures architectural intent and delivery context are captured with the implementation.',
  remediation: [
    'Update docs/PLAYBOOK_NOTES.md with a note that covers the changed code paths.',
    'Include both WHAT changed and WHY it changed.'
  ]
};
