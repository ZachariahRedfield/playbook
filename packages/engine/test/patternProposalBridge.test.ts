import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPatternProposalArtifact,
  generatePatternProposalArtifact,
  readPatternProposalArtifact,
  writePatternProposalArtifact,
  type CrossRepoCandidatesArtifact
} from '../src/index.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pattern-proposals-'));

const writeCrossRepoCandidates = (repoRoot: string, artifact: CrossRepoCandidatesArtifact): void => {
  const targetPath = path.join(repoRoot, '.playbook', 'cross-repo-candidates.json');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(artifact, null, 2));
};

describe('pattern proposal bridge', () => {
  it('builds filtered proposals deterministically from candidate families', () => {
    const artifact = buildPatternProposalArtifact({
      schemaVersion: '1.0',
      kind: 'cross-repo-candidates',
      generatedAt: '2026-01-03T00:00:00.000Z',
      repositories: ['a', 'b', 'c'],
      families: [
        {
          pattern_family: 'layering',
          repo_count: 3,
          candidate_count: 6,
          mean_confidence: 0.84,
          repos: ['b', 'a', 'c'],
          first_seen: '2026-01-01T00:00:00.000Z',
          last_seen: '2026-01-03T00:00:00.000Z'
        },
        {
          pattern_family: 'query-before-mutation',
          repo_count: 1,
          candidate_count: 2,
          mean_confidence: 0.99,
          repos: ['a'],
          first_seen: '2026-01-01T00:00:00.000Z',
          last_seen: '2026-01-03T00:00:00.000Z'
        },
        {
          pattern_family: 'modularity',
          repo_count: 2,
          candidate_count: 3,
          mean_confidence: 0.61,
          repos: ['a', 'c'],
          first_seen: '2026-01-01T00:00:00.000Z',
          last_seen: '2026-01-03T00:00:00.000Z'
        }
      ]
    });

    expect(artifact.kind).toBe('pattern-proposals');
    expect(artifact.proposals).toHaveLength(1);
    expect(artifact.proposals[0]).toEqual({
      proposal_id: 'proposal.layering.generalization',
      pattern_family: 'layering',
      candidate_repos: ['a', 'b', 'c'],
      mean_confidence: 0.84,
      portability_score: 0.92,
      proposed_action: 'append_instance',
      target_pattern: 'pattern.layering'
    });
  });

  it('generates and persists proposal artifacts without mutating pattern graph artifacts', () => {
    const repoRoot = createRepo();
    writeCrossRepoCandidates(repoRoot, {
      schemaVersion: '1.0',
      kind: 'cross-repo-candidates',
      generatedAt: '2026-01-03T00:00:00.000Z',
      repositories: ['playbook', 'fawxzzy-fitness'],
      families: [
        {
          pattern_family: 'layering',
          repo_count: 2,
          candidate_count: 4,
          mean_confidence: 0.84,
          repos: ['playbook', 'fawxzzy-fitness'],
          first_seen: '2026-01-01T00:00:00.000Z',
          last_seen: '2026-01-03T00:00:00.000Z'
        }
      ]
    });

    const generated = generatePatternProposalArtifact(repoRoot);
    writePatternProposalArtifact(repoRoot, generated);

    expect(fs.existsSync(path.join(repoRoot, '.playbook', 'pattern-graph.json'))).toBe(false);
    const loaded = readPatternProposalArtifact(repoRoot);
    expect(loaded.proposals).toHaveLength(1);
    expect(loaded.proposals[0].target_pattern).toBe('pattern.layering');
  });
});
