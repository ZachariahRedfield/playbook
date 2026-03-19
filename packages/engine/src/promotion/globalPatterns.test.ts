import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PLAYBOOK_HOME_ENV,
  createDefaultGlobalPatternCandidatesArtifact,
  createDefaultGlobalPatternsArtifact,
  readGlobalPatternCandidatesArtifact,
  readGlobalPatternsArtifact,
  resolvePlaybookHome,
  writeGlobalPatternCandidatesArtifact,
  writeGlobalPatternsArtifact,
  type PatternArtifact,
  type PatternCandidateArtifact,
} from './globalPatterns.js';

const tempHomes: string[] = [];
const originalPlaybookHome = process.env[PLAYBOOK_HOME_ENV];

const createTempHome = (): string => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-home-'));
  tempHomes.push(home);
  return home;
};

afterEach(() => {
  if (typeof originalPlaybookHome === 'string') {
    process.env[PLAYBOOK_HOME_ENV] = originalPlaybookHome;
  } else {
    delete process.env[PLAYBOOK_HOME_ENV];
  }
  for (const home of tempHomes.splice(0)) {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

describe('global pattern promotion storage', () => {
  it('supports PLAYBOOK_HOME and defaults global artifacts when absent', () => {
    const home = createTempHome();
    process.env[PLAYBOOK_HOME_ENV] = home;

    expect(resolvePlaybookHome()).toBe(home);
    expect(readGlobalPatternCandidatesArtifact()).toEqual(createDefaultGlobalPatternCandidatesArtifact());
    expect(readGlobalPatternsArtifact()).toEqual(createDefaultGlobalPatternsArtifact());
  });

  it('round-trips candidate and promoted artifacts with deterministic id ordering', () => {
    const home = createTempHome();
    const candidates: PatternCandidateArtifact = {
      schemaVersion: '1.0',
      kind: 'pattern-candidates',
      candidates: [
        {
          id: 'pattern.z',
          title: 'Z pattern',
          when: 'when z',
          then: 'then z',
          because: 'because z',
          normalizationKey: 'z',
          storySeed: 'story.z',
          sourceRefs: [{ repoId: 'repo-b', artifactPath: '.playbook/stories.json', entryId: 'story-b', fingerprint: 'fp-b' }],
          fingerprint: 'cand-z'
        },
        {
          id: 'pattern.a',
          title: 'A pattern',
          when: 'when a',
          then: 'then a',
          because: 'because a',
          normalizationKey: 'a',
          sourceRefs: [{ repoId: 'repo-a', artifactPath: '.playbook/stories.json', entryId: 'story-a', fingerprint: 'fp-a' }],
          fingerprint: 'cand-a'
        }
      ]
    };
    const patterns: PatternArtifact = {
      schemaVersion: '1.0',
      kind: 'patterns',
      patterns: [
        {
          id: 'pattern.z',
          title: 'Z pattern',
          when: 'when z',
          then: 'then z',
          because: 'because z',
          normalizationKey: 'z',
          sourceRefs: [{ repoId: 'repo-b', artifactPath: '.playbook/story-candidates.json', entryId: 'candidate-b', fingerprint: 'fp-b' }],
          status: 'active',
          promotedAt: '2026-03-19T00:00:00.000Z',
          supersededBy: null,
          supersedes: [],
          retiredAt: null,
          retirementReason: null,
          demotedAt: null,
          demotionReason: null,
          recalledAt: null,
          recallReason: null,
          provenance: {
            sourceRefs: [{ repoId: 'repo-b', artifactPath: '.playbook/story-candidates.json', entryId: 'candidate-b', fingerprint: 'fp-b' }]
          }
        },
        {
          id: 'pattern.a',
          title: 'A pattern',
          when: 'when a',
          then: 'then a',
          because: 'because a',
          normalizationKey: 'a',
          storySeed: 'story.a',
          sourceRefs: [{ repoId: 'repo-a', artifactPath: '.playbook/story-candidates.json', entryId: 'candidate-a', fingerprint: 'fp-a' }],
          status: 'active',
          promotedAt: '2026-03-18T00:00:00.000Z',
          supersededBy: null,
          supersedes: [],
          retiredAt: null,
          retirementReason: null,
          demotedAt: null,
          demotionReason: null,
          recalledAt: null,
          recallReason: null,
          provenance: {
            sourceRefs: [{ repoId: 'repo-a', artifactPath: '.playbook/story-candidates.json', entryId: 'candidate-a', fingerprint: 'fp-a' }]
          }
        }
      ]
    };

    const candidatePath = writeGlobalPatternCandidatesArtifact(candidates, home);
    const patternPath = writeGlobalPatternsArtifact(patterns, home);

    expect(readGlobalPatternCandidatesArtifact(home)).toEqual({
      ...candidates,
      candidates: [...candidates.candidates].sort((left, right) => left.id.localeCompare(right.id))
    });
    expect(readGlobalPatternsArtifact(home)).toEqual({
      ...patterns,
      patterns: [...patterns.patterns].sort((left, right) => left.id.localeCompare(right.id))
    });

    const candidateText = fs.readFileSync(candidatePath, 'utf8');
    const patternText = fs.readFileSync(patternPath, 'utf8');
    expect(candidateText.indexOf('"id": "pattern.a"')).toBeLessThan(candidateText.indexOf('"id": "pattern.z"'));
    expect(patternText.indexOf('"id": "pattern.a"')).toBeLessThan(patternText.indexOf('"id": "pattern.z"'));
  });
});
