import fs from 'node:fs';
import path from 'node:path';

export const OBSERVER_REPO_REGISTRY_RELATIVE_PATH = '.playbook/observer/registry.json' as const;
export const OBSERVER_SNAPSHOT_RELATIVE_PATH = '.playbook/observer/snapshot.json' as const;

const KNOWN_ARTIFACT_SPECS = [
  { key: 'cycleState', relativePath: '.playbook/cycle-state.json', expectedKind: 'cycle-state' },
  { key: 'cycleHistory', relativePath: '.playbook/cycle-history.json', expectedKind: 'cycle-history' },
  { key: 'policyEvaluation', relativePath: '.playbook/policy-evaluation.json', expectedKind: 'policy-evaluation' },
  { key: 'policyApplyResult', relativePath: '.playbook/policy-apply-result.json', expectedKind: 'policy-apply-result' },
  { key: 'prReview', relativePath: '.playbook/pr-review.json', expectedKind: 'pr-review' },
  { key: 'session', relativePath: '.playbook/session.json', expectedKind: 'session' }
] as const;

type KnownArtifactSpec = (typeof KNOWN_ARTIFACT_SPECS)[number];
export type ObserverArtifactKey = KnownArtifactSpec['key'];

export type ObserverRepoRegistryEntry = {
  repo_id: string;
  repo_name: string;
  repo_path: string;
};

export type ObserverRepoRegistry = {
  schemaVersion: '1.0';
  kind: 'observer-repo-registry';
  repos: ObserverRepoRegistryEntry[];
};

export type ObserverRepoWarning = {
  artifact: ObserverArtifactKey;
  code: 'missing' | 'malformed' | 'invalid-kind';
  message: string;
};

export type ObserverRepoSnapshot = {
  repo_id: string;
  repo_name: string;
  artifacts: Record<ObserverArtifactKey, unknown | null>;
  status: 'ok' | 'warning';
  warnings: ObserverRepoWarning[];
};

export type ObserverSnapshot = {
  schemaVersion: '1.0';
  kind: 'observer-snapshot';
  repos: ObserverRepoSnapshot[];
};

const readJson = <T>(targetPath: string): T => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;

const sortRepos = (repos: ObserverRepoRegistryEntry[]): ObserverRepoRegistryEntry[] =>
  [...repos].sort(
    (left, right) =>
      left.repo_id.localeCompare(right.repo_id) ||
      left.repo_name.localeCompare(right.repo_name) ||
      left.repo_path.localeCompare(right.repo_path)
  );

const ingestArtifact = (repoPath: string, spec: KnownArtifactSpec): { value: unknown | null; warning: ObserverRepoWarning | null } => {
  const artifactPath = path.join(repoPath, spec.relativePath);
  if (!fs.existsSync(artifactPath)) {
    return {
      value: null,
      warning: {
        artifact: spec.key,
        code: 'missing',
        message: `Missing governed artifact at ${spec.relativePath}.`
      }
    };
  }

  try {
    const value = readJson<Record<string, unknown>>(artifactPath);
    const kind = typeof value.kind === 'string' ? value.kind : null;
    if (kind !== null && kind !== spec.expectedKind) {
      return {
        value: null,
        warning: {
          artifact: spec.key,
          code: 'invalid-kind',
          message: `Invalid kind for ${spec.relativePath}; expected "${spec.expectedKind}" but received "${kind}".`
        }
      };
    }

    return { value, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      value: null,
      warning: {
        artifact: spec.key,
        code: 'malformed',
        message: `Malformed JSON at ${spec.relativePath}: ${message}`
      }
    };
  }
};

export const readObserverRepoRegistry = (cwd: string): ObserverRepoRegistry => {
  const targetPath = path.join(cwd, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`playbook observer: missing registry at ${OBSERVER_REPO_REGISTRY_RELATIVE_PATH}.`);
  }

  const registry = readJson<ObserverRepoRegistry>(targetPath);
  if (registry.kind !== 'observer-repo-registry' || registry.schemaVersion !== '1.0' || !Array.isArray(registry.repos)) {
    throw new Error(`playbook observer: invalid registry contract at ${OBSERVER_REPO_REGISTRY_RELATIVE_PATH}.`);
  }

  return registry;
};

export const buildObserverSnapshot = (registry: ObserverRepoRegistry): ObserverSnapshot => {
  const repos = sortRepos(registry.repos).map((repo) => {
    const artifacts: Record<ObserverArtifactKey, unknown | null> = {
      cycleState: null,
      cycleHistory: null,
      policyEvaluation: null,
      policyApplyResult: null,
      prReview: null,
      session: null
    };

    const warnings: ObserverRepoWarning[] = [];
    for (const spec of KNOWN_ARTIFACT_SPECS) {
      const ingested = ingestArtifact(repo.repo_path, spec);
      artifacts[spec.key] = ingested.value;
      if (ingested.warning) warnings.push(ingested.warning);
    }

    return {
      repo_id: repo.repo_id,
      repo_name: repo.repo_name,
      artifacts,
      status: (warnings.length === 0 ? 'ok' : 'warning') as 'ok' | 'warning',
      warnings
    };
  });

  return {
    schemaVersion: '1.0',
    kind: 'observer-snapshot',
    repos
  };
};

export const buildObserverSnapshotFromRegistry = (cwd: string): ObserverSnapshot => buildObserverSnapshot(readObserverRepoRegistry(cwd));

export const writeObserverSnapshotArtifact = (cwd: string, artifact: ObserverSnapshot): string => {
  const targetPath = path.join(cwd, OBSERVER_SNAPSHOT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return targetPath;
};

export const readObserverSnapshotArtifact = (cwd: string): ObserverSnapshot => {
  const targetPath = path.join(cwd, OBSERVER_SNAPSHOT_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`playbook observer: missing snapshot artifact at ${OBSERVER_SNAPSHOT_RELATIVE_PATH}.`);
  }
  return readJson<ObserverSnapshot>(targetPath);
};
