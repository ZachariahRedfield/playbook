import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeCrossRepoCandidateAggregation,
  readCrossRepoCandidatesArtifact,
  writeCrossRepoCandidatesArtifact,
  type CrossRepoCandidateInput
} from '../src/learning/crossRepoCandidateAggregation.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writePatternCandidates = (
  repoPath: string,
  generatedAt: string,
  candidates: Array<{ id: string; pattern_family: string; confidence: number }>
): void => {
  const targetPath = path.join(repoPath, '.playbook', 'pattern-candidates.json');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(
    targetPath,
    `${JSON.stringify({ schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt, candidates }, null, 2)}\n`,
    'utf8'
  );
};

const buildInputs = (entries: Array<{ id: string; repoPath: string }>): CrossRepoCandidateInput[] => entries;

describe('crossRepoCandidateAggregation', () => {
  it('aggregates deterministically by normalized pattern_family', () => {
    const repoA = createRepo('cross-repo-candidates-a');
    const repoB = createRepo('cross-repo-candidates-b');

    writePatternCandidates(repoA, '2026-01-01T00:00:00.000Z', [
      { id: 'a-1', pattern_family: 'Workflow Recursion', confidence: 0.9 },
      { id: 'a-2', pattern_family: 'workflow_recursion', confidence: 0.5 },
      { id: 'a-3', pattern_family: ' Layering ', confidence: 1 }
    ]);

    writePatternCandidates(repoB, '2026-01-02T00:00:00.000Z', [
      { id: 'b-1', pattern_family: 'workflow-recursion', confidence: 0.2 },
      { id: 'b-2', pattern_family: 'LAYERING', confidence: 0.4 }
    ]);

    const forward = computeCrossRepoCandidateAggregation(buildInputs([
      { id: 'repo-b', repoPath: repoB },
      { id: 'repo-a', repoPath: repoA }
    ]));

    const reverse = computeCrossRepoCandidateAggregation(buildInputs([
      { id: 'repo-a', repoPath: repoA },
      { id: 'repo-b', repoPath: repoB }
    ]));

    expect(forward).toEqual(reverse);
    expect(forward.families.map((entry) => entry.pattern_family)).toEqual(['layering', 'workflow-recursion']);
  });

  it('computes repo_count, candidate_count, and mean_confidence correctly', () => {
    const repoA = createRepo('cross-repo-candidates-count-a');
    const repoB = createRepo('cross-repo-candidates-count-b');

    writePatternCandidates(repoA, '2026-02-01T00:00:00.000Z', [
      { id: 'a-1', pattern_family: 'modularity', confidence: 0.8 },
      { id: 'a-2', pattern_family: 'modularity', confidence: 0.6 }
    ]);

    writePatternCandidates(repoB, '2026-02-03T00:00:00.000Z', [{ id: 'b-1', pattern_family: 'modularity', confidence: 0.1 }]);

    const artifact = computeCrossRepoCandidateAggregation(buildInputs([
      { id: 'repo-a', repoPath: repoA },
      { id: 'repo-b', repoPath: repoB }
    ]));

    expect(artifact.generatedAt).toBe('2026-02-03T00:00:00.000Z');
    expect(artifact.repositories).toEqual(['repo-a', 'repo-b']);
    expect(artifact.families).toEqual([
      {
        pattern_family: 'modularity',
        repo_count: 2,
        candidate_count: 3,
        mean_confidence: 0.5,
        repos: ['repo-a', 'repo-b'],
        first_seen: '2026-02-01T00:00:00.000Z',
        last_seen: '2026-02-03T00:00:00.000Z'
      }
    ]);
  });

  it('writes a stable cross-repo artifact output', () => {
    const repoA = createRepo('cross-repo-candidates-stable-a');
    const repoB = createRepo('cross-repo-candidates-stable-b');
    const outputRoot = createRepo('cross-repo-candidates-output');

    writePatternCandidates(repoA, '2026-03-01T00:00:00.000Z', [{ id: 'a-1', pattern_family: 'query-before-mutation', confidence: 0.75 }]);
    writePatternCandidates(repoB, '2026-03-02T00:00:00.000Z', [{ id: 'b-1', pattern_family: 'query before mutation', confidence: 0.65 }]);

    const artifact = computeCrossRepoCandidateAggregation(buildInputs([
      { id: 'repo-a', repoPath: repoA },
      { id: 'repo-b', repoPath: repoB }
    ]));

    const firstPath = writeCrossRepoCandidatesArtifact(outputRoot, artifact);
    const firstContent = fs.readFileSync(firstPath, 'utf8');

    const secondPath = writeCrossRepoCandidatesArtifact(outputRoot, artifact);
    const secondContent = fs.readFileSync(secondPath, 'utf8');

    expect(firstPath).toBe(secondPath);
    expect(firstContent).toBe(secondContent);
    expect(readCrossRepoCandidatesArtifact(outputRoot)).toEqual(artifact);
  });
});
