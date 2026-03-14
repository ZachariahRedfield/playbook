import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPatternFamilyDiscoveryArtifact,
  readPatternFamilyDiscoveryArtifact,
  writePatternFamilyDiscoveryArtifact,
  type PatternFamilyDiscoveryArtifact
} from '../src/index.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pattern-family-'));

const writePatternCandidates = (
  repoRoot: string,
  artifact: {
    kind: 'pattern-candidates';
    generatedAt: string;
    candidates: Array<{ id: string; pattern_family: string; title: string; confidence: number }>;
  }
): void => {
  const targetPath = path.join(repoRoot, '.playbook', 'pattern-candidates.json');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(artifact, null, 2));
};

describe('pattern family normalization', () => {
  it('normalizes title variants into deterministic canonical families', () => {
    const repoA = createRepo();
    const repoB = createRepo();

    writePatternCandidates(repoA, {
      kind: 'pattern-candidates',
      generatedAt: '2026-03-01T00:00:00.000Z',
      candidates: [
        {
          id: 'cand.layered-ordering',
          pattern_family: 'layered dependency ordering',
          title: 'Layered dependency ordering across services',
          confidence: 0.8
        },
        {
          id: 'cand.modular-boundary',
          pattern_family: 'bounded module interface boundaries',
          title: 'Bounded module interface boundaries',
          confidence: 0.78
        },
        {
          id: 'cand.recursive-workflow',
          pattern_family: 'workflow-cycle',
          title: 'Cyclic verification workflow for governance',
          confidence: 0.9
        }
      ]
    });

    writePatternCandidates(repoB, {
      kind: 'pattern-candidates',
      generatedAt: '2026-03-05T00:00:00.000Z',
      candidates: [
        {
          id: 'cand.layering',
          pattern_family: 'layering',
          title: 'Layering discipline in build ordering',
          confidence: 0.85
        },
        {
          id: 'cand.schema-symmetry',
          pattern_family: 'schema envelope symmetry',
          title: 'Schema envelope symmetry across contracts',
          confidence: 0.82
        },
        {
          id: 'cand.modularity',
          pattern_family: 'modularity',
          title: 'Modularity by bounded interfaces',
          confidence: 0.74
        }
      ]
    });

    const artifact = buildPatternFamilyDiscoveryArtifact([
      { id: 'repo-a', repoPath: repoA },
      { id: 'repo-b', repoPath: repoB }
    ]);

    expect(artifact.generatedAt).toBe('2026-03-05T00:00:00.000Z');
    expect(artifact.families).toEqual([
      {
        pattern_family: 'layering',
        repo_count: 2,
        candidate_count: 2,
        mean_confidence: 0.825,
        candidate_ids: ['cand.layered-ordering', 'cand.layering']
      },
      {
        pattern_family: 'modularity',
        repo_count: 2,
        candidate_count: 2,
        mean_confidence: 0.76,
        candidate_ids: ['cand.modular-boundary', 'cand.modularity']
      },
      {
        pattern_family: 'recursion',
        repo_count: 1,
        candidate_count: 1,
        mean_confidence: 0.9,
        candidate_ids: ['cand.recursive-workflow']
      },
      {
        pattern_family: 'symmetry',
        repo_count: 1,
        candidate_count: 1,
        mean_confidence: 0.82,
        candidate_ids: ['cand.schema-symmetry']
      }
    ]);

    const assignmentIds = artifact.assignments.map((entry) => entry.candidate_id).sort((left, right) => left.localeCompare(right));
    expect(assignmentIds).toEqual([
      'cand.layered-ordering',
      'cand.layering',
      'cand.modular-boundary',
      'cand.modularity',
      'cand.recursive-workflow',
      'cand.schema-symmetry'
    ]);
  });

  it('writes and reads the discovery artifact without mutating source candidate artifacts', () => {
    const repoRoot = createRepo();

    writePatternCandidates(repoRoot, {
      kind: 'pattern-candidates',
      generatedAt: '2026-03-02T00:00:00.000Z',
      candidates: [
        {
          id: 'cand.symmetry-a',
          pattern_family: 'symmetrical schemas',
          title: 'schema envelope symmetry',
          confidence: 0.83
        }
      ]
    });

    const candidateBefore = fs.readFileSync(path.join(repoRoot, '.playbook', 'pattern-candidates.json'), 'utf8');

    const artifact: PatternFamilyDiscoveryArtifact = buildPatternFamilyDiscoveryArtifact([{ id: 'repo', repoPath: repoRoot }]);
    writePatternFamilyDiscoveryArtifact(repoRoot, artifact);
    const loaded = readPatternFamilyDiscoveryArtifact(repoRoot);

    expect(loaded.kind).toBe('pattern-family-discovery');
    expect(loaded.families[0]?.pattern_family).toBe('symmetry');

    const candidateAfter = fs.readFileSync(path.join(repoRoot, '.playbook', 'pattern-candidates.json'), 'utf8');
    expect(candidateAfter).toBe(candidateBefore);
  });
});
