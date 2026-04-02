import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runAiContext } from './aiContext.js';

const repos: string[] = [];

const createRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-context-'));
  repos.push(root);
  return root;
};

afterEach(() => {
  while (repos.length > 0) {
    const root = repos.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('runAiContext', () => {
  it('prints JSON output with required AI bootstrap fields', async () => {
    const repo = createRepo();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAiContext(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;

    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.command).toBe('ai-context');

    const repoMeta = payload.repo as Record<string, unknown>;
    expect(repoMeta.architecture).toBe('modular-monolith');
    expect(repoMeta.localCliPreferred).toBe(true);

    const controlPlaneArtifacts = payload.controlPlaneArtifacts as Record<string, unknown>;
    expect(controlPlaneArtifacts.policyEvaluation).toBe('.playbook/policy-evaluation.json');
    expect(controlPlaneArtifacts.policyApplyResult).toBe('.playbook/policy-apply-result.json');
    expect(controlPlaneArtifacts.session).toBe('.playbook/session.json');
    expect(controlPlaneArtifacts.cycleState).toBe('.playbook/cycle-state.json');
    expect(controlPlaneArtifacts.cycleHistory).toBe('.playbook/cycle-history.json');
    expect(controlPlaneArtifacts.improvementCandidates).toBe('.playbook/improvement-candidates.json');
    expect(controlPlaneArtifacts.prReview).toBe('.playbook/pr-review.json');

    const runtimeManifests = payload.runtimeManifests as Record<string, unknown>;
    expect(runtimeManifests.artifact).toBe('.playbook/runtime-manifests.json');
    expect(runtimeManifests.manifestsCount).toBe(0);
    expect(runtimeManifests.manifests).toEqual([]);

    const operatingLadder = payload.operatingLadder as Record<string, unknown>;
    expect(operatingLadder.preferredCommandOrder).toEqual([
      'ai-context',
      'ai-contract',
      'context',
      'index',
      'query',
      'explain',
      'ask --repo-context',
      'rules',
      'verify',
      'direct-file-inspection-if-needed'
    ]);

    const guidance = payload.guidance as Record<string, unknown>;
    expect(guidance.preferPlaybookCommands).toBe(true);
    const memoryCommandFamily = guidance.memoryCommandFamily as Record<string, unknown>;
    expect(memoryCommandFamily.available).toBe(true);
    expect(memoryCommandFamily.preferredCommands).toEqual([
      'memory events --json',
      'memory knowledge --json',
      'memory candidates --json'
    ]);
    expect(guidance.promotedKnowledgeGuidance).toBeTruthy();
    expect(guidance.candidateKnowledgeGuidance).toBeTruthy();

    logSpy.mockRestore();
  });

  it('consumes existing runtime-manifests artifact without mutating it', async () => {
    const repo = createRepo();
    const artifactPath = path.join(repo, '.playbook', 'runtime-manifests.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    const artifact = {
      schemaVersion: '1.0',
      kind: 'runtime-manifests',
      manifests: [
        {
          subapp_path: 'subapps/proving-ground-app',
          subapp_id: 'proving-ground-app',
          app_identity: { app_id: 'proving-ground-app' },
          runtime_role: 'integration-proving-ground',
          runtime_status: 'integrated',
          signal_groups: ['repo-truth-pack-signals'],
          state_snapshot_types: ['subapp-truth-pack-context-v1'],
          bounded_action_families: ['repo-truth-pack-ingest'],
          receipt_families: ['repo-truth-pack-ingest-receipts'],
          integration_seams: ['repo-truth-pack-ingest-v1'],
          external_truth_contract_ref: 'docs/CONSUMER_INTEGRATION_CONTRACT.md',
          source: {
            path: 'subapps/proving-ground-app/playbook/runtime-manifest.json',
            sha256: 'abc'
          }
        }
      ]
    };
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    const before = fs.readFileSync(artifactPath, 'utf8');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAiContext(repo, { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const runtimeManifests = payload.runtimeManifests as Record<string, unknown>;
    expect(runtimeManifests.manifestsCount).toBe(1);
    const manifests = runtimeManifests.manifests as Array<Record<string, unknown>>;
    expect(manifests[0]?.receipt_families).toEqual(['repo-truth-pack-ingest-receipts']);
    expect(manifests[0]?.external_truth_contract_ref).toBe('docs/CONSUMER_INTEGRATION_CONTRACT.md');
    expect(fs.readFileSync(artifactPath, 'utf8')).toBe(before);

    logSpy.mockRestore();
  });

  it('produces deterministic JSON ordering/stability', async () => {
    const repo = createRepo();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const firstExit = await runAiContext(repo, { format: 'json', quiet: false });
    const first = String(logSpy.mock.calls[0]?.[0]);

    logSpy.mockClear();
    const secondExit = await runAiContext(repo, { format: 'json', quiet: false });
    const second = String(logSpy.mock.calls[0]?.[0]);

    expect(firstExit).toBe(ExitCode.Success);
    expect(secondExit).toBe(ExitCode.Success);
    expect(second).toBe(first);

    logSpy.mockRestore();
  });

  it('registers the ai-context command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'ai-context');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Print deterministic AI bootstrap context for Playbook-aware agents');
  });
});
