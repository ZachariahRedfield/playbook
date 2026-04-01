import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../../lib/cliContract.js';
import { runPatternsConvergence } from './convergence.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-patterns-convergence-'));

const writeConvergenceArtifact = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'pattern-convergence.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'pattern-convergence',
        generatedAt: '2026-01-04T00:00:00.000Z',
        proposalOnly: true,
        sourceArtifacts: ['.playbook/pattern-candidates.json', '.playbook/patterns-promoted.json'],
        clusters: [
          {
            clusterId: 'cluster:pattern-portability-cross-repo-consistency-normalize-and-cluster',
            intent: 'pattern-portability',
            constraint_class: 'cross-repo-consistency',
            resolution_strategy: 'normalize-and-cluster',
            members: [
              {
                source: 'candidate',
                id: 'candidate.portability.layering',
                title: 'Portable layering family',
                intent: 'pattern-portability',
                constraint_class: 'cross-repo-consistency',
                resolution_strategy: 'normalize-and-cluster'
              }
            ],
            shared_abstraction: 'Compress cross-repo evidence into reusable normalized pattern families.',
            convergence_confidence: 0.93,
            recommended_higher_order_pattern: 'Higher-order: map shared portability constraints into one reusable abstraction.'
          },
          {
            clusterId: 'cluster:deterministic-governance-mutation-boundary-review-gated-promotion',
            intent: 'deterministic-governance',
            constraint_class: 'mutation-boundary',
            resolution_strategy: 'review-gated-promotion',
            members: [
              {
                source: 'promoted',
                id: 'pattern.review.gate',
                title: 'Review-gated promotion',
                intent: 'deterministic-governance',
                constraint_class: 'mutation-boundary',
                resolution_strategy: 'review-gated-promotion'
              }
            ],
            shared_abstraction: 'Promote only through explicit review to preserve deterministic governance boundaries.',
            convergence_confidence: 0.64,
            recommended_higher_order_pattern: 'Higher-order: enforce explicit review gates before promotion mutations.'
          }
        ]
      },
      null,
      2
    )
  );
};

describe('runPatternsConvergence', () => {
  it('emits deterministic JSON payload from canonical convergence artifact', () => {
    const repo = createRepo();
    writeConvergenceArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = runPatternsConvergence(repo, [], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      command: 'patterns',
      action: 'convergence',
      status: 'proposal-only read surface',
      cluster_count: 2,
      filters: {
        intent: null,
        constraint: null,
        resolution: null,
        minConfidence: null
      }
    });
    expect(payload.clusters[0]).toMatchObject({
      members: expect.any(Array),
      intent: expect.any(String),
      constraint_class: expect.any(String),
      resolution_strategy: expect.any(String),
      convergence_confidence: expect.any(Number),
      recommended_higher_order_pattern: expect.any(String)
    });

    logSpy.mockRestore();
  });

  it('applies additive filters predictably and keeps text compact', () => {
    const repo = createRepo();
    writeConvergenceArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = runPatternsConvergence(
      repo,
      ['--intent', 'pattern-portability', '--constraint', 'cross-repo-consistency', '--resolution', 'normalize-and-cluster', '--min-confidence', '0.9'],
      { format: 'text', quiet: false }
    );

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((entry) => String(entry[0]));
    expect(lines[0]).toContain('Status:');
    expect(lines[1]).toBe('Cluster count: 1');
    expect(lines[2]).toContain('Top convergent abstractions: 1');
    expect(lines.at(-1)).toContain('Next action:');

    logSpy.mockRestore();
  });
});
