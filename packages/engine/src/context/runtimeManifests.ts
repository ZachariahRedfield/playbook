import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SUBAPP_ROOTS = ['subapps', 'examples/subapps'] as const;
const RUNTIME_MANIFEST_RELATIVE_PATH = 'playbook/runtime-manifest.json' as const;

export const RUNTIME_MANIFESTS_RELATIVE_PATH = '.playbook/runtime-manifests.json' as const;
export const RUNTIME_MANIFESTS_SCHEMA_VERSION = '1.0' as const;

export type RuntimeManifestEntry = {
  subapp_path: string;
  subapp_id: string;
  app_identity: unknown;
  runtime_role: unknown;
  runtime_status: unknown;
  signal_groups: unknown;
  state_snapshot_types: unknown;
  bounded_action_families: unknown;
  receipt_families: unknown;
  integration_seams: unknown;
  external_truth_contract_ref?: unknown;
  source: {
    path: string;
    sha256: string;
  };
};

export type RuntimeManifestsArtifact = {
  schemaVersion: typeof RUNTIME_MANIFESTS_SCHEMA_VERSION;
  kind: 'runtime-manifests';
  manifests: RuntimeManifestEntry[];
};

const toPosix = (value: string): string => value.replace(/\\/gu, '/');

const hashContent = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRuntimeManifestEntry = (repoRoot: string, sourcePath: string): RuntimeManifestEntry | null => {
  const absolutePath = path.join(repoRoot, sourcePath);
  const content = fs.readFileSync(absolutePath, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const subappPath = toPosix(path.dirname(path.dirname(sourcePath)));
  const subappId = path.basename(subappPath);

  const entry: RuntimeManifestEntry = {
    subapp_path: subappPath,
    subapp_id: subappId,
    app_identity: parsed.app_identity,
    runtime_role: parsed.runtime_role,
    runtime_status: parsed.runtime_status,
    signal_groups: parsed.signal_groups,
    state_snapshot_types: parsed.state_snapshot_types,
    bounded_action_families: parsed.bounded_action_families,
    receipt_families: parsed.receipt_families,
    integration_seams: parsed.integration_seams,
    source: {
      path: sourcePath,
      sha256: hashContent(content)
    }
  };

  if ('external_truth_contract_ref' in parsed) {
    entry.external_truth_contract_ref = parsed.external_truth_contract_ref;
  }

  return entry;
};

const findRuntimeManifestFiles = (repoRoot: string): string[] => {
  const manifests: string[] = [];

  for (const root of SUBAPP_ROOTS) {
    const rootPath = path.join(repoRoot, root);
    if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
      continue;
    }

    for (const subapp of fs.readdirSync(rootPath).sort((left, right) => left.localeCompare(right))) {
      const manifestPath = path.join(root, subapp, RUNTIME_MANIFEST_RELATIVE_PATH);
      const absoluteManifestPath = path.join(repoRoot, manifestPath);
      if (!fs.existsSync(absoluteManifestPath) || !fs.statSync(absoluteManifestPath).isFile()) {
        continue;
      }
      manifests.push(toPosix(manifestPath));
    }
  }

  return manifests.sort((left, right) => left.localeCompare(right));
};

export const readRuntimeManifestsArtifact = (repoRoot: string): RuntimeManifestsArtifact => {
  const manifests = findRuntimeManifestFiles(repoRoot)
    .map((sourcePath) => readRuntimeManifestEntry(repoRoot, sourcePath))
    .filter((entry): entry is RuntimeManifestEntry => entry !== null)
    .sort((left, right) => left.source.path.localeCompare(right.source.path));

  return {
    schemaVersion: RUNTIME_MANIFESTS_SCHEMA_VERSION,
    kind: 'runtime-manifests',
    manifests
  };
};

const EMPTY_RUNTIME_MANIFESTS_ARTIFACT: RuntimeManifestsArtifact = {
  schemaVersion: RUNTIME_MANIFESTS_SCHEMA_VERSION,
  kind: 'runtime-manifests',
  manifests: []
};

export const readConsumedRuntimeManifestsArtifact = (repoRoot: string): RuntimeManifestsArtifact => {
  const artifactPath = path.join(repoRoot, RUNTIME_MANIFESTS_RELATIVE_PATH);
  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    return EMPTY_RUNTIME_MANIFESTS_ARTIFACT;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as unknown;
  } catch {
    return EMPTY_RUNTIME_MANIFESTS_ARTIFACT;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.manifests)) {
    return EMPTY_RUNTIME_MANIFESTS_ARTIFACT;
  }

  return {
    schemaVersion: RUNTIME_MANIFESTS_SCHEMA_VERSION,
    kind: 'runtime-manifests',
    manifests: parsed.manifests as RuntimeManifestEntry[]
  };
};

export const writeRuntimeManifestsArtifact = (repoRoot: string, artifact: RuntimeManifestsArtifact): string => {
  const targetPath = path.join(repoRoot, RUNTIME_MANIFESTS_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return targetPath;
};

export const materializeRuntimeManifestsArtifact = (repoRoot: string): RuntimeManifestsArtifact => {
  const artifact = readRuntimeManifestsArtifact(repoRoot);
  writeRuntimeManifestsArtifact(repoRoot, artifact);
  return artifact;
};
