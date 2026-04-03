import type { RepositoryGraph } from './repoGraph.js';

export const ARCHITECTURE_ROLE_INFERENCE_SCHEMA_VERSION = '1.0' as const;

export type ArchitectureRole = 'interface' | 'orchestration' | 'foundation' | 'adapter';

export type ArchitectureRoleInferenceRecord = {
  module: string;
  role: ArchitectureRole;
  evidence: {
    incomingDependencies: number;
    outgoingDependencies: number;
    dependencyDirection: 'inbound' | 'outbound' | 'bidirectional' | 'isolated';
  };
};

export type ArchitectureRoleInferenceSummary = {
  schemaVersion: typeof ARCHITECTURE_ROLE_INFERENCE_SCHEMA_VERSION;
  roles: ArchitectureRoleInferenceRecord[];
};

const dependencyDirection = (incomingDependencies: number, outgoingDependencies: number): ArchitectureRoleInferenceRecord['evidence']['dependencyDirection'] => {
  if (incomingDependencies === 0 && outgoingDependencies === 0) {
    return 'isolated';
  }
  if (incomingDependencies > 0 && outgoingDependencies > 0) {
    return 'bidirectional';
  }
  return incomingDependencies > 0 ? 'inbound' : 'outbound';
};

const inferRole = (incomingDependencies: number, outgoingDependencies: number): ArchitectureRole => {
  if (incomingDependencies === 0 && outgoingDependencies > 0) {
    return 'interface';
  }
  if (incomingDependencies > 0 && outgoingDependencies === 0) {
    return 'foundation';
  }
  if (incomingDependencies > 0 && outgoingDependencies > 0) {
    return 'orchestration';
  }
  return 'adapter';
};

export const inferArchitectureRoles = (graph: RepositoryGraph): ArchitectureRoleInferenceSummary => {
  const modules = graph.nodes
    .filter((node) => node.kind === 'module')
    .map((node) => node.name)
    .sort((left, right) => left.localeCompare(right));

  const incomingByModule = new Map<string, number>(modules.map((module) => [module, 0]));
  const outgoingByModule = new Map<string, number>(modules.map((module) => [module, 0]));

  for (const edge of graph.edges) {
    if (edge.kind !== 'depends_on') {
      continue;
    }

    if (edge.from.startsWith('module:')) {
      const fromModule = edge.from.slice('module:'.length);
      if (outgoingByModule.has(fromModule)) {
        outgoingByModule.set(fromModule, (outgoingByModule.get(fromModule) ?? 0) + 1);
      }
    }

    if (edge.to.startsWith('module:')) {
      const toModule = edge.to.slice('module:'.length);
      if (incomingByModule.has(toModule)) {
        incomingByModule.set(toModule, (incomingByModule.get(toModule) ?? 0) + 1);
      }
    }
  }

  return {
    schemaVersion: ARCHITECTURE_ROLE_INFERENCE_SCHEMA_VERSION,
    roles: modules.map((module) => {
      const incomingDependencies = incomingByModule.get(module) ?? 0;
      const outgoingDependencies = outgoingByModule.get(module) ?? 0;
      return {
        module,
        role: inferRole(incomingDependencies, outgoingDependencies),
        evidence: {
          incomingDependencies,
          outgoingDependencies,
          dependencyDirection: dependencyDirection(incomingDependencies, outgoingDependencies)
        }
      };
    })
  };
};
