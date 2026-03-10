import { describe, expect, it } from 'vitest';
import { assessImportance, assessRelation, bucketCompactionCandidates, canonicalizeCandidate } from '../src/compaction/index.js';
import type { BucketTarget, CompactionCandidate } from '../src/compaction/index.js';

const makeCandidate = (input: Partial<CompactionCandidate> & { subjectRef: string; trigger: string; mechanism: string }): CompactionCandidate =>
  canonicalizeCandidate({
    sourceKind: input.sourceKind ?? 'verify',
    sourceRef: input.sourceRef ?? '.playbook/verify.json',
    subjectKind: input.subjectKind ?? 'rule',
    subjectRef: input.subjectRef,
    trigger: input.trigger,
    mechanism: input.mechanism,
    invariant: input.invariant,
    response: input.response,
    evidence: input.evidence ?? [
      {
        sourceKind: 'verify',
        sourceRef: '.playbook/verify.json',
        pointer: 'failures[0]',
        summary: 'deterministic test evidence'
      }
    ],
    related: input.related ?? {}
  });

describe('compaction deterministic bucketing', () => {
  it('discards over-specific noisy candidates', () => {
    const candidate = makeCandidate({
      sourceKind: 'apply',
      subjectKind: 'artifact',
      subjectRef: 'tmp-file',
      trigger: 'ok',
      mechanism: 'tmp',
      response: 'noop',
      related: { modules: ['@zachariahredfield/playbook-engine'] }
    });

    const [entry] = bucketCompactionCandidates({ candidates: [candidate] });
    expect(entry.bucket).toBe('discard');
    expect(entry.reason).toContain('over-specific/noisy');
  });

  it('attaches when candidate is same pattern with different evidence', () => {
    const existing = makeCandidate({
      subjectRef: 'PB001',
      trigger: 'PB001',
      mechanism: 'run docs audit when governance docs change',
      invariant: 'docs governance surfaces must stay aligned',
      response: 'run node packages/cli/dist/main.js docs audit --json',
      related: { docs: ['docs/PLAYBOOK_PRODUCT_ROADMAP.md'], rules: ['docs.audit'] }
    });
    const incoming = makeCandidate({
      sourceKind: 'docs-audit',
      sourceRef: '.playbook/docs-audit.json',
      subjectKind: 'rule',
      subjectRef: 'PB001',
      trigger: 'PB001',
      mechanism: 'run docs audit when governance docs change',
      invariant: 'docs governance surfaces must stay aligned',
      response: 'run node packages/cli/dist/main.js docs audit --json',
      related: { docs: ['docs/commands/README.md'], rules: ['docs.audit'] }
    });

    const targets: BucketTarget[] = [{ targetId: 'pattern-docs-audit', origin: 'known-pattern', candidate: existing }];
    const [entry] = bucketCompactionCandidates({ candidates: [incoming], existingTargets: targets });
    expect(entry.bucket).toBe('attach');
    expect(entry.targetId).toBe('pattern-docs-audit');
    expect(entry.relation.evidenceOnlyDifference).toBe(true);
  });

  it('merges lexical variants with same mechanism and response', () => {
    const existing = makeCandidate({
      subjectRef: 'PB002',
      trigger: 'PB002',
      mechanism: 'use local built cli entrypoints before validation',
      invariant: 'branch accurate cli behavior',
      response: 'run pnpm -r build before node packages/cli/dist/main.js commands',
      related: { modules: ['@fawxzzy/playbook'] }
    });

    const incoming = makeCandidate({
      subjectRef: 'PB002-variant',
      trigger: 'PB002',
      mechanism: 'Use LOCAL built CLI entrypoints before validation!',
      invariant: 'branch accurate cli behavior',
      response: 'Run pnpm -r build before node packages/cli/dist/main.js commands',
      related: { modules: ['@fawxzzy/playbook'] }
    });

    const [entry] = bucketCompactionCandidates({
      candidates: [incoming],
      existingTargets: [{ targetId: 'pattern-cli-build', origin: 'known-pattern', candidate: existing }]
    });

    expect(entry.bucket).toBe('merge');
    expect(entry.targetId).toBe('pattern-cli-build');
    expect(entry.relation.mechanismMatch).toBe(true);
  });

  it('adds distinct high-value candidates even with low frequency when risk is high', () => {
    const existing = makeCandidate({
      subjectRef: 'PB003',
      trigger: 'rule-docs',
      mechanism: 'docs drift should be corrected during review',
      response: 'update docs',
      related: { riskSignals: ['medium drift'] }
    });

    const incoming = makeCandidate({
      sourceKind: 'analyze-pr',
      sourceRef: '.playbook/analyze-pr.json',
      subjectKind: 'module',
      subjectRef: 'packages/engine/src/security/guards.ts',
      trigger: 'security-boundary',
      mechanism: 'cross-repo remediation write attempted outside allowed repository boundary',
      response: 'block apply and require guarded remediation path review',
      related: { riskSignals: ['high security boundary risk'], modules: ['@zachariahredfield/playbook-engine'] }
    });

    const [entry] = bucketCompactionCandidates({
      candidates: [incoming],
      existingTargets: [{ targetId: 'pattern-docs', origin: 'known-pattern', candidate: existing }]
    });

    expect(entry.bucket).toBe('add');
    expect(entry.importance.riskLevel).toBe('high');
    expect(entry.importance.recurrenceSignal).toBe('weak');
  });

  it('keeps deterministic ordering and fingerprint stability', () => {
    const a = makeCandidate({ subjectRef: 'A', trigger: 'rule-a', mechanism: 'same mechanism content', response: 'run verify' });
    const b = makeCandidate({ subjectRef: 'B', trigger: 'rule-b', mechanism: 'different mechanism content', response: 'run plan' });

    const first = bucketCompactionCandidates({ candidates: [b, a] });
    const second = bucketCompactionCandidates({ candidates: [a, b] });

    expect(first).toEqual(second);
    expect(first.map((entry) => entry.candidateFingerprint)).toEqual(second.map((entry) => entry.candidateFingerprint));
  });

  it('distinguishes evidence-only difference from mechanism-level difference', () => {
    const base = makeCandidate({
      subjectRef: 'PB004',
      trigger: 'PB004',
      mechanism: 'verify before plan and apply then verify again',
      response: 'run verify plan apply verify',
      invariant: 'deterministic remediation loop'
    });

    const evidenceVariant = makeCandidate({
      subjectRef: 'PB004-ev',
      trigger: 'PB004',
      mechanism: 'verify before plan and apply then verify again',
      response: 'run verify plan apply verify',
      invariant: 'deterministic remediation loop',
      related: { docs: ['docs/PLAYBOOK_PRODUCT_ROADMAP.md'] }
    });

    const mechanismVariant = makeCandidate({
      subjectRef: 'PB004-mech',
      trigger: 'PB004',
      mechanism: 'skip verify and apply fixes directly based on intuition',
      response: 'run apply only',
      invariant: 'fast iteration',
      related: { docs: ['docs/PLAYBOOK_PRODUCT_ROADMAP.md'] }
    });

    const target: BucketTarget = { targetId: 'pattern-loop', origin: 'known-pattern', candidate: base };
    const evidenceRelation = assessRelation(evidenceVariant, target);
    const mechanismRelation = assessRelation(mechanismVariant, target);

    expect(evidenceRelation.evidenceOnlyDifference).toBe(true);
    expect(mechanismRelation.evidenceOnlyDifference).toBe(false);
    expect(mechanismRelation.relationKind).toBe('distinct');
  });

  it('importance assessment keeps high-risk low-frequency cases meaningful', () => {
    const candidate = makeCandidate({
      sourceKind: 'analyze-pr',
      subjectKind: 'module',
      subjectRef: 'packages/engine/src/security/index.ts',
      trigger: 'security',
      mechanism: 'critical boundary bypass observed in remediation executor',
      response: 'block remediation execution and require deterministic guard',
      related: { riskSignals: ['critical security guardrail break'] }
    });

    const importance = assessImportance({ candidate, recurrenceCount: 1 });
    expect(importance.riskLevel).toBe('high');
    expect(importance.recurrenceSignal).toBe('weak');
    expect(importance.actionabilityLevel).not.toBe('low');
  });
});
