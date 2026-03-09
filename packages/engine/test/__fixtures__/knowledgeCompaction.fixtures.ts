import { InternalCompactionCandidate, InternalCompactionPattern } from '../../src/knowledge/compaction.js';

export const existingPatternsFixture: InternalCompactionPattern[] = [
  {
    id: 'pattern-cli-local-build',
    title: 'Use local cli build for branch-accurate output',
    mechanism: 'Inside Playbook repo, use local built CLI entrypoints before validation.',
    invariant: 'branch accurate local cli behavior',
    response: 'Run pnpm -r build before local cli commands.',
    examples: ['node packages/cli/dist/main.js ai-context --json'],
    evidence: [
      {
        sourceType: 'docs',
        sourceRef: 'AGENTS.md',
        summary: 'Use local built CLI entrypoints so validation reflects the current branch.'
      }
    ]
  },
  {
    id: 'pattern-verify-loop',
    title: 'Use verify-plan-apply-verify loop',
    mechanism: 'Use deterministic remediation loop verify -> plan -> apply -> verify.',
    invariant: 'deterministic remediation sequencing',
    response: 'Run verify, then plan/apply, then verify again.',
    examples: ['playbook verify --json'],
    evidence: [
      {
        sourceType: 'docs',
        sourceRef: 'docs/architecture/KNOWLEDGE_COMPACTION_PHASE.md',
        summary: 'Compaction does not replace canonical remediation loop.'
      }
    ]
  }
];

export const discardCandidateFixture: InternalCompactionCandidate = {
  candidateRef: 'candidate-discard-empty-mechanism',
  title: 'Empty mechanism candidate',
  mechanism: '   '
};

export const attachCandidateFixture: InternalCompactionCandidate = {
  candidateRef: 'candidate-attach-cli-evidence',
  title: 'Use local cli build for branch-accurate output',
  mechanism: 'Inside playbook repo, use local built CLI entrypoints before validation',
  invariant: 'branch accurate local cli behavior',
  response: 'run pnpm -r build before local cli commands',
  examples: ['node packages/cli/dist/main.js ai-context --json'],
  evidence: [
    {
      sourceType: 'verify',
      sourceRef: '.playbook/verify.json',
      summary: 'A new finding confirms local build first prevented stale command output.'
    }
  ]
};

export const mergeCandidateFixture: InternalCompactionCandidate = {
  candidateRef: 'candidate-merge-cli-wording-variant',
  title: 'branch accurate cli bootstrap',
  mechanism: 'Inside Playbook repo use local built CLI entrypoints before validation!',
  invariant: 'branch accurate local cli behavior',
  response: 'Prefer local build entrypoints.',
  examples: ['node packages/cli/dist/main.js context --json'],
  evidence: [
    {
      sourceType: 'docs',
      sourceRef: 'docs/AI_AGENT_CONTEXT.md',
      summary: 'Local execution rule ensures branch-accurate validation.'
    }
  ]
};

export const addCandidateFixture: InternalCompactionCandidate = {
  candidateRef: 'candidate-add-docs-audit-pattern',
  title: 'Docs audit should be run for governance surface edits',
  mechanism: 'When docs or governance surfaces change, run docs audit to validate command and contract alignment.',
  invariant: 'docs governance edits require deterministic docs checks',
  response: 'Run node packages/cli/dist/main.js docs audit --json in validation set.',
  examples: ['node packages/cli/dist/main.js docs audit --json'],
  evidence: [
    {
      sourceType: 'docs',
      sourceRef: 'AGENTS.md',
      summary: 'Validation expectations include docs audit when documentation/governance surfaces are touched.'
    }
  ]
};
