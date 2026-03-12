import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPatternReviewQueue,
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
        { id: 'SINGLE_OBSERVATION', bucket: 'quality', occurrences: 1, examples: ['single signal'] }
      ]
    };

    const queue = buildPatternReviewQueue(artifact, '2026-01-01T00:00:00.000Z');
    expect(queue.candidates).toHaveLength(1);
    expect(queue.candidates[0]).toMatchObject({ id: 'candidate-module_test_absence', sourcePatternId: 'MODULE_TEST_ABSENCE' });
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
});
