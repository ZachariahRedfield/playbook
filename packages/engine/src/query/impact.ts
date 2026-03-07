import { resolveIndexedModuleContext } from './moduleIntelligence.js';

export type ImpactQueryResult = {
  schemaVersion: '1.0';
  command: 'query';
  query: 'impact';
  target: string;
  module: {
    name: string;
    path: string;
    type: 'module';
  };
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
  const moduleContext = resolveIndexedModuleContext(projectRoot, moduleName, {
    unknownModulePrefix: 'playbook query impact'
  });

  return {
    schemaVersion: '1.0',
    command: 'query',
    query: 'impact',
    target: moduleName,
    module: moduleContext.module,
    impact: moduleContext.impact
  };
};
