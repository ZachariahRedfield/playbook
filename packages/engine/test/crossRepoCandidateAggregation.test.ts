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

const writeArtifact = (repoPath: string, relativePath: string, body: unknown): void => {
  const targetPath = path.join(repoPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
};

const seedRepo = (repoPath: string, variant: string): void => {
  writeArtifact(repoPath, '.playbook/cycle-state.json', { kind: 'cycle-state', workflow: 'stable-loop', variant, body: `secret-${variant}-cycle` });
  writeArtifact(repoPath, '.playbook/policy-evaluation.json', { kind: 'policy-evaluation', passed: true, variant, details: `secret-${variant}-policy` });
};

const buildInputs = (entries: Array<{ id: string; repoPath: string }>): CrossRepoCandidateInput[] => entries;

describe('crossRepoCandidateAggregation', () => {
  const fixedGeneratedAt = '2026-03-19T00:00:00.000Z';

  it('emits candidates in stable generation order', () => {
    const repoA = createRepo('cross-repo-candidates-a');
    const repoB = createRepo('cross-repo-candidates-b');
    seedRepo(repoA, 'a');
    seedRepo(repoB, 'b');

    const forward = computeCrossRepoCandidateAggregation(buildInputs([
      { id: 'repo-b', repoPath: repoB },
      { id: 'repo-a', repoPath: repoA }
    ]), { generatedAt: fixedGeneratedAt });
    const reverse = computeCrossRepoCandidateAggregation(buildInputs([
      { id: 'repo-a', repoPath: repoA },
      { id: 'repo-b', repoPath: repoB }
    ]), { generatedAt: fixedGeneratedAt });

    expect(forward).toEqual(reverse);
    expect(forward.candidates.map((entry) => entry.normalizationKey)).toEqual([
      'artifact-pattern::pattern-cycle-state::portable-governed-artifact-pattern-cycle-state::repo-a-repo-b::cycle-state::2',
      'artifact-pattern::pattern-policy-evaluation::portable-governed-artifact-pattern-policy-evaluation::repo-a-repo-b::policy-evaluation::2'
    ]);
  });

  it('keeps candidate ids stable across repeated runs with the same inputs', () => {
    const repoA = createRepo('cross-repo-candidates-repeat-a');
    const repoB = createRepo('cross-repo-candidates-repeat-b');
    seedRepo(repoA, 'a');
    seedRepo(repoB, 'b');
    const inputs = buildInputs([
      { id: 'repo-a', repoPath: repoA },
      { id: 'repo-b', repoPath: repoB }
    ]);

    const first = computeCrossRepoCandidateAggregation(inputs, { generatedAt: fixedGeneratedAt });
    const second = computeCrossRepoCandidateAggregation(inputs, { generatedAt: fixedGeneratedAt });

    expect(first.candidates.map((entry) => entry.id)).toEqual(second.candidates.map((entry) => entry.id));
    expect(first.candidates.map((entry) => entry.fingerprint)).toEqual(second.candidates.map((entry) => entry.fingerprint));
  });

  it('produces the same artifact bytes for the same inputs and stores only source references', () => {
    const repoA = createRepo('cross-repo-candidates-stable-a');
    const repoB = createRepo('cross-repo-candidates-stable-b');
    const outputRoot = createRepo('cross-repo-candidates-output');
    seedRepo(repoA, 'a');
    seedRepo(repoB, 'b');

    const artifact = computeCrossRepoCandidateAggregation(buildInputs([
      { id: 'repo-a', repoPath: repoA },
      { id: 'repo-b', repoPath: repoB }
    ]), { generatedAt: fixedGeneratedAt });

    const firstPath = writeCrossRepoCandidatesArtifact(outputRoot, artifact);
    const firstContent = fs.readFileSync(firstPath, 'utf8');
    const secondPath = writeCrossRepoCandidatesArtifact(outputRoot, artifact);
    const secondContent = fs.readFileSync(secondPath, 'utf8');

    expect(firstPath).toBe(secondPath);
    expect(firstContent).toBe(secondContent);
    expect(readCrossRepoCandidatesArtifact(outputRoot)).toEqual(artifact);
    expect(firstContent).not.toContain('secret-a-cycle');
    expect(firstContent).not.toContain('secret-b-policy');
    expect(artifact.candidates.every((entry) => entry.sourceRefs.every((ref) => ref.includes('.playbook/')))).toBe(true);
  });
});
