import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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


  it('enriches plan and analyze-pr candidates with module context digests when available', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-compaction-'));
    const contextDir = path.join(tempRoot, '.playbook', 'context', 'modules');
    fs.mkdirSync(contextDir, { recursive: true });
    fs.writeFileSync(
      path.join(contextDir, 'engine.json'),
      JSON.stringify({
        module: { name: '@zachariahredfield/playbook-engine' },
        docs: ['docs/architecture/KNOWLEDGE_COMPACTION_PHASE.md'],
        tests: ['packages/engine/test/compaction.candidates.test.ts'],
        risk: { signals: ['high churn'] }
      })
    );

    const candidates = extractCompactionCandidates({
      repoRoot: tempRoot,
      index: {
        schemaVersion: '1.0',
        framework: 'node',
        language: 'typescript',
        architecture: 'modular-monolith',
        database: 'none',
        rules: [],
        modules: [{ name: '@zachariahredfield/playbook-engine', dependencies: [] }]
      },
      artifacts: {
        plan: {
          tasks: [{ id: 'task-1', ruleId: 'PB001', action: 'update docs', autoFix: false, file: 'packages/engine/src/index.ts' }]
        },
        analyzePr: {
          affectedModules: ['@zachariahredfield/playbook-engine'],
          risk: { signals: ['high churn'] },
          findings: [{ ruleId: 'pr-risk', message: 'touches many files', severity: 'warning', file: 'packages/engine/src/index.ts' }]
        }
      }
    });

    const planCandidate = candidates.find((entry) => entry.sourceKind === 'plan');
    const analyzeCandidate = candidates.find((entry) => entry.sourceKind === 'analyze-pr');
    expect(planCandidate?.related.modules).toEqual(['@zachariahredfield/playbook-engine']);
    expect(planCandidate?.related.docs).toEqual(['role:docs/architecture/KNOWLEDGE_COMPACTION_PHASE.md']);
    expect(analyzeCandidate?.related.tests).toEqual(['role:engine/test/compaction.candidates.test.ts']);
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
