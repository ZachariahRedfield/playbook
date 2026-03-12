import type { MemoryEventInput } from '../../src/memory/types.js';

export const verifyMemoryEventFixture: MemoryEventInput = {
  kind: 'verify_run',
  sources: [
    { type: 'command', reference: 'verify' },
    { type: 'artifact', reference: '.playbook/findings.json' }
  ],
  subjectModules: ['packages/engine', 'packages/cli'],
  ruleIds: ['PB002', 'PB001'],
  riskSummary: {
    level: 'high',
    signals: ['rule:PB001', 'rule:PB002']
  },
  outcome: {
    status: 'failure',
    summary: 'verify produced findings',
    metrics: { failures: 2, warnings: 1 }
  },
  salienceInputs: {
    baseRef: 'main',
    baseSha: 'abc123',
    failureCount: 2,
    warningCount: 1
  }
};
