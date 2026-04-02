import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RUNTIME_MANIFESTS_RELATIVE_PATH, readConsumedRuntimeManifestsArtifact } from './runtimeManifests.js';

const repos: string[] = [];

const createRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-manifests-'));
  repos.push(root);
  return root;
};

afterEach(() => {
  while (repos.length > 0) {
    const root = repos.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('readConsumedRuntimeManifestsArtifact', () => {
  it('returns an empty deterministic artifact when aggregate does not exist', () => {
    const repo = createRepo();
    expect(readConsumedRuntimeManifestsArtifact(repo)).toEqual({
      schemaVersion: '1.0',
      kind: 'runtime-manifests',
      manifests: []
    });
  });

  it('returns the consumed aggregate manifests without reinterpretation', () => {
    const repo = createRepo();
    const artifactPath = path.join(repo, RUNTIME_MANIFESTS_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(
      artifactPath,
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

    const artifact = readConsumedRuntimeManifestsArtifact(repo);
    expect(artifact.manifests).toHaveLength(1);
    expect(artifact.manifests[0]?.integration_seams).toEqual(['repo-truth-pack-ingest-v1']);
    expect(artifact.manifests[0]?.external_truth_contract_ref).toBe('docs/CONSUMER_INTEGRATION_CONTRACT.md');
  });
});
