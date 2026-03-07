import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryIndex, RepositoryModule } from '../indexer/repoIndexer.js';
import { queryRisk } from './risk.js';

const INDEX_RELATIVE_PATH = '.playbook/repo-index.json' as const;

export type IndexedModuleIdentity = {
  name: string;
  path: string;
  type: 'module';
};

export type ModuleImpact = {
  dependents: string[];
  directDependents: string[];
  dependencies: string[];
  docs: string[];
  rules: string[];
  risk: {
    level: 'low' | 'medium' | 'high';
    score: number;
    signals: string[];
  };
};

export type IndexedModuleContext = {
  module: IndexedModuleIdentity;
  impact: ModuleImpact;
};

export const readIndexedRepository = (projectRoot: string): RepositoryIndex => {
  const indexPath = path.join(projectRoot, INDEX_RELATIVE_PATH);
  if (!fs.existsSync(indexPath)) {
    throw new Error('playbook query: missing repository index at .playbook/repo-index.json. Run "playbook index" first.');
  }

  const raw = fs.readFileSync(indexPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<RepositoryIndex>;

  if (parsed.schemaVersion !== '1.0') {
    throw new Error(
      `playbook query: unsupported repository index schemaVersion "${String(parsed.schemaVersion)}". Expected "1.0".`
    );
  }

  return parsed as RepositoryIndex;
};

const toModuleEntry = (entry: RepositoryModule | string): RepositoryModule => {
  if (typeof entry === 'string') {
    return { name: entry, dependencies: [] };
  }

  return {
    name: entry.name,
    dependencies: [...entry.dependencies]
  };
};

const normalizeModules = (modules: RepositoryIndex['modules']): RepositoryModule[] =>
  (modules as Array<RepositoryModule | string>)
    .map((entry) => toModuleEntry(entry))
    .sort((a, b) => a.name.localeCompare(b.name));

const buildReverseGraph = (modules: RepositoryModule[]): Map<string, string[]> => {
  const reverseGraph = new Map<string, string[]>();

  for (const moduleEntry of modules) {
    reverseGraph.set(moduleEntry.name, []);
  }

  for (const moduleEntry of modules) {
    for (const dependency of moduleEntry.dependencies) {
      const dependents = reverseGraph.get(dependency) ?? [];
      dependents.push(moduleEntry.name);
      reverseGraph.set(dependency, dependents);
    }
  }

  for (const [moduleName, dependents] of reverseGraph.entries()) {
    reverseGraph.set(moduleName, [...dependents].sort((a, b) => a.localeCompare(b)));
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

  return Array.from(visited).sort((a, b) => a.localeCompare(b));
};

export const resolveIndexedModuleContext = (
  projectRoot: string,
  moduleName: string,
  options?: { unknownModulePrefix?: string }
): IndexedModuleContext => {
  const index = readIndexedRepository(projectRoot);
  const modules = normalizeModules(index.modules);
  const targetModule = modules.find((moduleEntry) => moduleEntry.name === moduleName);

  if (!targetModule) {
    const prefix = options?.unknownModulePrefix ?? 'playbook query impact';
    throw new Error(`${prefix}: unknown module "${moduleName}".`);
  }

  const reverseGraph = buildReverseGraph(modules);
  const directDependents = [...(reverseGraph.get(moduleName) ?? [])].sort((a, b) => a.localeCompare(b));
  const dependents = computeTransitiveDependents(moduleName, reverseGraph);
  const risk = queryRisk(projectRoot, moduleName);

  return {
    module: {
      name: targetModule.name,
      path: `src/${targetModule.name}`,
      type: 'module'
    },
    impact: {
      dependents,
      directDependents,
      dependencies: [...targetModule.dependencies].sort((a, b) => a.localeCompare(b)),
      docs: [],
      rules: [],
      risk: {
        level: risk.riskLevel,
        score: risk.riskScore,
        signals: [...risk.reasons]
      }
    }
  };
};

export const buildModuleAskContext = (moduleContext: IndexedModuleContext): string => {
  const dependencies = moduleContext.impact.dependencies.length > 0 ? moduleContext.impact.dependencies.join(', ') : 'none';
  const directDependents = moduleContext.impact.directDependents.length > 0 ? moduleContext.impact.directDependents.join(', ') : 'none';
  const transitiveDependents = moduleContext.impact.dependents.length > 0 ? moduleContext.impact.dependents.join(', ') : 'none';

  return [
    `Module scope: ${moduleContext.module.name}`,
    `Module path: ${moduleContext.module.path}`,
    `Dependencies: ${dependencies}`,
    `Direct dependents: ${directDependents}`,
    `Transitive dependents: ${transitiveDependents}`,
    `Module risk level: ${moduleContext.impact.risk.level} (${moduleContext.impact.risk.score.toFixed(2)})`
  ].join('\n');
};
