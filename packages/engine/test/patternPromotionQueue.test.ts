import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDoctrineCandidatesArtifact,
  buildPatternReviewQueue,
  PATTERN_CONVERGENCE_RELATIVE_PATH,
  queryPatternReviewQueue,
  queryPromotedPatterns,
  promotePatternCandidate,
  writePatternReviewQueue
} from '../src/index.js';
import type { PatternCompactionArtifact } from '../src/compaction/compactPatterns.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe('pattern promotion queue', () => {
  it('builds deterministic review queue from compacted patterns', () => {
    const artifact: PatternCompactionArtifact = {
      schemaVersion: '1.0',
      command: 'pattern-compaction',
      patterns: [
        { id: 'MODULE_TEST_ABSENCE', bucket: 'testing', occurrences: 3, examples: ['module lacks tests'] },
        { id: 'SINGLE_OBSERVATION', bucket: 'documentation', occurrences: 1, examples: ['single signal'] }
      ]
    };

    const queue = buildPatternReviewQueue(artifact, '2026-01-01T00:00:00.000Z');
    expect(queue.candidates).toHaveLength(1);
    expect(queue.candidates[0]).toMatchObject({ id: 'candidate-module_test_absence', sourcePatternId: 'MODULE_TEST_ABSENCE' });
    expect(queue.candidates[0]?.convergencePrioritySuggestion.proposalOnly).toBe(true);
    expect(queue.candidates[0]?.convergencePrioritySuggestion.suggestedPriority).toBeDefined();
  });

  it('promotes approved candidates and removes them from queue', () => {
    const repo = createRepo('playbook-pattern-promotion');
    const queue = {
      schemaVersion: '1.0' as const,
      kind: 'playbook-pattern-review-queue' as const,
      generatedAt: '2026-01-01T00:00:00.000Z',
      candidates: [
        {
          id: 'candidate-module_test_absence',
          sourcePatternId: 'MODULE_TEST_ABSENCE',
          canonicalPatternName: 'module test absence',
          whyItExists: 'because',
          examples: ['module lacks tests'],
          confidence: 0.9,
          reusableEngineeringMeaning: 'meaning',
          recurrenceCount: 3,
          repoSurfaceBreadth: 0.6,
          remediationUsefulness: 0.8,
          canonicalClarity: 0.9,
          falsePositiveRisk: 0.1,
          promotionScore: 0.83,
          attractorScoreBreakdown: {
            recurrence_score: 0.6,
            cross_domain_score: 1,
            evidence_score: 0.5,
            reuse_score: 0.7,
            governance_score: 0.9,
            attractor_score: 0.7,
            explanation: 'Attractor score ranks representational persistence and utility. It does not claim ontology or truth.'
          },
          convergencePrioritySuggestion: {
            proposalOnly: true,
            suggestedPriority: 'medium',
            weightedScore: 0.804,
            weightingFactors: {
              basePromotionScore: 0.83,
              convergenceConfidence: 0.7,
              convergenceMemberCount: 2,
              clusterMatch: true
            },
            rationale: 'Proposal-only weighting signal.',
            matchedClusterId: 'cluster:module-test-review'
          },
          stage: 'review' as const
        }
      ]
    };
    writePatternReviewQueue(repo, queue);

    const decision = promotePatternCandidate(repo, { id: 'candidate-module_test_absence', decision: 'approve', decidedAt: '2026-01-02T00:00:00.000Z' });
    expect(decision.decision.decision).toBe('approve');

    const queued = queryPatternReviewQueue(repo);
    expect(queued.candidates).toHaveLength(0);

    const promoted = queryPromotedPatterns(repo);
    expect(promoted.promotedPatterns).toHaveLength(1);
    expect(promoted.promotedPatterns[0].id).toBe('MODULE_TEST_ABSENCE');
  });

  it('builds doctrine candidates artifact from strong review candidates only', () => {
    const queue = {
      schemaVersion: '1.0' as const,
      kind: 'playbook-pattern-review-queue' as const,
      generatedAt: '2026-01-01T00:00:00.000Z',
      candidates: [
        {
          id: 'candidate-strong-pattern',
          sourcePatternId: 'STRONG_PATTERN',
          canonicalPatternName: 'strong pattern',
          whyItExists: 'because',
          examples: ['ref-1', 'ref-2', 'ref-3'],
          confidence: 0.9,
          reusableEngineeringMeaning: 'strong guidance',
          recurrenceCount: 3,
          repoSurfaceBreadth: 0.6,
          remediationUsefulness: 0.8,
          canonicalClarity: 0.9,
          falsePositiveRisk: 0.1,
          promotionScore: 0.86,
          attractorScoreBreakdown: {
            recurrence_score: 0.6,
            cross_domain_score: 1,
            evidence_score: 0.8,
            reuse_score: 0.8,
            governance_score: 0.9,
            attractor_score: 0.86,
            explanation: 'Strong signal.'
          },
          convergencePrioritySuggestion: {
            proposalOnly: true,
            suggestedPriority: 'high',
            weightedScore: 0.88,
            weightingFactors: {
              basePromotionScore: 0.86,
              convergenceConfidence: 0.95,
              convergenceMemberCount: 3,
              clusterMatch: true
            },
            rationale: 'Proposal-only weighting signal.',
            matchedClusterId: 'cluster:strong-pattern'
          },
          stage: 'review' as const
        },
        {
          id: 'candidate-weak-pattern',
          sourcePatternId: 'WEAK_PATTERN',
          canonicalPatternName: 'weak pattern',
          whyItExists: 'because',
          examples: ['ref-1', 'ref-2'],
          confidence: 0.59,
          reusableEngineeringMeaning: 'weak guidance',
          recurrenceCount: 2,
          repoSurfaceBreadth: 0.5,
          remediationUsefulness: 0.6,
          canonicalClarity: 0.8,
          falsePositiveRisk: 0.2,
          promotionScore: 0.62,
          attractorScoreBreakdown: {
            recurrence_score: 0.4,
            cross_domain_score: 0.8,
            evidence_score: 0.5,
            reuse_score: 0.5,
            governance_score: 0.7,
            attractor_score: 0.8,
            explanation: 'Not strong enough.'
          },
          convergencePrioritySuggestion: {
            proposalOnly: true,
            suggestedPriority: 'low',
            weightedScore: 0.58,
            weightingFactors: {
              basePromotionScore: 0.62,
              convergenceConfidence: 0.4,
              convergenceMemberCount: 1,
              clusterMatch: false
            },
            rationale: 'Proposal-only weighting signal.',
            matchedClusterId: null
          },
          stage: 'review' as const
        }
      ]
    };

    const doctrine = buildDoctrineCandidatesArtifact(queue);
    expect(doctrine.kind).toBe('playbook-doctrine-candidates');
    expect(doctrine.reviewOnly).toBe(true);
    expect(doctrine.candidates).toHaveLength(1);
    expect(doctrine.candidates[0]).toMatchObject({
      candidateId: 'candidate-strong-pattern',
      sourcePatternId: 'STRONG_PATTERN',
      metrics: {
        strength: 0.86,
        evidence_refs: 3,
        instances: 3,
        outcome_confidence: 0.9
      },
      reviewState: 'review_required'
    });
  });

  it('reads convergence clusters and emits additive proposal-only priority suggestions', () => {
    const repo = createRepo('playbook-pattern-convergence-weighting');
    const convergencePath = path.join(repo, PATTERN_CONVERGENCE_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(convergencePath), { recursive: true });
    fs.writeFileSync(
      convergencePath,
      JSON.stringify(
        {
          schemaVersion: '1.0',
          kind: 'pattern-convergence',
          generatedAt: '2026-01-01T00:00:00.000Z',
          proposalOnly: true,
          sourceArtifacts: ['.playbook/pattern-candidates.json'],
          clusters: [
            {
              clusterId: 'cluster:module-test-governance',
              intent: 'testing-governance',
              constraint_class: 'mutation-boundary',
              resolution_strategy: 'review-gated-promotion',
              members: [{ source: 'candidate', id: 'candidate-one', title: 'module test governance', intent: 'testing-governance', constraint_class: 'mutation-boundary', resolution_strategy: 'review-gated-promotion' }],
              shared_abstraction: 'shared',
              convergence_confidence: 0.9,
              recommended_higher_order_pattern: 'recommendation'
            }
          ]
        },
        null,
        2
      )
    );

    const artifact: PatternCompactionArtifact = {
      schemaVersion: '1.0',
      command: 'pattern-compaction',
      patterns: [{ id: 'MODULE_TEST_GOVERNANCE', bucket: 'testing', occurrences: 3, examples: ['module test governance'] }]
    };

    const queue = buildPatternReviewQueue(artifact, '2026-01-01T00:00:00.000Z', { repoRoot: repo });
    expect(queue.candidates[0]?.convergencePrioritySuggestion).toMatchObject({
      proposalOnly: true,
      matchedClusterId: 'cluster:module-test-governance'
    });
  });
});
