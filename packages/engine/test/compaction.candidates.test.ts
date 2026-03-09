import { describe, expect, it } from 'vitest';
import { buildCompactionCandidateArtifact, canonicalizeCandidate, createCandidateFingerprint, extractCompactionCandidates } from '../src/compaction/index.js';

describe('compaction candidate extraction', () => {
  it('canonicalizes noisy input into stable mechanism fields', () => {
    const candidate = canonicalizeCandidate({
      sourceKind: 'verify',
      sourceRef: '.playbook/verify.json',
      subjectKind: 'rule',
      subjectRef: 'PB001',
      trigger: 'PB001',
      mechanism: 'Failed at /workspace/playbook/packages/cli/src/main.ts on 2026-03-09T12:00:00Z hash=abcdef1234',
      evidence: [
        {
          sourceKind: 'verify',
          sourceRef: '.playbook/verify.json',
          pointer: 'failures[0]',
          summary: 'same failure 2026-03-09T12:00:00Z'
        }
      ],
      related: {
        docs: ['docs/PLAYBOOK_PRODUCT_ROADMAP.md'],
        tests: ['packages/engine/test/knowledge.compaction.test.ts']
      }
    });

    expect(candidate.canonical.normalizedMechanism).toContain('<workspace-path>');
    expect(candidate.canonical.normalizedMechanism).toContain('<timestamp>');
    expect(candidate.related.docs[0]).toBe('role:docs/PLAYBOOK_PRODUCT_ROADMAP.md');
    expect(candidate.canonical.normalizedSubject).toBe('rule:PB001');
  });

  it('produces stable fingerprints independent of key ordering', () => {
    const a = createCandidateFingerprint({ mechanism: 'same', trigger: 'one', related: { rules: ['PB001'] } });
    const b = createCandidateFingerprint({ related: { rules: ['PB001'] }, trigger: 'one', mechanism: 'same' });
    expect(a).toBe(b);
  });

  it('extracts deterministic candidates from verify and docs-audit artifacts', () => {
    const candidates = extractCompactionCandidates({
      repoRoot: process.cwd(),
      artifacts: {
        verify: {
          failures: [{ id: 'PB001', message: 'Missing tests', evidence: 'new command', fix: 'add tests' }]
        },
        docsAudit: {
          findings: [{ ruleId: 'docs.anchor', level: 'error', message: 'Missing anchor', path: 'docs/index.md' }]
        }
      }
    });

    expect(candidates.map((entry) => entry.sourceKind)).toEqual(['docs-audit', 'verify']);
    expect(candidates[1]).toMatchObject({
      subjectKind: 'rule',
      subjectRef: 'PB001'
    });
  });

  it('handles missing optional artifacts without guessing', () => {
    const candidates = extractCompactionCandidates({ repoRoot: process.cwd(), artifacts: {} });
    expect(candidates).toEqual([]);
  });

  it('builds deterministic artifact summary counts', () => {
    const candidates = extractCompactionCandidates({
      repoRoot: process.cwd(),
      artifacts: {
        plan: {
          tasks: [{ id: 'task-1', ruleId: 'PB001', action: 'add tests', autoFix: false, file: 'packages/engine/test/new.test.ts' }]
        },
        analyzePr: {
          affectedModules: ['@zachariahredfield/playbook-engine'],
          risk: { signals: ['high churn'] },
          findings: [{ ruleId: 'pr-risk', message: 'touches many files', severity: 'warning', file: 'packages/engine/src/index.ts' }]
        }
      }
    });

    const artifact = buildCompactionCandidateArtifact(candidates);
    expect(artifact.summary.total).toBe(2);
    expect(artifact.summary.bySourceKind.plan).toBe(1);
    expect(artifact.summary.bySourceKind['analyze-pr']).toBe(1);
  });
});
