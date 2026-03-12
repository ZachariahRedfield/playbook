import fs from 'node:fs';
import path from 'node:path';
import { discoverWorkspaces, scanWorkspaceDeps } from '../diagrams/scanWorkspaceDeps.js';
import { parsePlaybookIgnore, isPlaybookIgnored } from './playbookIgnore.js';

export type RepositoryDependencyEdge = {
  from: string;
  to: string;
  type: 'workspace-manifest' | 'source-import' | 'root-manifest';
};

const IMPORT_RE = /from\s+['\"]([^'\"]+)['\"]|import\(['\"]([^'\"]+)['\"]\)|import\s+['\"]([^'\"]+)['\"]/g;

type PackageJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const readJson = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const listSourceFiles = (projectRoot: string, rootPath: string): string[] => {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const ignoreRules = parsePlaybookIgnore(projectRoot);
  const files: string[] = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join(path.posix.sep);
      if (isPlaybookIgnored(relativePath, ignoreRules)) {
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const buildEdgeKey = (edge: RepositoryDependencyEdge): string => `${edge.from}->${edge.to}:${edge.type}`;

const parseRootManifestEdges = (projectRoot: string, internalNames: Set<string>): RepositoryDependencyEdge[] => {
  const rootPkg = readJson<PackageJson>(path.join(projectRoot, 'package.json'));
  if (!rootPkg) {
    return [];
  }

  const combinedDependencies = {
    ...(rootPkg.dependencies ?? {}),
    ...(rootPkg.devDependencies ?? {}),
    ...(rootPkg.peerDependencies ?? {})
  };

  return Object.keys(combinedDependencies)
    .filter((dependencyName) => internalNames.has(dependencyName))
    .sort((left, right) => left.localeCompare(right))
    .map((dependencyName) => ({
      from: 'repository',
      to: dependencyName,
      type: 'root-manifest' as const
    }));
};

const parseWorkspaceImportEdges = (
  projectRoot: string,
  workspacePathByName: Map<string, string>,
  internalNames: Set<string>
): RepositoryDependencyEdge[] => {
  const edges: RepositoryDependencyEdge[] = [];

  for (const [workspaceName, workspacePath] of workspacePathByName) {
    const sourceFiles = listSourceFiles(projectRoot, path.join(projectRoot, workspacePath, 'src'));

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const matches = Array.from(content.matchAll(IMPORT_RE));

      for (const match of matches) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (!specifier || specifier.startsWith('.')) {
          continue;
        }

        const packageMatch = internalNames.has(specifier)
          ? specifier
          : Array.from(internalNames).find((candidate) => specifier.startsWith(`${candidate}/`));

        if (!packageMatch || packageMatch === workspaceName) {
          continue;
        }

        edges.push({
          from: workspaceName,
          to: packageMatch,
          type: 'source-import'
        });
      }
    }
  }

  return edges;
};

export const extractDependencyEdges = (projectRoot: string): RepositoryDependencyEdge[] => {
  const workspaceTopology = discoverWorkspaces(projectRoot);
  const workspaceDeps = scanWorkspaceDeps(projectRoot);
  const internalNames = new Set(workspaceTopology.map((workspace) => workspace.name));
  const workspacePathByName = new Map(workspaceTopology.map((workspace) => [workspace.name, workspace.path]));

  const edges: RepositoryDependencyEdge[] = [
    ...workspaceDeps.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      type: 'workspace-manifest' as const
    })),
    ...parseRootManifestEdges(projectRoot, internalNames),
    ...parseWorkspaceImportEdges(projectRoot, workspacePathByName, internalNames)
  ];

  const deduped = new Map<string, RepositoryDependencyEdge>();
  for (const edge of edges) {
    deduped.set(buildEdgeKey(edge), edge);
  }

  return Array.from(deduped.values()).sort((left, right) => {
    if (left.from !== right.from) {
      return left.from.localeCompare(right.from);
    }

    if (left.to !== right.to) {
      return left.to.localeCompare(right.to);
    }

    return left.type.localeCompare(right.type);
  });
};
