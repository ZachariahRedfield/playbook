import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { generateRepositoryHealth } from '../src/index.js';

const createRepo = (name: string): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  execSync('git init', { cwd: repo, stdio: 'ignore' });
  execSync('git config user.email "playbook@example.com"', { cwd: repo });
  execSync('git config user.name "Playbook Test"', { cwd: repo });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'doctor-memory-test' }, null, 2));
  return repo;
};

const writeJson = (repo: string, relativePath: string, payload: unknown): void => {
  const fullPath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

describe('doctor memory diagnostics', () => {
  it('reports public missing-artifacts warning when memory artifacts are not initialized', () => {
    const repo = createRepo('playbook-doctor-memory-absent');
    const memoryRoot = path.join(repo, '.playbook', 'memory');

    expect(fs.existsSync(memoryRoot)).toBe(false);

    const report = generateRepositoryHealth(repo);

    expect(report.memoryDiagnostics.findings).toEqual([
      {
        code: 'memory-artifacts-missing',
        severity: 'warning',
        message: 'Missing required memory artifacts: .playbook/memory/index.json, .playbook/memory/candidates.json',
        recommendation: 'Regenerate missing memory artifacts before relying on replay or promotion diagnostics.'
      }
    ]);
    expect(report.memoryDiagnostics.suggestions).toEqual([
      {
        id: 'PB015',
        title: 'Repair memory artifact integrity',
        actions: [
          'Rebuild .playbook/memory/index.json',
          'Regenerate .playbook/memory/candidates.json',
          'Validate JSON artifacts before commit'
        ]
      }
    ]);
  });

  it('reports healthy lifecycle with deterministic code when artifacts are valid', () => {
    const repo = createRepo('playbook-doctor-memory-healthy');

    writeJson(repo, '.playbook/memory/index.json', {
      schemaVersion: '1.0',
      events: [{ eventId: 'evt-1', relativePath: '.playbook/memory/events/evt-1.json' }]
    });
    writeJson(repo, '.playbook/memory/events/evt-1.json', {
      schemaVersion: '1.0',
      kind: 'verify_run',
      eventInstanceId: 'evt-1',
      eventFingerprint: 'fp-1',
      createdAt: new Date().toISOString(),
      repoRevision: 'HEAD',
      sources: [{ type: 'verify', reference: 'verify.json' }],
      subjectModules: ['doctor'],
      ruleIds: ['PB001'],
      riskSummary: { level: 'low', signals: [] },
      outcome: { status: 'success', summary: 'ok' },
      salienceInputs: {}
    });
    writeJson(repo, '.playbook/memory/candidates.json', {
      candidates: [
        {
          candidateId: 'cand-1',
          lastSeenAt: new Date().toISOString(),
          provenance: [{ eventId: 'evt-1', sourcePath: '.playbook/memory/events/evt-1.json', fingerprint: 'fp-1' }]
        }
      ]
    });
    writeJson(repo, '.playbook/memory/knowledge/decisions.json', {
      entries: [
        {
          knowledgeId: 'k-1',
          status: 'active',
          supersededBy: [],
          provenance: [{ eventId: 'evt-1', sourcePath: '.playbook/memory/events/evt-1.json', fingerprint: 'fp-1' }]
        }
      ]
    });

    const report = generateRepositoryHealth(repo);

    expect(report.memoryDiagnostics.findings).toEqual([
      {
        code: 'memory-lifecycle-healthy',
        severity: 'info',
        message: 'Memory replay and promoted-knowledge lifecycle diagnostics are healthy.',
        recommendation: 'Continue replay-before-promotion and salience-gated promotion workflows.'
      }
    ]);
    expect(report.memoryDiagnostics.suggestions).toEqual([]);
  });

  it('reports deterministic warning codes for hoarding, supersession, replay, and provenance gaps', () => {
    const repo = createRepo('playbook-doctor-memory-risk');
    const staleDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    writeJson(repo, '.playbook/memory/index.json', {
      schemaVersion: '1.0',
      events: [{ eventId: 'evt-1', relativePath: '.playbook/memory/events/evt-1.json' }]
    });

    writeJson(repo, '.playbook/memory/candidates.json', {
      candidates: Array.from({ length: 26 }, (_, index) => ({
        candidateId: `cand-${index}`,
        lastSeenAt: staleDate,
        provenance: [
          {
            eventId: `evt-${index + 2}`,
            sourcePath: '.playbook/memory/events/does-not-exist.json',
            fingerprint: `fp-${index}`
          }
        ]
      }))
    });

    writeJson(repo, '.playbook/memory/knowledge/patterns.json', {
      entries: [
        {
          knowledgeId: 'k-superseded',
          status: 'superseded',
          supersededBy: [],
          provenance: []
        }
      ]
    });

    const report = generateRepositoryHealth(repo);
    const codes = report.memoryDiagnostics.findings.map((entry) => entry.code);

    expect(codes).toEqual([
      'candidate-hoarding-risk',
      'superseded-knowledge-lingering',
      'replay-output-inconsistent',
      'promoted-knowledge-provenance-gap'
    ]);
    expect(report.memoryDiagnostics.suggestions.map((entry) => entry.id)).toEqual(['PB016', 'PB017', 'PB018']);
  });

  it('reports malformed artifact diagnostics with deterministic message', () => {
    const repo = createRepo('playbook-doctor-memory-malformed');
    const malformed = path.join(repo, '.playbook/memory/candidates.json');
    fs.mkdirSync(path.dirname(malformed), { recursive: true });
    fs.writeFileSync(malformed, '{ invalid-json', 'utf8');

    const report = generateRepositoryHealth(repo);
    const malformedFinding = report.memoryDiagnostics.findings.find((entry) => entry.code === 'memory-artifacts-malformed');

    expect(malformedFinding).toEqual({
      code: 'memory-artifacts-malformed',
      severity: 'warning',
      message: 'Malformed memory artifacts detected: .playbook/memory/candidates.json',
      recommendation: 'Repair malformed JSON memory artifacts to restore deterministic replay and lifecycle diagnostics.'
    });
  });
});
