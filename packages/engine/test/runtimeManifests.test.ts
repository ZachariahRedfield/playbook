import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { materializeRuntimeManifestsArtifact, readRuntimeManifestsArtifact, RUNTIME_MANIFESTS_RELATIVE_PATH } from '../src/context/runtimeManifests.js';

const roots: string[] = [];

const createRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-manifests-'));
  roots.push(root);
  return root;
};

const write = (root: string, relativePath: string, payload: unknown): void => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('runtime manifests artifact', () => {
  it('aggregates runtime manifests from subapps and examples/subapps deterministically', () => {
    const root = createRepo();
    write(root, 'subapps/zeta/playbook/runtime-manifest.json', {
      app_identity: { app_id: 'zeta' },
      runtime_role: 'core',
      runtime_status: 'integrated',
      signal_groups: ['sg-z'],
      state_snapshot_types: ['snapshot-z'],
      bounded_action_families: ['actions-z'],
      receipt_families: ['receipts-z'],
      integration_seams: ['seams-z'],
      external_truth_contract_ref: 'docs/contracts/zeta.md'
    });
    write(root, 'examples/subapps/alpha/playbook/runtime-manifest.json', {
      app_identity: { app_id: 'alpha' },
      runtime_role: 'example',
      runtime_status: 'integrated',
      signal_groups: ['sg-a'],
      state_snapshot_types: ['snapshot-a'],
      bounded_action_families: ['actions-a'],
      receipt_families: ['receipts-a'],
      integration_seams: ['seams-a']
    });

    const first = readRuntimeManifestsArtifact(root);
    const second = readRuntimeManifestsArtifact(root);

    expect(first.manifests).toHaveLength(2);
    expect(first.manifests.map((entry) => entry.source.path)).toEqual([
      'examples/subapps/alpha/playbook/runtime-manifest.json',
      'subapps/zeta/playbook/runtime-manifest.json'
    ]);
    expect(first.manifests[0]?.subapp_id).toBe('alpha');
    expect(first.manifests[1]?.external_truth_contract_ref).toBe('docs/contracts/zeta.md');
    expect(second.manifests).toEqual(first.manifests);
  });

  it('materializes .playbook/runtime-manifests.json', () => {
    const root = createRepo();
    write(root, 'subapps/proving-ground/playbook/runtime-manifest.json', {
      app_identity: { app_id: 'proving-ground' },
      runtime_role: 'proving-ground',
      runtime_status: 'integrated',
      signal_groups: ['signals'],
      state_snapshot_types: ['snapshot'],
      bounded_action_families: ['actions'],
      receipt_families: ['receipts'],
      integration_seams: ['seam']
    });

    const artifact = materializeRuntimeManifestsArtifact(root);
    const targetPath = path.join(root, RUNTIME_MANIFESTS_RELATIVE_PATH);

    expect(fs.existsSync(targetPath)).toBe(true);
    const diskPayload = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as { manifests: unknown[] };
    expect(diskPayload.manifests).toHaveLength(1);
    expect(artifact.manifests[0]?.subapp_path).toBe('subapps/proving-ground');
  });
});
