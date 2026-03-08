import { getWorkingTreeChangedFiles } from '../git/diff.js';
import { resolveScmDiffBase } from '../git/context.js';
import { queryRisk } from '../query/risk.js';
import { readIndexedRepository, resolveIndexedModuleContext } from '../query/moduleIntelligence.js';

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const isKnownModulePath = (moduleName: string, changedFile: string): boolean =>
  changedFile === `src/${moduleName}` || changedFile.startsWith(`src/${moduleName}/`);

export type DiffAskContext = {
  kind: 'playbook-diff-context';
  baseRef: string;
  changedFiles: string[];
  affectedModules: string[];
  impact: Array<{
    module: string;
    directDependents: string[];
    dependents: string[];
  }>;
  docs: string[];
  risk: {
    highestLevel: 'low' | 'medium' | 'high';
    moduleRisk: Array<{
      module: string;
      level: 'low' | 'medium' | 'high';
      score: number;
      signals: string[];
    }>;
  };
};

export const resolveDiffAskContext = (projectRoot: string, options?: { baseRef?: string }): DiffAskContext => {

  let index;
  try {
    index = readIndexedRepository(projectRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('missing repository index')) {
      throw new Error('playbook ask --diff-context: missing repository index at .playbook/repo-index.json. Run "playbook index" first.');
    }

    throw error;
  }

  const { baseRef, baseSha } = resolveScmDiffBase(projectRoot, {
    baseRef: options?.baseRef,
    commandName: 'playbook ask --diff-context'
  });
  const changedFiles = getWorkingTreeChangedFiles(projectRoot, baseSha);

  if (changedFiles.length === 0) {
    throw new Error('playbook ask --diff-context: no changed files were detected for the current working tree/diff base.');
  }

  const affectedModules = uniqueSorted(
    index.modules
      .map((entry) => (typeof entry === 'string' ? entry : entry.name))
      .filter((moduleName) => changedFiles.some((filePath) => isKnownModulePath(moduleName, filePath)))
  );

  const impact = affectedModules.map((moduleName) => {
    const moduleContext = resolveIndexedModuleContext(projectRoot, moduleName, { unknownModulePrefix: 'playbook ask --diff-context' });
    return {
      module: moduleName,
      directDependents: moduleContext.impact.directDependents,
      dependents: moduleContext.impact.dependents
    };
  });

  const docs = changedFiles.filter((filePath) => filePath.startsWith('docs/') || filePath.toLowerCase().includes('readme'));

  const moduleRisk = affectedModules.map((moduleName) => {
    const risk = queryRisk(projectRoot, moduleName);
    return {
      module: moduleName,
      level: risk.riskLevel,
      score: risk.riskScore,
      signals: risk.reasons
    };
  });

  const highestLevel = moduleRisk.some((entry) => entry.level === 'high')
    ? 'high'
    : moduleRisk.some((entry) => entry.level === 'medium')
      ? 'medium'
      : 'low';

  return {
    kind: 'playbook-diff-context',
    baseRef,
    changedFiles,
    affectedModules,
    impact,
    docs,
    risk: {
      highestLevel,
      moduleRisk
    }
  };
};
