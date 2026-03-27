import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildPatternConvergenceArtifact } from './patternConvergence.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pattern-convergence-'));

const writePatternCandidates = (repo: string): void => {
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.playbook', 'pattern-candidates.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'pattern-candidates',
        generatedAt: '2026-03-20T00:00:00.000Z',
        candidates: [
          {
            id: 'candidate-deterministic-query',
            pattern_family: 'query-before-mutation',
            title: 'Query before mutation boundaries',
            description: 'Ensure read-only verification precedes any mutating path.',
            source_artifact: '.playbook/patterns.json',
            signals: ['deterministic ordering', 'read-only artifact synthesis'],
            confidence: 0.73,
            evidence_refs: ['verify#1'],
            status: 'accepted'
          },
          {
            id: 'candidate-deterministic-index',
            pattern_family: 'query-before-mutation',
            title: 'Index and query first for governance',
            description: 'Stabilize discovery and avoid mutation authority drift.',
            source_artifact: '.playbook/patterns.json',
            signals: ['same input, same output', 'cluster and normalize'],
            confidence: 0.7,
            evidence_refs: ['verify#2'],
            status: 'accepted'
          },
          {
            id: 'candidate-portability',
            pattern_family: 'cross-repo-portability',
            title: 'Portable pattern candidate transfer',
            description: 'Share reusable candidate knowledge across repositories.',
            source_artifact: '.playbook/patterns.json',
            signals: ['cross-repo consistency'],
            confidence: 0.63,
            evidence_refs: ['verify#3'],
            status: 'triaged'
          }
        ]
      },
      null,
      2
    )
  );
};

const writePromotedPatterns = (repo: string): void => {
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.playbook', 'patterns-promoted.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'playbook-promoted-patterns',
        promotedPatterns: [
          {
            id: 'pattern-query-before-mutate',
            sourceCandidateId: 'candidate-deterministic-query',
            canonicalPatternName: 'query before mutation governance',
            whyItExists: 'Mutation authority requires explicit review boundaries.',
            examples: ['query then apply'],
            confidence: 0.9,
            reusableEngineeringMeaning: 'Use read-only synthesis to keep deterministic behavior before writes.',
            promotedAt: '2026-03-21T00:00:00.000Z',
            reviewRecord: {
              candidateId: 'candidate-deterministic-query',
              canonicalPatternName: 'query before mutation governance',
              whyItExists: 'Mutation authority requires explicit review boundaries.',
              examples: ['query then apply'],
              confidence: 0.9,
              reusableEngineeringMeaning: 'Use read-only synthesis to keep deterministic behavior before writes.',
              decision: {
                candidateId: 'candidate-deterministic-query',
                decision: 'approve',
                decidedBy: 'human-reviewed-local',
                decidedAt: '2026-03-21T00:00:00.000Z',
                rationale: 'approved'
              }
            }
          }
        ]
      },
      null,
      2
    )
  );
};

describe('buildPatternConvergenceArtifact', () => {
  it('returns deterministic output for same inputs', () => {
    const repo = createRepo();
    writePatternCandidates(repo);
    writePromotedPatterns(repo);

    const first = buildPatternConvergenceArtifact(repo);
    const second = buildPatternConvergenceArtifact(repo);

    expect(second).toEqual(first);
    expect(first.kind).toBe('pattern-convergence');
    expect(first.proposalOnly).toBe(true);
  });

  it('clusters independently-derived similar patterns deterministically', () => {
    const repo = createRepo();
    writePatternCandidates(repo);
    writePromotedPatterns(repo);

    const artifact = buildPatternConvergenceArtifact(repo);
    const convergenceCluster = artifact.clusters.find((entry) => entry.clusterId.includes('deterministic-governance'));

    expect(convergenceCluster).toBeDefined();
    expect(convergenceCluster?.members.length).toBeGreaterThanOrEqual(2);
    expect(convergenceCluster?.members.map((member) => member.id)).toContain('candidate-deterministic-query');
    expect(convergenceCluster?.members.map((member) => member.id)).toContain('pattern-query-before-mutate');
  });

  it('does not mutate source artifacts', () => {
    const repo = createRepo();
    writePatternCandidates(repo);
    writePromotedPatterns(repo);

    const candidatesBefore = fs.readFileSync(path.join(repo, '.playbook', 'pattern-candidates.json'), 'utf8');
    const promotedBefore = fs.readFileSync(path.join(repo, '.playbook', 'patterns-promoted.json'), 'utf8');

    buildPatternConvergenceArtifact(repo);

    const candidatesAfter = fs.readFileSync(path.join(repo, '.playbook', 'pattern-candidates.json'), 'utf8');
    const promotedAfter = fs.readFileSync(path.join(repo, '.playbook', 'patterns-promoted.json'), 'utf8');

    expect(candidatesAfter).toBe(candidatesBefore);
    expect(promotedAfter).toBe(promotedBefore);
  });
});
