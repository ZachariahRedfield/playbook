import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getPatternKnowledgePatternById,
  listPatternKnowledgeEvidence,
  listPatternKnowledgeInstances,
  listPatternKnowledgePatterns,
  listPatternKnowledgeRelatedPatterns,
  readPatternKnowledgeGraphArtifact
} from '../src/query/patternKnowledgeGraph.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pattern-graph-'));

const writePatternGraphArtifact = (repoRoot: string, payload: unknown): void => {
  const artifactPath = path.join(repoRoot, '.playbook', 'pattern-knowledge-graph.json');
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(payload, null, 2));
};

describe('pattern knowledge graph query utilities', () => {
  it('loads a valid artifact and supports deterministic list/get/filter traversals', () => {
    const repoRoot = createRepo();
    writePatternGraphArtifact(repoRoot, {
      schemaVersion: '1.0',
      kind: 'playbook-pattern-knowledge-graph',
      createdAt: '2026-04-01T00:00:00.000Z',
      patterns: [
        {
          patternId: 'pattern.docs-requirements',
          title: 'Documentation requirement hardening',
          summary: 'Capture docs governance as deterministic artifacts.',
          layer: 'governance',
          mechanism: 'docs-audit',
          evidenceRefs: ['docs/commands/query.md']
        },
        {
          patternId: 'pattern.query-surface',
          title: 'Read-only query plane',
          summary: 'Add deterministic query interfaces before mutation.',
          layer: 'mechanism',
          mechanism: 'query-plane',
          evidenceRefs: ['packages/engine/src/query/patternKnowledgeGraph.ts']
        }
      ],
      relations: [
        {
          relationId: 'rel-1',
          fromPatternId: 'pattern.query-surface',
          toPatternId: 'pattern.docs-requirements',
          relationType: 'enables',
          evidenceRefs: ['relationship:evidence']
        }
      ],
      instances: [
        {
          instanceId: 'instance-1',
          patternId: 'pattern.query-surface',
          sourceArtifactPath: '.playbook/repo-graph.json',
          evidenceRefs: ['instance:evidence']
        }
      ]
    });

    const artifact = readPatternKnowledgeGraphArtifact(repoRoot);
    expect(artifact.patterns.map((item) => item.patternId)).toEqual(['pattern.docs-requirements', 'pattern.query-surface']);

    expect(getPatternKnowledgePatternById(repoRoot, 'pattern.query-surface')?.title).toBe('Read-only query plane');
    expect(getPatternKnowledgePatternById(repoRoot, 'pattern.unknown')).toBeNull();

    expect(listPatternKnowledgePatterns(repoRoot, { layer: 'mechanism' }).map((entry) => entry.patternId)).toEqual([
      'pattern.query-surface'
    ]);
    expect(listPatternKnowledgePatterns(repoRoot, { mechanism: 'docs-audit' }).map((entry) => entry.patternId)).toEqual([
      'pattern.docs-requirements'
    ]);

    expect(listPatternKnowledgeRelatedPatterns(repoRoot, 'pattern.query-surface').map((entry) => entry.patternId)).toEqual([
      'pattern.docs-requirements'
    ]);

    expect(listPatternKnowledgeInstances(repoRoot, 'pattern.query-surface').map((entry) => entry.instanceId)).toEqual(['instance-1']);

    expect(listPatternKnowledgeEvidence(repoRoot, 'pattern.query-surface')).toEqual([
      'instance:evidence',
      'packages/engine/src/query/patternKnowledgeGraph.ts',
      'relationship:evidence'
    ]);
  });

  it('rejects invalid/corrupt artifacts with deterministic errors', () => {
    const repoRoot = createRepo();

    expect(() => readPatternKnowledgeGraphArtifact(repoRoot)).toThrowError(
      'playbook query pattern-graph: missing artifact. Generate deterministic pattern knowledge graph artifacts first (.playbook/pattern-knowledge-graph.json)'
    );

    writePatternGraphArtifact(repoRoot, {
      schemaVersion: '9.9',
      kind: 'playbook-pattern-knowledge-graph',
      createdAt: '2026-04-01T00:00:00.000Z',
      patterns: [],
      relations: [],
      instances: []
    });

    expect(() => readPatternKnowledgeGraphArtifact(repoRoot)).toThrowError(
      'playbook query pattern-graph: unsupported schemaVersion "9.9"; expected "1.0" (.playbook/pattern-knowledge-graph.json)'
    );

    writePatternGraphArtifact(repoRoot, {
      schemaVersion: '1.0',
      kind: 'playbook-pattern-knowledge-graph',
      createdAt: '2026-04-01T00:00:00.000Z',
      patterns: [{ patternId: 'broken', layer: 'mechanism', mechanism: 'query-plane' }],
      relations: [],
      instances: []
    });

    expect(() => readPatternKnowledgeGraphArtifact(repoRoot)).toThrowError(
      'playbook query pattern-graph: invalid patterns payload (.playbook/pattern-knowledge-graph.json)'
    );

    const artifactPath = path.join(repoRoot, '.playbook', 'pattern-knowledge-graph.json');
    fs.writeFileSync(artifactPath, '{not-json');
    expect(() => readPatternKnowledgeGraphArtifact(repoRoot)).toThrowError(
      'playbook query pattern-graph: invalid artifact payload: Invalid Playbook artifact – regenerate using CLI owned output flags. (.playbook/pattern-knowledge-graph.json)'
    );
  });
});
