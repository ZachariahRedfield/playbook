import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runContext } from './context.js';

const repos: string[] = [];

const createRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'context-'));
  repos.push(root);
  return root;
};

afterEach(() => {
  while (repos.length > 0) {
    const root = repos.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('runContext', () => {
  it('prints JSON output with required fields', async () => {
    const repo = createRepo();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runContext(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;

    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.command).toBe('context');
    expect(payload.architecture).toBe('modular-monolith');
    expect(payload.workflow).toEqual(['verify', 'plan', 'apply']);

    const repositoryIntelligence = payload.repositoryIntelligence as Record<string, unknown>;
    expect(repositoryIntelligence.artifact).toBe('.playbook/repo-index.json');
    expect(repositoryIntelligence.commands).toEqual(['index', 'query', 'ask', 'explain']);

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

    const cli = payload.cli as Record<string, unknown>;
    expect(Array.isArray(cli.commands)).toBe(true);
    expect(cli.commands).toContain('context');

    logSpy.mockRestore();
  });

  it('consumes runtime-manifests aggregate artifact when present', async () => {
    const repo = createRepo();
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'runtime-manifests.json'),
      `${JSON.stringify({
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
      }, null, 2)}\n`,
      'utf8'
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runContext(repo, { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const runtimeManifests = payload.runtimeManifests as Record<string, unknown>;
    expect(runtimeManifests.manifestsCount).toBe(1);
    const manifests = runtimeManifests.manifests as Array<Record<string, unknown>>;
    expect(manifests[0]?.external_truth_contract_ref).toBe('docs/CONSUMER_INTEGRATION_CONTRACT.md');
    expect(manifests[0]?.bounded_action_families).toEqual(['repo-truth-pack-ingest']);

    logSpy.mockRestore();
  });

  it('registers the context command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'context');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Print deterministic CLI and architecture context for tools and agents');
  });
});
