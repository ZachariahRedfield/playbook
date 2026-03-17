import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { emitJsonOutput, writeJsonArtifactAbsolute } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';

type ObserverOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type ObserverRepoEntry = {
  id: string;
  name: string;
  root: string;
  status: 'connected';
  artifactsRoot: string;
  tags: string[];
};

type ObserverRepoRegistry = {
  schemaVersion: '1.0';
  kind: 'repo-registry';
  repos: ObserverRepoEntry[];
};

const OBSERVER_REPO_REGISTRY_RELATIVE_PATH = '.playbook/observer/repos.json' as const;

const printObserverHelp = (): void => {
  console.log(`Usage: playbook observer repo <add|list|remove> [options]

Manage a deterministic local observer repo registry.

Subcommands:
  repo add <path> [--id <id>] [--tag <tag>]
  repo list
  repo remove <id>

Options:
  --json                       Print machine-readable JSON output
  --help                       Show help`);
};

const readOptionValue = (args: string[], optionName: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) {
    return args[exactIndex + 1] ?? null;
  }

  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  if (!prefixed) {
    return null;
  }

  return prefixed.slice(optionName.length + 1) || null;
};

const readOptionValues = (args: string[], optionName: string): string[] => {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== optionName) {
      continue;
    }

    const value = args[index + 1];
    if (value && !value.startsWith('-')) {
      values.push(value);
    }
  }

  return values;
};

const stableRepoId = (repoRoot: string, repoName: string): string => {
  const digest = crypto.createHash('sha256').update(repoRoot, 'utf8').digest('hex').slice(0, 12);
  return `${repoName}-${digest}`;
};

const normalizeRegistry = (registry: ObserverRepoRegistry): ObserverRepoRegistry => ({
  schemaVersion: '1.0',
  kind: 'repo-registry',
  repos: [...registry.repos].sort((left, right) => left.id.localeCompare(right.id))
});

const defaultRegistry = (): ObserverRepoRegistry => ({
  schemaVersion: '1.0',
  kind: 'repo-registry',
  repos: []
});

const registryPath = (cwd: string): string => path.join(cwd, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);

const readRegistry = (cwd: string): ObserverRepoRegistry => {
  const artifactPath = registryPath(cwd);
  if (!fs.existsSync(artifactPath)) {
    return defaultRegistry();
  }

  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as Partial<ObserverRepoRegistry>;
  if (parsed.schemaVersion !== '1.0' || parsed.kind !== 'repo-registry' || !Array.isArray(parsed.repos)) {
    throw new Error(`playbook observer: invalid registry artifact at ${OBSERVER_REPO_REGISTRY_RELATIVE_PATH}`);
  }

  return normalizeRegistry({
    schemaVersion: '1.0',
    kind: 'repo-registry',
    repos: parsed.repos
      .map((entry) => ({
        id: String(entry.id ?? ''),
        name: String(entry.name ?? ''),
        root: String(entry.root ?? ''),
        status: 'connected' as const,
        artifactsRoot: String(entry.artifactsRoot ?? ''),
        tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag)).sort((left, right) => left.localeCompare(right)) : []
      }))
      .filter((entry) => entry.id.length > 0)
  });
};

const writeRegistry = (cwd: string, registry: ObserverRepoRegistry): void => {
  writeJsonArtifactAbsolute(registryPath(cwd), normalizeRegistry(registry) as unknown as Record<string, unknown>, 'observer', { envelope: false });
};

const emitObserverPayload = (cwd: string, options: ObserverOptions, payload: Record<string, unknown>, textMessage: string): void => {
  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'observer', payload });
    return;
  }

  if (!options.quiet) {
    console.log(textMessage);
  }
};

const nonFlagPositionals = (args: string[]): string[] => {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith('-')) {
      if (value === '--id' || value === '--tag') {
        index += 1;
      }
      continue;
    }

    values.push(value);
  }

  return values;
};

export const runObserver = async (cwd: string, args: string[], options: ObserverOptions): Promise<number> => {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printObserverHelp();
    return args.length === 0 ? ExitCode.Failure : ExitCode.Success;
  }

  const [scope, action] = args;
  if (scope !== 'repo' || !['add', 'list', 'remove'].includes(action ?? '')) {
    const message = 'playbook observer: use `playbook observer repo <add|list|remove>`.';
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'observer', payload: { schemaVersion: '1.0', command: 'observer', error: message } });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  const registry = readRegistry(cwd);

  try {
    if (action === 'list') {
      emitObserverPayload(
        cwd,
        options,
        { schemaVersion: '1.0', command: 'observer-repo-list', registry },
        registry.repos.length === 0 ? 'No connected observer repositories.' : registry.repos.map((repo) => `${repo.id} ${repo.root}`).join('\n')
      );
      return ExitCode.Success;
    }

    if (action === 'add') {
      const pathArg = nonFlagPositionals(args.slice(2))[0];
      if (!pathArg) {
        throw new Error('playbook observer repo add: missing <path> argument');
      }

      const root = path.resolve(cwd, pathArg);
      const rootStat = fs.existsSync(root) ? fs.statSync(root) : null;
      if (!rootStat || !rootStat.isDirectory()) {
        throw new Error(`playbook observer repo add: repository root does not exist: ${root}`);
      }

      const artifactsRoot = path.join(root, '.playbook');
      if (fs.existsSync(artifactsRoot)) {
        const artifactsStat = fs.statSync(artifactsRoot);
        if (!artifactsStat.isDirectory()) {
          throw new Error(`playbook observer repo add: expected directory at ${artifactsRoot}`);
        }
      }

      const repoName = path.basename(root);
      const requestedId = readOptionValue(args, '--id');
      const repoId = requestedId && requestedId.trim().length > 0 ? requestedId.trim() : stableRepoId(root, repoName);
      const duplicateId = registry.repos.find((repo) => repo.id === repoId);
      if (duplicateId) {
        throw new Error(`playbook observer repo add: duplicate id "${repoId}"`);
      }

      const duplicateRoot = registry.repos.find((repo) => repo.root === root);
      if (duplicateRoot) {
        throw new Error(`playbook observer repo add: duplicate root "${root}" already registered as "${duplicateRoot.id}"`);
      }

      const tags = [...new Set(readOptionValues(args, '--tag').map((tag) => tag.trim()).filter((tag) => tag.length > 0))].sort((left, right) => left.localeCompare(right));
      const entry: ObserverRepoEntry = {
        id: repoId,
        name: repoName,
        root,
        status: 'connected',
        artifactsRoot,
        tags
      };

      const nextRegistry = normalizeRegistry({ ...registry, repos: [...registry.repos, entry] });
      writeRegistry(cwd, nextRegistry);

      emitObserverPayload(cwd, options, { schemaVersion: '1.0', command: 'observer-repo-add', repo: entry, registry: nextRegistry }, `Connected observer repo ${entry.id}`);
      return ExitCode.Success;
    }

    const removeId = nonFlagPositionals(args.slice(2))[0];
    if (!removeId) {
      throw new Error('playbook observer repo remove: missing <id> argument');
    }

    const existing = registry.repos.find((repo) => repo.id === removeId);
    if (!existing) {
      throw new Error(`playbook observer repo remove: unknown id "${removeId}"`);
    }

    const nextRegistry = normalizeRegistry({ ...registry, repos: registry.repos.filter((repo) => repo.id !== removeId) });
    writeRegistry(cwd, nextRegistry);
    emitObserverPayload(cwd, options, { schemaVersion: '1.0', command: 'observer-repo-remove', removedId: removeId, registry: nextRegistry }, `Removed observer repo ${removeId}`);
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'observer', payload: { schemaVersion: '1.0', command: 'observer', error: message } });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};

export { OBSERVER_REPO_REGISTRY_RELATIVE_PATH };
