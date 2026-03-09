import { describe, expect, it } from 'vitest';
import {
  buildCompactionReviewArtifact,
  canonicalizeCompactionCandidate,
  decideCompactionBucket,
  fingerprintCompactionCandidate,
  InternalCompactionPattern
} from '../src/knowledge/compaction.js';
import {
  addCandidateFixture,
  attachCandidateFixture,
  discardCandidateFixture,
  existingPatternsFixture,
  mergeCandidateFixture
} from './__fixtures__/knowledgeCompaction.fixtures.js';

describe('knowledge compaction (internal deterministic slice)', () => {
  it('routes obvious discard candidates to discard', () => {
    const result = decideCompactionBucket(discardCandidateFixture, existingPatternsFixture);
    expect(result.decision).toEqual({ bucket: 'discard', reason: 'empty-mechanism' });
  });

  it('routes evidence-only additions to attach for existing patterns', () => {
    const result = decideCompactionBucket(attachCandidateFixture, existingPatternsFixture);
    expect(result.decision).toEqual({
      bucket: 'attach',
      reason: 'supports-existing-pattern',
      targetPatternId: 'pattern-cli-local-build'
    });
  });

  it('routes wording variants to merge with deterministic target selection', () => {
    const reorderedPatterns: InternalCompactionPattern[] = [...existingPatternsFixture].reverse();
    const a = decideCompactionBucket(mergeCandidateFixture, existingPatternsFixture);
    const b = decideCompactionBucket(mergeCandidateFixture, reorderedPatterns);

    expect(a.decision).toEqual({
      bucket: 'merge',
      reason: 'wording-variant-same-mechanism',
      mergeTargetPatternId: 'pattern-cli-local-build'
    });
    expect(b.decision).toEqual(a.decision);
  });

  it('routes genuinely new patterns to add', () => {
    const result = decideCompactionBucket(addCandidateFixture, existingPatternsFixture);
    expect(result.decision).toEqual({ bucket: 'add', reason: 'new-pattern' });
  });

  it('is stable across equivalent reorderings and repeated runs', () => {
    const variant = {
      ...mergeCandidateFixture,
      examples: [...(mergeCandidateFixture.examples ?? [])].reverse(),
      evidence: [...(mergeCandidateFixture.evidence ?? [])].reverse()
    };

    const canonicalA = canonicalizeCompactionCandidate(mergeCandidateFixture);
    const canonicalB = canonicalizeCompactionCandidate(variant);
    expect(canonicalA).toEqual(canonicalB);

    const fingerprintA = fingerprintCompactionCandidate(canonicalA);
    const fingerprintB = fingerprintCompactionCandidate(canonicalB);
    expect(fingerprintA).toBe(fingerprintB);

    const decisionA = decideCompactionBucket(variant, existingPatternsFixture);
    const decisionB = decideCompactionBucket(variant, existingPatternsFixture);
    expect(decisionA).toEqual(decisionB);
  });

  it('produces deterministic review artifacts with stable reason ordering', () => {
    const baseline = buildCompactionReviewArtifact(mergeCandidateFixture, existingPatternsFixture);
    const reorderedInput = {
      ...mergeCandidateFixture,
      evidence: [...(mergeCandidateFixture.evidence ?? [])].reverse(),
      examples: [...(mergeCandidateFixture.examples ?? [])].reverse()
    };
    const reorderedPatterns: InternalCompactionPattern[] = [...existingPatternsFixture].reverse();
    const reordered = buildCompactionReviewArtifact(reorderedInput, reorderedPatterns);

    expect(reordered).toEqual(baseline);
    expect(baseline.reasonCodes).toEqual(['wording-variant-same-mechanism', 'merge-lexical-variance']);
    expect(baseline.explanations).toEqual([
      'Candidate uses different wording but resolves to the same mechanism fingerprint.',
      'Merge decision collapses lexical variation into an existing canonical mechanism.'
    ]);
  });

  it('provides deterministic rationale for attach/discard/add buckets', () => {
    const attachArtifact = buildCompactionReviewArtifact(attachCandidateFixture, existingPatternsFixture);
    expect(attachArtifact).toMatchObject({
      bucket: 'attach',
      reasonCodes: ['supports-existing-pattern', 'attach-evidence-to-pattern'],
      targetPatternId: 'pattern-cli-local-build'
    });

    const discardArtifact = buildCompactionReviewArtifact(discardCandidateFixture, existingPatternsFixture);
    expect(discardArtifact).toMatchObject({
      bucket: 'discard',
      reasonCodes: ['empty-mechanism', 'discard-insufficient-signal']
    });

    const addArtifact = buildCompactionReviewArtifact(addCandidateFixture, existingPatternsFixture);
    expect(addArtifact).toMatchObject({
      bucket: 'add',
      reasonCodes: ['new-pattern', 'add-novel-pattern']
    });
  });
});
