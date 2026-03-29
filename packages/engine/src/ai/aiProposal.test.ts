import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateAiProposal } from './aiProposal.js';

const createRepo = (name: string): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  return repo;
};

describe('generateAiProposal', () => {
  it('builds proposal-only payload with deterministic boundaries', () => {
    const repo = createRepo('playbook-engine-ai-proposal');
    fs.writeFileSync(path.join(repo, '.playbook', 'repo-index.json'), JSON.stringify({ command: 'index' }));

    const proposal = generateAiProposal(repo);

    expect(proposal.command).toBe('ai-propose');
    expect(proposal.scope.mode).toBe('proposal-only');
    expect(proposal.scope.boundaries).toEqual([
      'no-direct-apply',
      'no-memory-promotion',
      'no-pattern-promotion',
      'no-external-interop-emit',
      'artifact-only-output'
    ]);
    expect(proposal.recommendedNextGovernedSurface).toBe('plan');
  });

  it('reports blockers for missing repo index and optional artifacts', () => {
    const repo = createRepo('playbook-engine-ai-proposal-blockers');

    const proposal = generateAiProposal(repo, { include: ['plan', 'review'] });

    expect(proposal.blockers.some((entry) => entry.includes('.playbook/repo-index.json'))).toBe(true);
    expect(proposal.blockers.some((entry) => entry.includes('.playbook/plan.json'))).toBe(true);
    expect(proposal.recommendedNextGovernedSurface).toBe('route');
  });
});
