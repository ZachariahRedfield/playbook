import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildGraphInformedLearningArtifact,
  buildAndWriteGraphInformedLearningArtifact,
  GRAPH_INFORMED_LEARNING_RELATIVE_PATH
} from './graphInformedLearning.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-graph-informed-learning-'));

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const target = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const seedArtifacts = (repo: string): void => {
  writeJson(repo, '.playbook/repo-index.json', {
    schemaVersion: '1.0',
    framework: 'node',
    language: 'typescript',
    architecture: 'modular-monolith',
    modules: [
      { name: 'engine', dependencies: ['core'] },
      { name: 'core', dependencies: [] },
      { name: 'docs', dependencies: ['core'] }
    ],
    dependencies: [],
    workspace: [],
    tests: [],
    configs: [],
    database: 'none',
    rules: ['PB101.rule-order', 'PB301.docs-freshness'],
    architectureRoleInference: {
      classificationMode: 'observation-only',
      classifierVersion: 'role-heuristic-v1',
      policyEnforcement: 'none',
      dependencyMatrix: {
        interface: ['interface', 'orchestration', 'foundation', 'adapter'],
        orchestration: ['orchestration', 'foundation', 'adapter'],
        foundation: ['foundation', 'adapter'],
        adapter: ['adapter']
      },
      nodes: [],
      dependencyObservations: []
    }
  });

  writeJson(repo, '.playbook/repo-graph.json', {
    schemaVersion: '1.1',
    kind: 'playbook-repo-graph',
    generatedAt: '2026-04-05T00:00:00.000Z',
    nodes: [
      { id: 'repository:root', kind: 'repository', name: 'root' },
      { id: 'module:engine', kind: 'module', name: 'engine' },
      { id: 'module:core', kind: 'module', name: 'core' },
      { id: 'module:docs', kind: 'module', name: 'docs' },
      { id: 'rule:PB101.rule-order', kind: 'rule', name: 'PB101.rule-order' },
      { id: 'rule:PB301.docs-freshness', kind: 'rule', name: 'PB301.docs-freshness' }
    ],
    edges: [
      { kind: 'depends_on', from: 'module:engine', to: 'module:core' },
      { kind: 'depends_on', from: 'module:docs', to: 'module:core' },
      { kind: 'governed_by', from: 'module:engine', to: 'rule:PB101.rule-order' },
      { kind: 'governed_by', from: 'module:core', to: 'rule:PB301.docs-freshness' }
    ],
    stats: {
      nodeCount: 6,
      edgeCount: 4,
      nodeKinds: { repository: 1, module: 3, rule: 2 },
      edgeKinds: { depends_on: 2, governed_by: 2 }
    }
  });

  writeJson(repo, '.playbook/learning-clusters.json', {
    schemaVersion: '1.0',
    kind: 'learning-clusters',
    generatedAt: '2026-04-05T00:00:00.000Z',
    proposalOnly: true,
    reviewOnly: true,
    sourceArtifacts: ['.playbook/remediation-status.json'],
    clusters: [
      {
        clusterId: 'cluster:repeated-governance-blocker:engine-rule:abcdef123456',
        dimension: 'repeated_governance_blocker',
        sourceEvidenceRefs: ['.playbook/remediation-status.json#PB101.rule-order'],
        repeatedSignalSummary: 'Engine remediation often blocks due to PB101.rule-order checks.',
        suggestedImprovementCandidateType: 'verify_rule_improvement',
        confidence: 0.72,
        riskReviewRequirement: 'governance-review',
        nextActionText: 'Review engine cluster with PB101.rule-order evidence in explicit maintainer governance review.'
      }
    ]
  });
};

describe('graph-informed learning artifact', () => {
  it('is deterministic for the same graph and learning-cluster inputs', () => {
    const repo = createRepo();
    seedArtifacts(repo);

    const first = buildGraphInformedLearningArtifact(repo);
    const second = buildGraphInformedLearningArtifact(repo);

    expect(second).toEqual(first);
    expect(first.kind).toBe('graph-informed-learning');
  });

  it('enriches clusters with related modules, dependency neighborhood, and governance surfaces', () => {
    const repo = createRepo();
    seedArtifacts(repo);

    const artifact = buildGraphInformedLearningArtifact(repo);
    const cluster = artifact.clusters[0];

    expect(cluster.relatedModules).toEqual(['engine']);
    expect(cluster.dependencyNeighborhoodSummary).toEqual({
      directDependencies: 1,
      directDependents: 0,
      adjacentModuleCount: 1,
      dependencyEdgesWithinNeighborhood: 1
    });
    expect(cluster.sharedGovernanceRuleSurfaces).toEqual(['PB101.rule-order']);
    expect(cluster.structuralConcentration.classification).toBe('balanced');
    expect(cluster.graphInformedRationale).toContain('proposal-only');
  });

  it('writes .playbook/graph-informed-learning.json as a read-only additive artifact', () => {
    const repo = createRepo();
    seedArtifacts(repo);

    const written = buildAndWriteGraphInformedLearningArtifact(repo);
    const absolutePath = path.join(repo, GRAPH_INFORMED_LEARNING_RELATIVE_PATH);
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as {
      proposalOnly: boolean;
      reviewOnly: boolean;
      kind: string;
    };

    expect(written.artifactPath).toBe(path.resolve(repo, GRAPH_INFORMED_LEARNING_RELATIVE_PATH));
    expect(parsed.kind).toBe('graph-informed-learning');
    expect(parsed.proposalOnly).toBe(true);
    expect(parsed.reviewOnly).toBe(true);
  });
});
