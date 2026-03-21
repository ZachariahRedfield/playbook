import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolvePatternKnowledgeStore } from './patternStore.js';
import { readGlobalPatternsArtifact, writeGlobalPatternsArtifact, type PatternArtifact } from './promotion/globalPatterns.js';
import { buildStoryPatternContext } from './story/patternContext.js';

const tempDirs: string[] = [];

const mkd = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

const writeJson = (root: string, relativePath: string, value: unknown): void => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('pattern storage contract', () => {
  it('keeps global reusable pattern storage scope-first and deterministic across command surfaces', () => {
    const playbookHome = mkd('playbook-home-');
    const repoRoot = mkd('playbook-repo-');
    const legacyArtifact: PatternArtifact = {
      schemaVersion: '1.0',
      kind: 'patterns',
      patterns: [
        {
          id: 'pattern.scope-first',
          title: 'Scope first',
          when: 'when scopes are explicit',
          then: 'all surfaces stay aligned',
          because: 'scope-first resolution beats path inference',
          normalizationKey: 'scope-first',
          sourceRefs: [{ repoId: 'repo-a', artifactPath: '.playbook/story-candidates.json', entryId: 'story-1', fingerprint: 'fp-1' }],
          status: 'active',
          promotedAt: '2026-03-20T00:00:00.000Z',
          provenance: {
            sourceRefs: [{ repoId: 'repo-a', artifactPath: '.playbook/story-candidates.json', entryId: 'story-1', fingerprint: 'fp-1' }]
          }
        }
      ]
    };

    writeJson(playbookHome, 'patterns.json', legacyArtifact);

    const resolvedCompat = resolvePatternKnowledgeStore('global_reusable_pattern_memory', { playbookHome });
    expect(resolvedCompat.canonicalRelativePath).toBe('.playbook/patterns.json');
    expect(resolvedCompat.compatibilityRelativePaths).toEqual(['patterns.json']);
    expect(resolvedCompat.resolvedFrom).toBe('compatibility');
    expect(path.relative(playbookHome, resolvedCompat.resolvedPath).replaceAll('\\', '/')).toBe('patterns.json');

    expect(readGlobalPatternsArtifact(playbookHome)).toEqual(legacyArtifact);

    const storyContext = buildStoryPatternContext(
      {
        id: 'story.scope-first',
        title: 'Adopt scope-first storage',
        type: 'chore',
        status: 'proposed',
        priority: 'medium',
        source: 'global/patterns/pattern.scope-first',
        rationale: 'pattern.scope-first should resolve from the shared global store',
        acceptance_criteria: ['Keep surfaces aligned'],
        evidence: [],
        dependencies: [],
        execution_lane: null,
        suggested_route: null,
        provenance: {
          source_ref: 'global/patterns/pattern.scope-first',
          promoted_from: 'pattern',
          pattern_id: 'pattern.scope-first',
          source_artifact: '.playbook/stories.json',
          promoted_at: '2026-03-20T00:00:00.000Z'
        }
      },
      { playbookHome }
    );

    expect(storyContext.pattern_store).toEqual({
      scope: 'global_reusable_pattern_memory',
      artifact_path: 'patterns.json',
      canonical_artifact_path: '.playbook/patterns.json',
      compat_artifact_paths: ['patterns.json'],
      resolution: 'compatibility'
    });
    expect(storyContext.patterns.map((entry) => entry.pattern_id)).toEqual(['pattern.scope-first']);

    const canonicalArtifact: PatternArtifact = {
      ...legacyArtifact,
      patterns: [
        {
          ...legacyArtifact.patterns[0],
          because: 'canonical writes should move the store to the canonical path'
        }
      ]
    };
    const writtenPath = writeGlobalPatternsArtifact(canonicalArtifact, playbookHome);
    expect(path.relative(playbookHome, writtenPath).replaceAll('\\', '/')).toBe('.playbook/patterns.json');

    const resolvedCanonical = resolvePatternKnowledgeStore('global_reusable_pattern_memory', { playbookHome });
    expect(resolvedCanonical.resolvedFrom).toBe('canonical');
    expect(path.relative(playbookHome, resolvedCanonical.resolvedPath).replaceAll('\\', '/')).toBe('.playbook/patterns.json');
    expect(readGlobalPatternsArtifact(playbookHome)).toEqual(canonicalArtifact);
    expect(fs.existsSync(path.join(playbookHome, 'patterns.json'))).toBe(true);
    expect(fs.existsSync(path.join(playbookHome, '.playbook', 'patterns.json'))).toBe(true);

    const repoLocal = resolvePatternKnowledgeStore('repo_local_memory', { projectRoot: repoRoot });
    const crossRepo = resolvePatternKnowledgeStore('cross_repo_proposal_bridge', { projectRoot: repoRoot });
    expect(repoLocal.canonicalRelativePath).toBe('.playbook/memory/knowledge/patterns.json');
    expect(crossRepo.canonicalRelativePath).toBe('.playbook/pattern-proposals.json');
  });
});
