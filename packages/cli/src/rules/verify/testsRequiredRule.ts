import type { VerifyRule } from '../../lib/loadVerifyRules.js';

export const testsRequiredRule: VerifyRule = {
  id: 'verify.rule.tests.required',
  description: 'Require tests when adding CLI commands or verify rules.',
  check: ({ failure }) => failure.id === 'verify.rule.tests.required',
  policy: {
    id: 'verify.rule.tests.required',
    description: 'Require tests for new commands and verify rules.'
  },
  explanation:
    'Every new CLI command and verify rule must include tests to protect command behavior and rule execution from regressions.',
  remediation: [
    'Add a matching command test at packages/cli/src/commands/<command>.test.ts.',
    'Add a matching verify rule test at packages/engine/test/<rule>.test.ts for new verify rules.'
  ]
};
