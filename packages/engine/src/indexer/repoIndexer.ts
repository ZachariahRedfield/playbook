import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/load.js';
import { getCoreRules } from '../rules/coreRules.js';
import { scanWorkspaceDeps } from '../diagrams/scanWorkspaceDeps.js';
import { extractDependencyEdges, type RepositoryDependencyEdge } from './extractDependencies.js';

export type { RepositoryDependencyEdge } from './extractDependencies.js';
import { getDefaultPlaybookIgnoreSuggestions, isPlaybookIgnored, parsePlaybookIgnore } from './playbookIgnore.js';

export type RepositoryModule = {
  name: string;
  dependencies: string[];
};

export type RepositoryIndex = {
  schemaVersion: '1.0';
  framework: string;
  language: string;
  architecture: string;
  modules: RepositoryModule[];
  dependencies: RepositoryDependencyEdge[];
  workspace: RepositoryWorkspaceNode[];
  tests: RepositoryTestCoverage[];
  configs: RepositoryConfigEntry[];
  database: string;
  rules: string[];
  architectureRoleInference: RepositoryArchitectureRoleInference;
};

export type RepositoryWorkspaceNode = {
  name: string;
  path: string;
  role: 'cli' | 'core' | 'engine' | 'node' | 'package';
  dependsOn: string[];
};

export type ArchitectureRole = 'interface' | 'orchestration' | 'foundation' | 'adapter';

export type RepositoryArchitectureRoleNode = {
  workspace: string;
  inferredRole: ArchitectureRole;
  evidence: string[];
};

export type RepositoryArchitectureDependencyObservation = {
  from: string;
  to: string;
  fromRole: ArchitectureRole;
  toRole: ArchitectureRole;
  status: 'allowed' | 'out_of_direction';
};

export type RepositoryArchitectureRoleInference = {
  classificationMode: 'observation-only';
  classifierVersion: 'role-heuristic-v1';
  policyEnforcement: 'none';
  dependencyMatrix: Record<ArchitectureRole, ArchitectureRole[]>;
  nodes: RepositoryArchitectureRoleNode[];
  dependencyObservations: RepositoryArchitectureDependencyObservation[];
};

export type RepositoryTestCoverage = {
  module: string;
  tests_present: boolean;
  coverage_estimate: 'unknown';
};

export type RepositoryConfigEntry = {
  name: 'eslint' | 'tsconfig' | 'jest' | 'vitest' | 'command-inventory';
  path: string;
  present: boolean;
  commands?: string[];
};

const IMPORT_RE = /from\s+['\"]([^'\"]+)['\"]|import\(['\"]([^'\"]+)['\"]\)|import\s+['\"]([^'\"]+)['\"]/g;

const readPackageJson = (projectRoot: string): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | undefined => {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
};

const detectFramework = (projectRoot: string): string => {
  if (fs.existsSync(path.join(projectRoot, 'next.config.js')) || fs.existsSync(path.join(projectRoot, 'next.config.mjs')) || fs.existsSync(path.join(projectRoot, 'next.config.ts'))) {
    return 'nextjs';
  }

  if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
    return 'node';
  }

  return 'unknown';
};

const detectLanguage = (projectRoot: string): string => {
  if (fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
    return 'typescript';
  }

  if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
    return 'javascript';
  }

  return 'unknown';
};

const detectArchitecture = (projectRoot: string): string => {
  const defaultArchitecture = 'modular-monolith';

  const configPath = path.join(projectRoot, 'playbook.config.json');
  if (!fs.existsSync(configPath)) {
    return defaultArchitecture;
  }

  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { architecture?: string };
  if (typeof parsed.architecture === 'string' && parsed.architecture.trim().length > 0) {
    return parsed.architecture.trim();
  }

  return defaultArchitecture;
};

const listModuleDirectoryNames = (projectRoot: string, directoryPath: string): string[] => {
  const ignoreRules = parsePlaybookIgnore(projectRoot);
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      const relativeEntryPath = path.relative(projectRoot, path.join(directoryPath, entry.name)).split(path.sep).join(path.posix.sep);
      return !isPlaybookIgnored(relativeEntryPath, ignoreRules);
    })
    .map((entry) => entry.name)
    .sort();
};

const detectModuleNames = (
  projectRoot: string,
  architecture: string
): {
  moduleNames: string[];
  moduleRootPath: string;
} => {
  const srcPath = path.join(projectRoot, 'src');
  const featureModulesPath = path.join(srcPath, 'features');

  if (architecture === 'modular-monolith') {
    const featureModuleNames = listModuleDirectoryNames(projectRoot, featureModulesPath);
    if (featureModuleNames.length > 0) {
      return {
        moduleNames: featureModuleNames,
        moduleRootPath: featureModulesPath
      };
    }
  }

  return {
    moduleNames: listModuleDirectoryNames(projectRoot, srcPath),
    moduleRootPath: srcPath
  };
};

const listModuleFiles = (projectRoot: string, moduleRoot: string): string[] => {
  const ignoreRules = parsePlaybookIgnore(projectRoot);
  if (!fs.existsSync(moduleRoot)) {
    return [];
  }

  const files: string[] = [];
  const stack = [moduleRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const relativeChild = path.relative(projectRoot, child).split(path.sep).join(path.posix.sep);
      if (isPlaybookIgnored(relativeChild, ignoreRules)) {
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(child);
        continue;
      }

      if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(child);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
};

const detectModuleDependenciesFromSrc = (
  projectRoot: string,
  moduleNames: string[],
  moduleRootPath: string
): RepositoryModule[] => {
  const srcPath = path.join(projectRoot, 'src');
  const moduleSet = new Set(moduleNames);

  return moduleNames.map((moduleName) => {
    const dependencies = new Set<string>();
    const moduleFiles = listModuleFiles(projectRoot, path.join(moduleRootPath, moduleName));

    for (const filePath of moduleFiles) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const matches = Array.from(fileContent.matchAll(IMPORT_RE));

      for (const match of matches) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (!specifier) {
          continue;
        }

        let candidateModule: string | undefined;

        if (specifier.startsWith('.')) {
          const resolvedTarget = path.resolve(path.dirname(filePath), specifier);
          const relativeToSrc = path.relative(srcPath, resolvedTarget);
          if (!relativeToSrc.startsWith('..')) {
            if (relativeToSrc.startsWith(`features${path.sep}`)) {
              candidateModule = relativeToSrc.split(path.sep)[1];
            } else {
              candidateModule = relativeToSrc.split(path.sep)[0];
            }
          }
        } else if (specifier.startsWith('@/')) {
          const segments = specifier.slice(2).split('/');
          candidateModule = segments[0] === 'features' ? segments[1] : segments[0];
        } else if (specifier.startsWith('src/')) {
          const segments = specifier.slice(4).split('/');
          candidateModule = segments[0] === 'features' ? segments[1] : segments[0];
        }

        if (!candidateModule || candidateModule === moduleName || !moduleSet.has(candidateModule)) {
          continue;
        }

        dependencies.add(candidateModule);
      }
    }

    return {
      name: moduleName,
      dependencies: Array.from(dependencies).sort((a, b) => a.localeCompare(b))
    };
  });
};

const detectModules = (projectRoot: string, architecture: string): RepositoryModule[] => {
  const explicitIgnoreRules = parsePlaybookIgnore(projectRoot)
    .filter((rule) => !rule.negated)
    .map((rule) => rule.pattern);
  const defaultIgnoreRules = getDefaultPlaybookIgnoreSuggestions().map((entry) => {
    const normalized = entry.trim().replace(/\\/g, '/').replace(/^\//, '');
    if (normalized.length === 0) {
      return '';
    }
    if (normalized.endsWith('/')) {
      return `${normalized}**`;
    }
    if (!normalized.includes('*') && !normalized.includes('/')) {
      return `**/${normalized}/**`;
    }
    if (!normalized.includes('*') && normalized.includes('/')) {
      return `${normalized}/**`;
    }
    return normalized;
  }).filter((entry) => entry.length > 0);
  const workspaceIgnoreRules = Array.from(new Set([...defaultIgnoreRules, ...explicitIgnoreRules]));
  const workspaceGraph = scanWorkspaceDeps(projectRoot, {
    excludeGlobs: workspaceIgnoreRules.length > 0 ? workspaceIgnoreRules : undefined
  });
  if (workspaceGraph.workspaces.length > 0) {
    const depMap = new Map(workspaceGraph.workspaces.map((workspace) => [workspace.name, new Set<string>()]));
    for (const edge of workspaceGraph.edges) {
      depMap.get(edge.from)?.add(edge.to);
    }

    return workspaceGraph.workspaces
      .map((workspace) => ({
        name: workspace.name,
        dependencies: Array.from(depMap.get(workspace.name) ?? []).sort((a, b) => a.localeCompare(b))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const { moduleNames, moduleRootPath } = detectModuleNames(projectRoot, architecture);
  return detectModuleDependenciesFromSrc(projectRoot, moduleNames, moduleRootPath);
};

const detectDatabase = (projectRoot: string): string => {
  const pkg = readPackageJson(projectRoot);
  if (!pkg) {
    return 'none';
  }

  const dependencies = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };

  if (dependencies['@supabase/supabase-js']) {
    return 'supabase';
  }

  if (dependencies.prisma || dependencies['@prisma/client']) {
    return 'prisma';
  }

  if (dependencies.typeorm) {
    return 'typeorm';
  }

  if (dependencies.sequelize) {
    return 'sequelize';
  }

  if (dependencies['drizzle-orm']) {
    return 'drizzle';
  }

  return 'none';
};

const detectRules = (projectRoot: string): string[] => {
  const { config } = loadConfig(projectRoot);
  return getCoreRules(config)
    .map((rule) => rule.id)
    .sort();
};

const detectWorkspace = (projectRoot: string): RepositoryWorkspaceNode[] => {
  const workspaceGraph = scanWorkspaceDeps(projectRoot);
  const dependencyMap = new Map<string, Set<string>>();

  for (const workspace of workspaceGraph.workspaces) {
    dependencyMap.set(workspace.name, new Set<string>());
  }

  for (const edge of workspaceGraph.edges) {
    dependencyMap.get(edge.from)?.add(edge.to);
  }

  const inferRole = (name: string): RepositoryWorkspaceNode['role'] => {
    if (name.includes('/playbook-core') || name.endsWith('/core')) {
      return 'core';
    }
    if (name.includes('/playbook-engine') || name.endsWith('/engine')) {
      return 'engine';
    }
    if (name.includes('/playbook-node') || name.endsWith('/node')) {
      return 'node';
    }
    if (name.endsWith('/playbook') || name.endsWith('/cli') || name.includes('-cli')) {
      return 'cli';
    }
    return 'package';
  };

  return workspaceGraph.workspaces
    .map((workspace) => ({
      name: workspace.name,
      path: workspace.path,
      role: inferRole(workspace.name),
      dependsOn: Array.from(dependencyMap.get(workspace.name) ?? []).sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

const DEPENDENCY_DIRECTION_MATRIX: Record<ArchitectureRole, ArchitectureRole[]> = {
  interface: ['foundation', 'adapter'],
  orchestration: ['interface', 'foundation', 'adapter'],
  foundation: ['foundation'],
  adapter: ['interface', 'foundation']
};

const inferArchitectureRoleFromWorkspace = (workspace: RepositoryWorkspaceNode): RepositoryArchitectureRoleNode => {
  if (workspace.role === 'cli') {
    return { workspace: workspace.name, inferredRole: 'interface', evidence: ['workspace-role:cli'] };
  }
  if (workspace.role === 'engine') {
    return { workspace: workspace.name, inferredRole: 'orchestration', evidence: ['workspace-role:engine'] };
  }
  if (workspace.role === 'core') {
    return { workspace: workspace.name, inferredRole: 'foundation', evidence: ['workspace-role:core'] };
  }
  if (workspace.role === 'node') {
    return { workspace: workspace.name, inferredRole: 'adapter', evidence: ['workspace-role:node'] };
  }

  const normalizedName = workspace.name.toLowerCase();
  if (/(^|\/)(cli|ui|api|web)$/.test(normalizedName) || normalizedName.includes('interface')) {
    return { workspace: workspace.name, inferredRole: 'interface', evidence: ['name-heuristic:interface'] };
  }
  if (normalizedName.includes('orchestrat') || normalizedName.includes('engine') || normalizedName.includes('workflow')) {
    return { workspace: workspace.name, inferredRole: 'orchestration', evidence: ['name-heuristic:orchestration'] };
  }
  if (normalizedName.includes('core') || normalizedName.includes('foundation') || normalizedName.includes('shared')) {
    return { workspace: workspace.name, inferredRole: 'foundation', evidence: ['name-heuristic:foundation'] };
  }
  if (normalizedName.includes('adapter') || normalizedName.includes('plugin') || normalizedName.includes('bridge') || normalizedName.includes('node')) {
    return { workspace: workspace.name, inferredRole: 'adapter', evidence: ['name-heuristic:adapter'] };
  }

  if (workspace.dependsOn.length === 0) {
    return { workspace: workspace.name, inferredRole: 'foundation', evidence: ['topology-heuristic:no-dependencies'] };
  }

  return { workspace: workspace.name, inferredRole: 'interface', evidence: ['fallback-heuristic:default-interface'] };
};

const inferArchitectureRoles = (workspace: RepositoryWorkspaceNode[]): RepositoryArchitectureRoleInference => {
  const nodes = workspace
    .map((node) => inferArchitectureRoleFromWorkspace(node))
    .sort((left, right) => left.workspace.localeCompare(right.workspace));
  const roleByWorkspace = new Map(nodes.map((node) => [node.workspace, node.inferredRole]));

  const dependencyObservations = workspace
    .flatMap((node) =>
      node.dependsOn.map((dependency) => {
        const fromRole = roleByWorkspace.get(node.name) ?? 'interface';
        const toRole = roleByWorkspace.get(dependency) ?? 'interface';
        const allowedTargets = DEPENDENCY_DIRECTION_MATRIX[fromRole] ?? [];
        return {
          from: node.name,
          to: dependency,
          fromRole,
          toRole,
          status: allowedTargets.includes(toRole) ? ('allowed' as const) : ('out_of_direction' as const)
        };
      })
    )
    .sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));

  return {
    classificationMode: 'observation-only',
    classifierVersion: 'role-heuristic-v1',
    policyEnforcement: 'none',
    dependencyMatrix: DEPENDENCY_DIRECTION_MATRIX,
    nodes,
    dependencyObservations
  };
};

const detectTests = (projectRoot: string, modules: RepositoryModule[], workspace: RepositoryWorkspaceNode[]): RepositoryTestCoverage[] => {
  const workspacePathByName = new Map(workspace.map((entry) => [entry.name, entry.path]));

  const hasModuleTests = (moduleName: string): boolean => {
    const workspacePath = workspacePathByName.get(moduleName);
    if (workspacePath) {
      return [
        path.join(projectRoot, workspacePath, 'tests'),
        path.join(projectRoot, workspacePath, 'test'),
        path.join(projectRoot, workspacePath, '__tests__')
      ].some((testPath) => fs.existsSync(testPath));
    }

    const srcCandidates = [
      path.join(projectRoot, 'src', moduleName, 'tests'),
      path.join(projectRoot, 'src', moduleName, 'test'),
      path.join(projectRoot, 'src', moduleName, '__tests__'),
      path.join(projectRoot, 'tests', moduleName),
      path.join(projectRoot, 'test', moduleName)
    ];

    return srcCandidates.some((testPath) => fs.existsSync(testPath));
  };

  return modules.map((moduleEntry) => ({
    module: moduleEntry.name,
    tests_present: hasModuleTests(moduleEntry.name),
    coverage_estimate: 'unknown'
  }));
};

const detectConfigs = (projectRoot: string): RepositoryConfigEntry[] => {
  const configCandidates: Array<Pick<RepositoryConfigEntry, 'name' | 'path'>> = [
    { name: 'eslint', path: '.eslintrc.js' },
    { name: 'eslint', path: '.eslintrc.cjs' },
    { name: 'eslint', path: '.eslintrc.json' },
    { name: 'eslint', path: 'eslint.config.js' },
    { name: 'eslint', path: 'eslint.config.mjs' },
    { name: 'tsconfig', path: 'tsconfig.json' },
    { name: 'jest', path: 'jest.config.js' },
    { name: 'jest', path: 'jest.config.cjs' },
    { name: 'jest', path: 'jest.config.ts' },
    { name: 'vitest', path: 'vitest.config.ts' },
    { name: 'vitest', path: 'vitest.config.js' },
    { name: 'vitest', path: 'vitest.workspace.ts' }
  ];

  const configEntries = configCandidates.map((candidate) => ({
    name: candidate.name,
    path: candidate.path,
    present: fs.existsSync(path.join(projectRoot, candidate.path))
  }));

  const rootPackageJsonPath = path.join(projectRoot, 'package.json');
  let commandInventory: string[] = [];
  if (fs.existsSync(rootPackageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
    commandInventory = Object.keys(packageJson.scripts ?? {}).sort((left, right) => left.localeCompare(right));
  }

  return [
    ...configEntries,
    {
      name: 'command-inventory',
      path: 'package.json#scripts',
      present: commandInventory.length > 0,
      commands: commandInventory
    }
  ];
};

export const generateRepositoryIndex = (projectRoot: string): RepositoryIndex => {
  const architecture = detectArchitecture(projectRoot);
  const modules = detectModules(projectRoot, architecture);
  const workspace = detectWorkspace(projectRoot);
  const architectureRoleInference = inferArchitectureRoles(workspace);

  return {
    schemaVersion: '1.0',
    framework: detectFramework(projectRoot),
    language: detectLanguage(projectRoot),
    architecture,
    modules,
    dependencies: extractDependencyEdges(projectRoot),
    workspace,
    tests: detectTests(projectRoot, modules, workspace),
    configs: detectConfigs(projectRoot),
    database: detectDatabase(projectRoot),
    rules: detectRules(projectRoot),
    architectureRoleInference
  };
};
