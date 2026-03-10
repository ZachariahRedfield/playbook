import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bucketCompactionCandidates, buildPatternCardsFromBuckets, canonicalizeCandidate, createPatternCardId, readPatternCards, toExistingPatternTargets, writeCompactionReviewDraftArtifact, writePatternCards } from '../src/compaction/index.js';
import type { PatternCard } from '../src/compaction/index.js';

const makeCandidate = (input: { sourceKind?: 'verify' | 'plan' | 'apply' | 'analyze-pr' | 'docs-audit'; sourceRef?: string; subjectRef: string; trigger: string; mechanism: string; invariant?: string; response?: string; evidenceSummary?: string }) =>
  canonicalizeCandidate({
    sourceKind: input.sourceKind ?? 'verify',
    sourceRef: input.sourceRef ?? '.playbook/verify.json',
    subjectKind: 'rule',
    subjectRef: input.subjectRef,
    trigger: input.trigger,
    mechanism: input.mechanism,
    invariant: input.invariant,
    response: input.response,
    evidence: [
      {
        sourceKind: input.sourceKind ?? 'verify',
        sourceRef: input.sourceRef ?? '.playbook/verify.json',
        pointer: 'findings[0]',
        summary: input.evidenceSummary ?? 'deterministic evidence'
      }
    ],
    related: {
      modules: ['@zachariahredfield/playbook-engine'],
      rules: ['PB001'],
      docs: ['docs/architecture/KNOWLEDGE_COMPACTION_PHASE.md'],
      owners: ['Team-A'],
      tests: ['packages/engine/test/compaction.patternCards.test.ts'],
      riskSignals: ['high churn'],
      graphNodes: ['module:@zachariahredfield/playbook-engine']
    }
  });

describe('compaction pattern card storage', () => {
  it('creates graph-ready pattern card from add bucket', () => {
    const addCandidate = makeCandidate({
      subjectRef: 'PB-ADD-1',
      trigger: 'cross tool alias drift',
      mechanism: 'same command aliases drift across docs and scripts',
      response: 'align aliases in one deterministic source'
    });

    const [entry] = bucketCompactionCandidates({ candidates: [addCandidate] });
    expect(entry.bucket).toBe('add');

    const result = buildPatternCardsFromBuckets({ entries: [entry], existingCards: [] });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      kind: 'playbook-pattern-card',
      createdFromBucket: 'add',
      relatedPatterns: [],
      relatedModules: ['@zachariahredfield/playbook-engine'],
      confidence: null
    });
  });

  it('merge produces one compacted reviewable card with supersedes', () => {
    const existing = makeCandidate({
      subjectRef: 'PB-MERGE-EXISTING',
      trigger: 'local build',
      mechanism: 'use local built cli before branch validation',
      response: 'run pnpm -r build first'
    });

    const incoming = makeCandidate({
      subjectRef: 'PB-MERGE-NEW',
      trigger: 'local build',
      mechanism: 'Use LOCAL built CLI before branch validation!',
      response: 'Run pnpm -r build first',
      evidenceSummary: 'merge variant evidence'
    });

    const [entry] = bucketCompactionCandidates({
      candidates: [incoming],
      existingTargets: [{ targetId: 'pattern.local_build_legacy', origin: 'known-pattern', candidate: existing }]
    });

    expect(entry.bucket).toBe('merge');
    const result = buildPatternCardsFromBuckets({ entries: [entry], existingCards: [] });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].supersedes).toEqual(['pattern.local_build_legacy']);
    expect(result.reviewDraftArtifact.mergeDecisions).toHaveLength(1);
  });

  it('attach preserves evidence without creating duplicate abstractions', () => {
    const existingCard: PatternCard = {
      schemaVersion: '1.0',
      kind: 'playbook-pattern-card',
      patternId: 'pattern.docs_audit',
      title: 'docs audit',
      status: 'candidate',
      createdFromBucket: 'add',
      trigger: 'docs drift',
      context: 'rule:PB001',
      mechanism: 'run docs audit when governance docs change',
      invariant: '',
      implication: '',
      response: 'run node packages/cli/dist/main.js docs audit --json',
      examples: ['run docs audit when governance docs change'],
      evidence: ['old evidence'],
      sourceKinds: ['verify'],
      sourceRefs: ['.playbook/verify.json'],
      relatedModules: [],
      relatedRules: ['PB001'],
      relatedDocs: ['role:docs/index.md'],
      relatedOwners: [],
      relatedTests: [],
      relatedRiskSignals: [],
      relatedGraphNodes: [],
      relatedPatterns: [],
      supersedes: [],
      supersededBy: [],
      reviewState: 'pending-review',
      promotionState: 'not-promoted',
      confidence: null
    };

    const incoming = makeCandidate({ sourceKind: 'docs-audit', sourceRef: '.playbook/docs-audit.json', subjectRef: 'PB001', trigger: 'docs drift', mechanism: 'run docs audit when governance docs change', response: 'run node packages/cli/dist/main.js docs audit --json', evidenceSummary: 'new docs evidence' });
    const [entry] = bucketCompactionCandidates({ candidates: [incoming], existingTargets: toExistingPatternTargets([existingCard]) });

    expect(entry.bucket).toBe('attach');
    const result = buildPatternCardsFromBuckets({ entries: [entry], existingCards: [existingCard] });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].patternId).toBe(existingCard.patternId);
    expect(result.cards[0].evidence).toEqual(['new docs evidence', 'old evidence']);
  });

  it('creates stable pattern IDs from normalized abstraction fields', () => {
    const first = createPatternCardId({ trigger: 'docs drift', context: 'rule:PB001', mechanism: 'run docs audit', invariant: '', implication: '', response: 'run docs audit' });
    const second = createPatternCardId({ trigger: 'docs drift', context: 'rule:PB001', mechanism: 'run docs audit', invariant: '', implication: '', response: 'run docs audit' });
    expect(first).toBe(second);
    expect(first.startsWith('pattern.')).toBe(true);
  });

  it('keeps stable storage ordering and review draft shape', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-patterns-'));
    const a = makeCandidate({ subjectRef: 'A', trigger: 'a', mechanism: 'mechanism a' });
    const b = makeCandidate({ subjectRef: 'B', trigger: 'b', mechanism: 'mechanism b' });
    const entries = bucketCompactionCandidates({ candidates: [b, a] });

    const result = buildPatternCardsFromBuckets({ entries, existingCards: [] });
    writePatternCards(tempRoot, result.cards);
    const loaded = readPatternCards(tempRoot);
    expect(loaded.map((card) => card.patternId)).toEqual([...loaded.map((card) => card.patternId)].sort((x, y) => x.localeCompare(y)));

    const reviewDraftPath = writeCompactionReviewDraftArtifact(tempRoot, result.reviewDraftArtifact);
    expect(fs.existsSync(reviewDraftPath)).toBe(true);
    expect(result.reviewDraftArtifact).toHaveProperty('addDecisions');
    expect(result.reviewDraftArtifact).toHaveProperty('discarded');
  });

  it('does not persist discard bucket entries as stored cards', () => {
    const discardCandidate = makeCandidate({ sourceKind: 'apply', sourceRef: '.playbook/apply.json', subjectRef: 'tmp', trigger: 'ok', mechanism: 'tmp' });
    const [entry] = bucketCompactionCandidates({ candidates: [discardCandidate] });
    expect(entry.bucket).toBe('discard');

    const result = buildPatternCardsFromBuckets({ entries: [entry], existingCards: [] });
    expect(result.cards).toHaveLength(0);
    expect(result.reviewDraftArtifact.discarded).toHaveLength(1);
  });
});
