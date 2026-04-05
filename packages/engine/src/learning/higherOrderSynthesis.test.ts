import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildHigherOrderSynthesisArtifact,
  buildAndWriteHigherOrderSynthesisArtifact,
  HIGHER_ORDER_SYNTHESIS_RELATIVE_PATH
} from './higherOrderSynthesis.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-higher-order-synthesis-'));

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const target = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const seedArtifacts = (repo: string): void => {
  writeJson(repo, '.playbook/learning-clusters.json', {
    schemaVersion: '1.0',
    kind: 'learning-clusters',
    generatedAt: '2026-04-05T00:00:00.000Z',
    proposalOnly: true,
    reviewOnly: true,
    sourceArtifacts: ['.playbook/remediation-status.json'],
    clusters: [
      {
        clusterId: 'cluster:repeated_failure_shape:engine-signature-a',
        dimension: 'repeated_failure_shape',
        sourceEvidenceRefs: ['.playbook/remediation-status.json#blocked_signature_rollup/sig-a'],
        repeatedSignalSummary: 'Engine signature a repeats.',
        suggestedImprovementCandidateType: 'verify_rule_improvement',
        confidence: 0.8,
        riskReviewRequirement: 'governance-review',
        nextActionText: 'Review sig-a as proposal-only.'
      },
      {
        clusterId: 'cluster:repeated_failure_shape:engine-signature-b',
        dimension: 'repeated_failure_shape',
        sourceEvidenceRefs: ['.playbook/remediation-status.json#blocked_signature_rollup/sig-b'],
        repeatedSignalSummary: 'Engine signature b repeats.',
        suggestedImprovementCandidateType: 'verify_rule_improvement',
        confidence: 0.7,
        riskReviewRequirement: 'governance-review',
        nextActionText: 'Review sig-b as proposal-only.'
      },
      {
        clusterId: 'cluster:repeated_query_usage_pattern:ask-usage',
        dimension: 'repeated_query_usage_pattern',
        sourceEvidenceRefs: ['.playbook/telemetry/command-quality.json#ask'],
        repeatedSignalSummary: 'Ask usage repeats.',
        suggestedImprovementCandidateType: 'query_experience_hardening',
        confidence: 0.65,
        riskReviewRequirement: 'maintainer-review',
        nextActionText: 'Review ask usage as proposal-only.'
      }
    ]
  });

  writeJson(repo, '.playbook/graph-informed-learning.json', {
    schemaVersion: '1.0',
    kind: 'graph-informed-learning',
    generatedAt: '2026-04-05T00:00:00.000Z',
    proposalOnly: true,
    reviewOnly: true,
    sourceArtifacts: ['.playbook/learning-clusters.json', '.playbook/repo-graph.json', '.playbook/repo-index.json'],
    clusters: [
      {
        clusterId: 'cluster:repeated_failure_shape:engine-signature-a',
        dimension: 'repeated_failure_shape',
        relatedModules: ['engine', 'core'],
        dependencyNeighborhoodSummary: {
          directDependencies: 1,
          directDependents: 0,
          adjacentModuleCount: 1,
          dependencyEdgesWithinNeighborhood: 1
        },
        sharedGovernanceRuleSurfaces: ['PB101.rule-order'],
        structuralConcentration: {
          moduleCoverageRatio: 0.4,
          neighborhoodSpreadRatio: 0.6,
          governanceCoverageRatio: 0.5,
          classification: 'balanced'
        },
        graphInformedRationale: 'Cluster a graph rationale proposal-only.',
        learningCluster: {}
      },
      {
        clusterId: 'cluster:repeated_failure_shape:engine-signature-b',
        dimension: 'repeated_failure_shape',
        relatedModules: ['engine'],
        dependencyNeighborhoodSummary: {
          directDependencies: 1,
          directDependents: 0,
          adjacentModuleCount: 1,
          dependencyEdgesWithinNeighborhood: 1
        },
        sharedGovernanceRuleSurfaces: ['PB101.rule-order'],
        structuralConcentration: {
          moduleCoverageRatio: 0.3,
          neighborhoodSpreadRatio: 0.5,
          governanceCoverageRatio: 0.6,
          classification: 'balanced'
        },
        graphInformedRationale: 'Cluster b graph rationale proposal-only.',
        learningCluster: {}
      }
    ]
  });
};

describe('higher-order synthesis artifact', () => {
  it('is deterministic for the same cluster + graph-informed inputs', () => {
    const repo = createRepo();
    seedArtifacts(repo);

    const first = buildHigherOrderSynthesisArtifact(repo);
    const second = buildHigherOrderSynthesisArtifact(repo);

    expect(second).toEqual(first);
    expect(first.kind).toBe('higher-order-synthesis');
  });

  it('produces candidate-only proposal rows with explicit review boundaries', () => {
    const repo = createRepo();
    seedArtifacts(repo);

    const artifact = buildHigherOrderSynthesisArtifact(repo);

    expect(artifact.proposalOnly).toBe(true);
    expect(artifact.reviewOnly).toBe(true);
    expect(artifact.synthesisProposals).toHaveLength(1);

    const proposal = artifact.synthesisProposals[0];
    expect(proposal.synthesisProposalId).toBe('synthesis:repeated_failure_shape:verify_rule_improvement');
    expect(proposal.contributingClusterIds).toEqual([
      'cluster:repeated_failure_shape:engine-signature-a',
      'cluster:repeated_failure_shape:engine-signature-b'
    ]);
    expect(proposal.reviewRequired).toBe(true);
    expect(proposal.nextActionText).toContain('human-reviewed promotion');
  });

  it('writes .playbook/higher-order-synthesis.json as read-only candidate artifact', () => {
    const repo = createRepo();
    seedArtifacts(repo);

    const written = buildAndWriteHigherOrderSynthesisArtifact(repo);
    const absolutePath = path.join(repo, HIGHER_ORDER_SYNTHESIS_RELATIVE_PATH);
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as {
      proposalOnly: boolean;
      reviewOnly: boolean;
      kind: string;
    };

    expect(written.artifactPath).toBe(path.resolve(repo, HIGHER_ORDER_SYNTHESIS_RELATIVE_PATH));
    expect(parsed.kind).toBe('higher-order-synthesis');
    expect(parsed.proposalOnly).toBe(true);
    expect(parsed.reviewOnly).toBe(true);
  });
});
