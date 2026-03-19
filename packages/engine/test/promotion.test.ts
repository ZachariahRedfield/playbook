import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { materializePatternFromCandidate, materializeStoryFromSource, readCanonicalPatternsArtifact } from '../src/promotion.js';

const tempDirs: string[] = [];
const mkd = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
const writeJson = (root: string, relativePath: string, value: unknown): void => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};
afterEach(() => {
  while (tempDirs.length > 0) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('promotion materialization', () => {
  it('supports repo-local story candidate to story promotion with provenance and only target artifact mutation', () => {
    const repo = mkd('playbook-promotion-repo-');
    writeJson(repo, '.playbook/story-candidates.json', {
      schemaVersion: '1.0', kind: 'story-candidates', generatedAt: '2026-03-19T00:00:00.000Z', repo: 'repo-a', readOnly: true,
      sourceArtifacts: { readiness: [], improvementCandidatesPath: '.playbook/improvement-candidates.json', updatedStatePath: '.playbook/execution-updated-state.json', routerRecommendationsPath: '.playbook/router-recommendations.json' },
      candidates: [{ id: 'story-candidate-1', repo: 'repo-a', title: 'Candidate', type: 'feature', source: 'manual', severity: 'medium', priority: 'high', confidence: 'high', status: 'proposed', evidence: ['e1'], rationale: 'r', acceptance_criteria: [], dependencies: [], execution_lane: null, suggested_route: null, candidate_fingerprint: 'fingerprint-1', candidate_id: 'story-candidate-1', grouping_keys: ['g'], source_signals: ['s'], source_artifacts: ['.playbook/story-candidates.json'], promotion_hint: 'x', explanation: [] }]
    });
    const prepared = materializeStoryFromSource({ sourceRef: 'repo/repo-a/story-candidates/story-candidate-1', targetRepoId: 'repo-a', targetRepoRoot: repo, playbookHome: repo, promotedAt: '2026-03-19T00:00:00.000Z' });
    expect(prepared.record.provenance?.candidate_fingerprint).toBe('fingerprint-1');
    expect(prepared.committedRelativePath).toBe('.playbook/stories.json');
    expect(fs.existsSync(path.join(repo, '.playbook/stories.json'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'patterns.json'))).toBe(false);
  });

  it('supports global pattern candidate to pattern promotion with provenance and idempotent repetition', () => {
    const home = mkd('playbook-promotion-home-');
    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{
        id: 'pattern-candidate-1',
        pattern_family: 'layering',
        title: 'Layering',
        description: 'desc',
        storySeed: { title: 'Seed layering story', summary: 'Seed summary', acceptance: ['Check layering evidence'] },
        source_artifact: '.playbook/pattern-candidates.json',
        signals: ['a'],
        confidence: 0.8,
        evidence_refs: ['ref'],
        status: 'observed'
      }]
    });
    const first = materializePatternFromCandidate({ sourceRef: 'global/pattern-candidates/pattern-candidate-1', playbookHome: home, targetPatternId: 'pattern.layering', promotedAt: '2026-03-19T00:00:00.000Z' });
    writeJson(home, 'patterns.json', first.artifact);
    const second = materializePatternFromCandidate({ sourceRef: 'global/pattern-candidates/pattern-candidate-1', playbookHome: home, targetPatternId: 'pattern.layering', promotedAt: '2026-03-19T00:00:00.000Z' });
    expect(first.record.provenance.candidate_id).toBe('pattern-candidate-1');
    expect(first.record.storySeed.title).toBe('Seed layering story');
    expect(second.noop).toBe(true);
    expect(readCanonicalPatternsArtifact(home).patterns).toHaveLength(1);
  });

  it('supports global pattern candidate to repo-local story promotion', () => {
    const home = mkd('playbook-promotion-home-');
    const repo = mkd('repo-b-');
    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{ id: 'pattern-candidate-2', pattern_family: 'governance', title: 'Governance', description: 'desc', source_artifact: '.playbook/pattern-candidates.json', signals: ['signal'], confidence: 0.7, evidence_refs: ['ref'], status: 'observed' }]
    });
    const prepared = materializeStoryFromSource({ sourceRef: 'global/pattern-candidates/pattern-candidate-2', targetRepoId: 'repo-b', targetStoryId: 'story.governance', targetRepoRoot: repo, playbookHome: home, promotedAt: '2026-03-19T00:00:00.000Z' });
    expect(prepared.record.id).toBe('story.governance');
    expect(prepared.record.provenance?.promoted_from).toBe('pattern-candidate');
    expect(fs.existsSync(path.join(repo, '.playbook/stories.json'))).toBe(false);
    expect(fs.existsSync(path.join(home, 'patterns.json'))).toBe(false);
  });

  it('supports promoted global pattern to repo-local story seeding using storySeed metadata and pattern provenance', () => {
    const home = mkd('playbook-promotion-home-');
    const repo = mkd('repo-pattern-seed-');
    writeJson(home, 'patterns.json', {
      schemaVersion: '1.0',
      kind: 'promoted-patterns',
      patterns: [{
        id: 'pattern.layering',
        pattern_family: 'layering',
        title: 'Layering',
        description: 'desc',
        storySeed: {
          title: 'Adopt layering in repo-pattern-seed',
          summary: 'Use bounded layering adoption as a repo-local story.',
          acceptance: ['Verify layering evidence', 'Keep execution story-driven']
        },
        source_artifact: '.playbook/pattern-candidates.json',
        signals: ['signal'],
        confidence: 0.9,
        evidence_refs: ['ref-a', 'ref-b'],
        status: 'promoted',
        provenance: {
          source_ref: 'global/pattern-candidates/pattern-candidate-1',
          candidate_id: 'pattern-candidate-1',
          candidate_fingerprint: 'pattern-fingerprint-1',
          promoted_at: '2026-03-19T00:00:00.000Z'
        }
      }]
    });
    const prepared = materializeStoryFromSource({
      sourceRef: 'global/patterns/pattern.layering',
      targetRepoId: 'repo-pattern-seed',
      targetRepoRoot: repo,
      playbookHome: home,
      promotedAt: '2026-03-19T00:00:00.000Z'
    });
    expect(prepared.record.title).toBe('Adopt layering in repo-pattern-seed');
    expect(prepared.record.rationale).toBe('Use bounded layering adoption as a repo-local story.');
    expect(prepared.record.acceptance_criteria).toEqual(['Keep execution story-driven', 'Verify layering evidence']);
    expect(prepared.record.provenance?.promoted_from).toBe('pattern');
    expect(prepared.record.provenance?.pattern_id).toBe('pattern.layering');
    expect(prepared.record.provenance?.source_ref).toBe('global/patterns/pattern.layering');
    expect(prepared.record.evidence).toContain('patterns.json');
    expect(fs.existsSync(path.join(repo, '.playbook/stories.json'))).toBe(false);
  });

  it('fails clearly on conflicting repeated promotion', () => {
    const home = mkd('playbook-promotion-home-');
    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{ id: 'pattern-candidate-3', pattern_family: 'layering', title: 'Layering A', description: 'desc', source_artifact: '.playbook/pattern-candidates.json', signals: ['a'], confidence: 0.8, evidence_refs: ['ref'], status: 'observed' }]
    });
    const first = materializePatternFromCandidate({ sourceRef: 'global/pattern-candidates/pattern-candidate-3', playbookHome: home, targetPatternId: 'pattern.layering', promotedAt: '2026-03-19T00:00:00.000Z' });
    writeJson(home, 'patterns.json', first.artifact);
    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{ id: 'pattern-candidate-3', pattern_family: 'layering', title: 'Layering B', description: 'different', source_artifact: '.playbook/pattern-candidates.json', signals: ['b'], confidence: 0.8, evidence_refs: ['ref'], status: 'observed' }]
    });
    expect(() => materializePatternFromCandidate({ sourceRef: 'global/pattern-candidates/pattern-candidate-3', playbookHome: home, targetPatternId: 'pattern.layering', promotedAt: '2026-03-19T00:00:00.000Z' })).toThrow(/conflict for pattern/);
  });
});
