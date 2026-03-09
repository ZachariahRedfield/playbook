import { resolveIndexedModuleContext } from './moduleIntelligence.js';
import { readModuleContextDigest, type ModuleContextDigest } from '../context/moduleContext.js';
import { resolveRepositoryTarget, type ResolvedTarget } from '../intelligence/targetResolver.js';

export type ImpactQueryResult = {
  schemaVersion: '1.0';
  command: 'query';
  query: 'impact';
  target: string;
  resolvedTarget: ResolvedTarget;
  module: {
    name: string;
    path: string;
    type: 'module';
  };
  digest?: ModuleContextDigest;
  impact: {
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
};

export const queryImpact = (projectRoot: string, moduleName: string): ImpactQueryResult => {
  const resolvedTarget = resolveRepositoryTarget(projectRoot, moduleName);
  if (resolvedTarget.kind !== 'module') {
    throw new Error(`playbook query impact: unknown module "${moduleName}".`);
  }

  const moduleContext = resolveIndexedModuleContext(projectRoot, resolvedTarget.selector, {
    unknownModulePrefix: 'playbook query impact'
  });

  const digest = readModuleContextDigest(projectRoot, resolvedTarget.selector) ?? undefined;

  return {
    schemaVersion: '1.0',
    command: 'query',
    query: 'impact',
    target: resolvedTarget.selector,
    resolvedTarget,
    module: moduleContext.module,
    digest,
    impact: moduleContext.impact
  };
};
