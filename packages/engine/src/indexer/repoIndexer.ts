import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/load.js';
import { getCoreRules } from '../rules/coreRules.js';
import { scanWorkspaceDeps } from '../diagrams/scanWorkspaceDeps.js';
import { isPlaybookIgnored, parsePlaybookIgnore } from './playbookIgnore.js';

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
  database: string;
  rules: string[];
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

const detectModuleNames = (projectRoot: string): string[] => {
  const srcPath = path.join(projectRoot, 'src');
  const ignoreRules = parsePlaybookIgnore(projectRoot);
  if (!fs.existsSync(srcPath)) {
    return [];
  }

  return fs
    .readdirSync(srcPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !isPlaybookIgnored(path.posix.join('src', entry.name), ignoreRules))
    .map((entry) => entry.name)
    .sort();
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
      const relativeChild = path.relative(projectRoot, child);
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

const detectModuleDependenciesFromSrc = (projectRoot: string, moduleNames: string[]): RepositoryModule[] => {
  const srcPath = path.join(projectRoot, 'src');
  const moduleSet = new Set(moduleNames);

  return moduleNames.map((moduleName) => {
    const dependencies = new Set<string>();
    const moduleFiles = listModuleFiles(projectRoot, path.join(srcPath, moduleName));

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
            candidateModule = relativeToSrc.split(path.sep)[0];
          }
        } else if (specifier.startsWith('@/')) {
          candidateModule = specifier.slice(2).split('/')[0];
        } else if (specifier.startsWith('src/')) {
          candidateModule = specifier.slice(4).split('/')[0];
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

const detectModules = (projectRoot: string): RepositoryModule[] => {
  const workspaceIgnoreRules = parsePlaybookIgnore(projectRoot).filter((rule) => !rule.negated).map((rule) => rule.pattern);
  const workspaceGraph = scanWorkspaceDeps(projectRoot, {
    excludeGlobs: workspaceIgnoreRules
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

  const moduleNames = detectModuleNames(projectRoot);
  return detectModuleDependenciesFromSrc(projectRoot, moduleNames);
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

export const generateRepositoryIndex = (projectRoot: string): RepositoryIndex => ({
  schemaVersion: '1.0',
  framework: detectFramework(projectRoot),
  language: detectLanguage(projectRoot),
  architecture: detectArchitecture(projectRoot),
  modules: detectModules(projectRoot),
  database: detectDatabase(projectRoot),
  rules: detectRules(projectRoot)
});
