import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPatternProposalArtifact,
  generatePatternProposalArtifact,
  promotePatternProposalToMemory,
  promotePatternProposalToStory,
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
  it('builds filtered proposals deterministically from cross-repo candidates', () => {
    const artifact = buildPatternProposalArtifact({
      schemaVersion: '1.0',
      kind: 'cross-repo-candidates',
      generatedAt: '2026-01-03T00:00:00.000Z',
      repositories: ['a', 'b', 'c'],
      candidates: [
        {
          id: 'candidate.layering.001',
          title: 'Portable governed artifact pattern: layering',
          when: 'When a, b, c all emit governed evidence for layering.',
          then: 'Then review layering as a portable cross-repo pattern candidate.',
          because: 'Cross-repo evidence shows layering across 3 repositories.',
          normalizationKey: 'artifact-pattern::layering',
          sourceRefs: [
            'a::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-a',
            'b::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-b',
            'c::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-c'
          ],
          storySeed: {
            title: 'Review portable pattern: layering',
            rationale: 'Cross-repo evidence shows layering across 3 repositories.',
            acceptanceCriteria: ['Verify evidence', 'Keep references only']
          },
          fingerprint: 'finger-layering'
        },
        {
          id: 'candidate.query-before-mutation.001',
          title: 'Portable governed artifact pattern: query-before-mutation',
          when: 'When only a emits evidence.',
          then: 'Then review cautiously.',
          because: 'Only one repository contributes evidence.',
          normalizationKey: 'artifact-pattern::query-before-mutation',
          sourceRefs: ['a::pattern-candidates::.playbook/pattern-candidates.json::/candidates/1::digest-a'],
          storySeed: {
            title: 'Review portable pattern: query-before-mutation',
            rationale: 'Only one repository contributes evidence.',
            acceptanceCriteria: ['Verify evidence']
          },
          fingerprint: 'finger-query'
        }
      ]
    });

    expect(artifact.kind).toBe('pattern-proposals');
    expect(artifact.proposals).toHaveLength(1);
    expect(artifact.proposals[0]).toMatchObject({
      proposal_id: 'proposal.artifact-pattern-layering.generalization',
      pattern_family: 'artifact-pattern::layering',
      candidate_repos: ['a', 'b', 'c'],
      mean_confidence: 1,
      portability_score: 1,
      proposed_action: 'append_instance',
      target_pattern: 'pattern.artifact-pattern-layering'
    });
    expect(artifact.proposals[0].portability_rationale).toContain('Portable across 3 repos');
    expect(artifact.proposals[0].evidence).toHaveLength(3);
    expect(artifact.proposals[0].promotion_targets.map((entry) => entry.kind)).toEqual(['memory', 'story']);
  });

  it('generates and persists proposal artifacts without mutating pattern graph artifacts', () => {
    const repoRoot = createRepo();
    writeCrossRepoCandidates(repoRoot, {
      schemaVersion: '1.0',
      kind: 'cross-repo-candidates',
      generatedAt: '2026-01-03T00:00:00.000Z',
      repositories: ['playbook', 'fawxzzy-fitness'],
      candidates: [
        {
          id: 'candidate.layering.001',
          title: 'Portable governed artifact pattern: layering',
          when: 'When playbook and fawxzzy-fitness emit evidence.',
          then: 'Then review layering as a portable cross-repo pattern candidate.',
          because: 'Cross-repo evidence shows layering across 2 repositories.',
          normalizationKey: 'artifact-pattern::layering',
          sourceRefs: [
            'fawxzzy-fitness::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-fitness',
            'playbook::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-playbook'
          ],
          storySeed: {
            title: 'Review portable pattern: layering',
            rationale: 'Cross-repo evidence shows layering across 2 repositories.',
            acceptanceCriteria: ['Verify evidence', 'Keep references only']
          },
          fingerprint: 'finger-layering'
        }
      ]
    });

    const generated = generatePatternProposalArtifact(repoRoot);
    writePatternProposalArtifact(repoRoot, generated);

    expect(fs.existsSync(path.join(repoRoot, '.playbook', 'pattern-graph.json'))).toBe(false);
    const loaded = readPatternProposalArtifact(repoRoot);
    expect(loaded.proposals).toHaveLength(1);
    expect(loaded.proposals[0].target_pattern).toBe('pattern.artifact-pattern-layering');
  });

  it('explicitly promotes a cross-repo proposal into memory knowledge and repo stories', () => {
    const repoRoot = createRepo();
    writeCrossRepoCandidates(repoRoot, {
      schemaVersion: '1.0',
      kind: 'cross-repo-candidates',
      generatedAt: '2026-01-03T00:00:00.000Z',
      repositories: ['playbook', 'fawxzzy-fitness'],
      candidates: [{
        id: 'candidate.layering.001',
        title: 'Portable governed artifact pattern: layering',
        when: 'When playbook and fawxzzy-fitness emit evidence.',
        then: 'Then review layering as a portable cross-repo pattern candidate.',
        because: 'Cross-repo evidence shows layering across 2 repositories.',
        normalizationKey: 'artifact-pattern::layering',
        sourceRefs: [
          'fawxzzy-fitness::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-fitness',
          'playbook::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-playbook'
        ],
        storySeed: {
          title: 'Review portable pattern: layering',
          rationale: 'Cross-repo evidence shows layering across 2 repositories.',
          acceptanceCriteria: ['Verify evidence', 'Keep references only']
        },
        fingerprint: 'finger-layering'
      }]
    });
    writePatternProposalArtifact(repoRoot, generatePatternProposalArtifact(repoRoot));

    const memoryPromotion = promotePatternProposalToMemory(repoRoot, 'proposal.artifact-pattern-layering.generalization');
    expect(memoryPromotion.target).toBe('memory');
    expect(memoryPromotion.memory?.promoted.kind).toBe('pattern');

    const storyPromotion = promotePatternProposalToStory(repoRoot, 'proposal.artifact-pattern-layering.generalization', 'playbook');
    expect(storyPromotion.target).toBe('story');
    expect(storyPromotion.story?.id).toBe('cross-repo-artifact-pattern-layering-playbook');
    expect(fs.existsSync(path.join(repoRoot, '.playbook', 'stories.json'))).toBe(true);
  });
});
