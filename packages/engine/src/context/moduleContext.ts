import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryIndex } from '../indexer/repoIndexer.js';
import type { RepositoryGraph } from '../graph/repoGraph.js';
import { queryRisk } from '../query/risk.js';

export const MODULE_CONTEXT_DIR_RELATIVE_PATH = '.playbook/context/modules' as const;

export type ModuleContextDigest = {
  schemaVersion: '1.0';
  kind: 'playbook-module-context-digest';
  generatedAt: string;
  module: {
    name: string;
    path: string;
    type: 'module';
  };
  files: {
    count: number;
    representative: string[];
  };
  dependencies: string[];
  directDependents: string[];
  dependents: string[];
  rules: string[];
  docs: string[];
  tests: string[];
  risk: {
    level: 'low' | 'medium' | 'high';
    score: number;
    signals: string[];
  };
  graphNeighborhood: {
    nodeId: string;
    outgoingKinds: string[];
    incomingKinds: string[];
  };
  provenance: {
    indexArtifact: '.playbook/repo-index.json';
    graphArtifact: '.playbook/repo-graph.json';
  };
};

const toSortedUnique = (values: string[]): string[] => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const MAX_RELATED_DOCS = 5;
const MAX_RELATED_TESTS = 5;

const buildReverseGraph = (index: RepositoryIndex): Map<string, string[]> => {
  const reverseGraph = new Map<string, string[]>();

  for (const moduleEntry of index.modules) {
    reverseGraph.set(moduleEntry.name, []);
  }

  for (const moduleEntry of index.modules) {
    for (const dependency of moduleEntry.dependencies) {
      const dependents = reverseGraph.get(dependency) ?? [];
      dependents.push(moduleEntry.name);
      reverseGraph.set(dependency, dependents);
    }
  }

  for (const [moduleName, dependents] of reverseGraph.entries()) {
    reverseGraph.set(moduleName, toSortedUnique(dependents));
  }

  return reverseGraph;
};

const computeTransitiveDependents = (moduleName: string, reverseGraph: Map<string, string[]>): string[] => {
  const visited = new Set<string>();
  const queue = [...(reverseGraph.get(moduleName) ?? [])];

  for (const dependent of queue) {
    visited.add(dependent);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const dependent of reverseGraph.get(current) ?? []) {
      if (!visited.has(dependent)) {
        visited.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return toSortedUnique(Array.from(visited));
};

const listModuleFiles = (projectRoot: string, moduleName: string): string[] => {
  const candidates = [
    path.join(projectRoot, 'src', 'features', moduleName),
    path.join(projectRoot, 'src', moduleName),
    path.join(projectRoot, 'packages', moduleName)
  ].filter((candidate, index, all) => all.indexOf(candidate) === index);

  const files: string[] = [];

  for (const moduleRoot of candidates) {
    if (!fs.existsSync(moduleRoot) || !fs.statSync(moduleRoot).isDirectory()) {
      continue;
    }

    const stack = [moduleRoot];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolutePath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(absolutePath);
          continue;
        }

        if (entry.isFile()) {
          files.push(path.relative(projectRoot, absolutePath).split(path.sep).join(path.posix.sep));
        }
      }
    }
  }

  return toSortedUnique(files);
};

const listModuleTests = (projectRoot: string, moduleName: string): string[] => {
  const matches: string[] = [];
  const root = path.join(projectRoot, 'packages');
  if (!fs.existsSync(root)) {
    return [];
  }

  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.test.ts')) {
        continue;
      }

      const relative = path.relative(projectRoot, absolutePath).split(path.sep).join(path.posix.sep);
      const content = fs.readFileSync(absolutePath, 'utf8').toLowerCase();
      if (content.includes(moduleName.toLowerCase())) {
        matches.push(relative);
      }
    }
  }

  return toSortedUnique(matches).slice(0, MAX_RELATED_TESTS);
};

const listModuleDocs = (projectRoot: string, moduleName: string): string[] => {
  const docsRoot = path.join(projectRoot, 'docs');
  if (!fs.existsSync(docsRoot)) {
    return [];
  }

  const found: string[] = [];
  const needle = moduleName.toLowerCase();
  const stack = [docsRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
        continue;
      }

      const relative = path.relative(projectRoot, absolutePath).split(path.sep).join(path.posix.sep);
      const content = fs.readFileSync(absolutePath, 'utf8').toLowerCase();
      if (content.includes(needle) || relative.toLowerCase().includes(needle)) {
        found.push(relative);
      }
    }
  }

  return toSortedUnique(found).slice(0, MAX_RELATED_DOCS);
};

export const buildModuleContextDigests = (
  projectRoot: string,
  index: RepositoryIndex,
  graph: RepositoryGraph,
  generatedAt: Date = new Date()
): ModuleContextDigest[] => {
  const reverseGraph = buildReverseGraph(index);

  return [...index.modules]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((moduleEntry) => {
      const risk = queryRisk(projectRoot, moduleEntry.name);
      const nodeId = `module:${moduleEntry.name}`;
      const outgoingKinds = graph.edges.filter((edge) => edge.from === nodeId).map((edge) => edge.kind);
      const incomingKinds = graph.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.kind);
      const moduleFiles = listModuleFiles(projectRoot, moduleEntry.name);

      return {
        schemaVersion: '1.0',
        kind: 'playbook-module-context-digest',
        generatedAt: generatedAt.toISOString(),
        module: {
          name: moduleEntry.name,
          path: `src/${moduleEntry.name}`,
          type: 'module'
        },
        files: {
          count: moduleFiles.length,
          representative: moduleFiles.slice(0, 5)
        },
        dependencies: toSortedUnique([...moduleEntry.dependencies]),
        directDependents: toSortedUnique([...(reverseGraph.get(moduleEntry.name) ?? [])]),
        dependents: computeTransitiveDependents(moduleEntry.name, reverseGraph),
        rules: [...index.rules],
        docs: listModuleDocs(projectRoot, moduleEntry.name),
        tests: listModuleTests(projectRoot, moduleEntry.name),
        risk: {
          level: risk.riskLevel,
          score: risk.riskScore,
          signals: [
            ...risk.reasons,
            ...(risk.warnings ?? []).map((warning) => `warning: ${warning}`)
          ]
        },
        graphNeighborhood: {
          nodeId,
          outgoingKinds: toSortedUnique(outgoingKinds),
          incomingKinds: toSortedUnique(incomingKinds)
        },
        provenance: {
          indexArtifact: '.playbook/repo-index.json',
          graphArtifact: '.playbook/repo-graph.json'
        }
      } satisfies ModuleContextDigest;
    });
};

export const writeModuleContextDigests = (projectRoot: string, digests: ModuleContextDigest[]): void => {
  const contextDir = path.join(projectRoot, MODULE_CONTEXT_DIR_RELATIVE_PATH);
  fs.mkdirSync(contextDir, { recursive: true });

  for (const digest of digests) {
    const fileName = `${digest.module.name.replace(/[\\/]/g, '__')}.json`;
    const digestPath = path.join(contextDir, fileName);
    fs.writeFileSync(digestPath, `${JSON.stringify(digest, null, 2)}\n`, 'utf8');
  }
};

export const readModuleContextDigest = (projectRoot: string, moduleName: string): ModuleContextDigest | null => {
  const digestPath = path.join(projectRoot, MODULE_CONTEXT_DIR_RELATIVE_PATH, `${moduleName.replace(/[\\/]/g, '__')}.json`);
  if (!fs.existsSync(digestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(digestPath, 'utf8')) as ModuleContextDigest;
};
