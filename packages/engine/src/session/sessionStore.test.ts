import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SESSION_EVIDENCE_ARTIFACT_RELATIVE_PATH,
  initializeSession,
  sessionEvidenceArtifactPath,
  updateSession
} from './sessionStore.js';

const repos: string[] = [];

const createRepo = (): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'session-evidence-'));
  repos.push(repo);
  return repo;
};

const readSessionEvidence = (repoRoot: string): Record<string, unknown> => {
  const absolute = sessionEvidenceArtifactPath(repoRoot);
  return JSON.parse(fs.readFileSync(absolute, 'utf8')) as Record<string, unknown>;
};

afterEach(() => {
  while (repos.length > 0) {
    const repo = repos.pop();
    if (repo) {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  }
});

describe('session evidence artifact', () => {
  it('writes a deterministic session-evidence artifact path and payload for the same source state', () => {
    const repo = createRepo();
    initializeSession(repo);

    const artifactPath = path.join(repo, SESSION_EVIDENCE_ARTIFACT_RELATIVE_PATH);
    const first = fs.readFileSync(artifactPath, 'utf8');
    const second = fs.readFileSync(artifactPath, 'utf8');

    expect(first).toBe(second);
    expect(readSessionEvidence(repo).kind).toBe('playbook-session-evidence');
  });

  it('degrades gracefully when optional sources are missing', () => {
    const repo = createRepo();
    initializeSession(repo);

    const evidence = readSessionEvidence(repo);
    expect(evidence.run_refs).toEqual([]);
    expect(evidence.latest_receipt_refs).toEqual([]);
    expect(evidence.approval_governance_refs).toEqual([
      { artifact: '.playbook/rendezvous-manifest.json', present: false },
      { artifact: '.playbook/verify-preflight.json', present: false }
    ]);
  });

  it('reflects deterministic fingerprint drift and stale reasons after input changes', () => {
    const repo = createRepo();
    initializeSession(repo, { selectedRunId: 'missing-run' });

    const planPath = path.join(repo, '.playbook', 'plan.json');
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(planPath, `${JSON.stringify({ tasks: [{ id: 'task-1' }] }, null, 2)}\n`, 'utf8');

    const runPath = path.join(repo, '.playbook', 'execution-runs', 'run-1.json');
    fs.mkdirSync(path.dirname(runPath), { recursive: true });
    fs.writeFileSync(
      runPath,
      `${JSON.stringify({
        id: 'run-1',
        created_at: '2026-01-01T00:00:00.000Z',
        evidence: [{ ref: '.playbook/execution-receipt.json' }]
      }, null, 2)}\n`,
      'utf8'
    );

    updateSession(repo, { currentStep: 'verify' });
    const baseline = readSessionEvidence(repo);
    const baselineFingerprint = ((baseline.invalidation as Record<string, unknown>).current_input_fingerprint as string);

    fs.writeFileSync(planPath, `${JSON.stringify({ tasks: [{ id: 'task-2' }] }, null, 2)}\n`, 'utf8');
    updateSession(repo, { currentStep: 'plan' });
    const drifted = readSessionEvidence(repo);
    const invalidation = drifted.invalidation as Record<string, unknown>;

    expect(invalidation.state).toBe('drifted');
    expect(invalidation.previous_input_fingerprint).toBe(baselineFingerprint);
    expect((invalidation.drifted_sources as string[])).toContain('.playbook/plan.json');
    expect((invalidation.stale_reasons as string[])).toContain('selected-run-missing');
    expect(drifted.latest_receipt_refs).toEqual(['.playbook/execution-receipt.json']);
  });
});
