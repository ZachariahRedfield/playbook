import { describe, expect, it } from 'vitest';
import type { RendezvousManifestArtifactObservations } from '@zachariahredfield/playbook-core';
import { buildRendezvousManifest, evaluateRendezvousManifest } from '../src/testAutofix/rendezvousManifest.js';

const baseInput = {
  generatedAt: '2026-03-26T00:00:00.000Z',
  baseSha: 'abc123',
  remediationId: 'sig-snapshot-drift',
  requiredArtifactIds: ['failure-log', 'test-triage', 'test-fix-plan', 'apply-result', 'test-autofix', 'remediation-status'] as const,
  artifacts: {
    'failure-log': { artifactId: 'failure-log', path: '.playbook/failure.log', sha256: 'h-failure', verification: 'passed' },
    'test-triage': { artifactId: 'test-triage', path: '.playbook/test-triage.json', sha256: 'h-triage', verification: 'passed' },
    'test-fix-plan': { artifactId: 'test-fix-plan', path: '.playbook/test-fix-plan.json', sha256: 'h-plan', verification: 'passed' },
    'apply-result': { artifactId: 'apply-result', path: '.playbook/test-autofix-apply.json', sha256: 'h-apply', verification: 'passed' },
    'test-autofix': { artifactId: 'test-autofix', path: '.playbook/test-autofix.json', sha256: 'h-autofix', verification: 'passed' },
    'remediation-status': { artifactId: 'remediation-status', path: '.playbook/remediation-status.json', sha256: 'h-status', verification: 'passed' }
  },
  blockers: [],
  confidence: 0.92,
  staleOnShaChange: true
};

const observations: RendezvousManifestArtifactObservations = {
  'failure-log': { artifactId: 'failure-log', path: '.playbook/failure.log', sha256: 'h-failure', verification: 'passed' },
  'test-triage': { artifactId: 'test-triage', path: '.playbook/test-triage.json', sha256: 'h-triage', verification: 'passed' },
  'test-fix-plan': { artifactId: 'test-fix-plan', path: '.playbook/test-fix-plan.json', sha256: 'h-plan', verification: 'passed' },
  'apply-result': { artifactId: 'apply-result', path: '.playbook/test-autofix-apply.json', sha256: 'h-apply', verification: 'passed' },
  'test-autofix': { artifactId: 'test-autofix', path: '.playbook/test-autofix.json', sha256: 'h-autofix', verification: 'passed' },
  'remediation-status': { artifactId: 'remediation-status', path: '.playbook/remediation-status.json', sha256: 'h-status', verification: 'passed' }
};

describe('rendezvous manifest', () => {
  it('builds deterministically for the same inputs', () => {
    const first = buildRendezvousManifest(baseInput);
    const second = buildRendezvousManifest(baseInput);

    expect(first).toEqual(second);
  });

  it('blocks release when required artifacts are missing', () => {
    const { ['apply-result']: _removed, ...artifactsWithoutApply } = baseInput.artifacts;
    const manifest = buildRendezvousManifest({
      ...baseInput,
      artifacts: artifactsWithoutApply
    });

    const result = evaluateRendezvousManifest(manifest, { currentSha: 'abc123', observedArtifacts: observations });
    expect(result.state).toBe('incomplete');
    expect(result.releaseReady).toBe(false);
    expect(result.missingArtifactIds).toContain('apply-result');
  });

  it('blocks release when base sha is stale', () => {
    const manifest = buildRendezvousManifest(baseInput);

    const result = evaluateRendezvousManifest(manifest, { currentSha: 'def456', observedArtifacts: observations });
    expect(result.state).toBe('stale');
    expect(result.releaseReady).toBe(false);
    expect(result.stale).toBe(true);
  });

  it('blocks release when observed hashes conflict with manifest hashes', () => {
    const manifest = buildRendezvousManifest(baseInput);
    const result = evaluateRendezvousManifest(manifest, {
      currentSha: 'abc123',
      observedArtifacts: {
        ...observations,
        'test-fix-plan': { ...observations['test-fix-plan']!, sha256: 'different-hash' }
      }
    });

    expect(result.state).toBe('conflicted');
    expect(result.releaseReady).toBe(false);
    expect(result.conflictingArtifactIds).toEqual(['test-fix-plan']);
  });

  it('marks manifest release-ready when required artifacts exist, hashes are stable, and verification passed', () => {
    const manifest = buildRendezvousManifest(baseInput);

    const result = evaluateRendezvousManifest(manifest, { currentSha: 'abc123', observedArtifacts: observations });
    expect(result.state).toBe('complete');
    expect(result.releaseReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});
