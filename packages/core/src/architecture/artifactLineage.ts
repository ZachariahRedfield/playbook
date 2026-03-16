import type { ArchitectureRegistry, ArtifactLineage, Subsystem } from './types.js';

const KNOWN_UPSTREAM_SUBSYSTEM_BY_ARTIFACT: Record<string, string> = {
  '.playbook/execution-state.json': 'orchestration_planner',
  '.playbook/lane-state.json': 'orchestration_planner',
  '.playbook/worker-assignments.json': 'lane_lifecycle'
};

const KNOWN_CONSUMER_SUBSYSTEMS_BY_ARTIFACT: Record<string, string[]> = {
  '.playbook/workset-plan.json': ['lane_lifecycle', 'worker_coordination', 'execution_supervisor'],
  '.playbook/lane-state.json': ['worker_coordination', 'execution_supervisor'],
  '.playbook/worker-assignments.json': ['execution_supervisor'],
  '.playbook/execution-state.json': ['telemetry_learning', 'lane_lifecycle', 'worker_coordination'],
  '.playbook/outcome-telemetry.json': ['telemetry_learning', 'knowledge_lifecycle'],
  '.playbook/process-telemetry.json': ['telemetry_learning'],
  '.playbook/learning-state.json': ['routing_engine', 'orchestration_planner', 'improvement_engine'],
  '.playbook/learning-compaction.json': ['improvement_engine', 'knowledge_lifecycle'],
  '.playbook/router-recommendations.json': ['knowledge_lifecycle'],
  '.playbook/memory/events/*': ['telemetry_learning', 'improvement_engine', 'knowledge_lifecycle'],
  '.playbook/memory/index.json': ['knowledge_lifecycle', 'improvement_engine', 'observation_engine'],
  '.playbook/repo-index.json': ['observation_engine', 'knowledge_lifecycle']
};

const uniqueStable = (items: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
};

const findArtifactOwnerSubsystem = (registry: ArchitectureRegistry, artifactPath: string): Subsystem | undefined =>
  registry.subsystems.find((subsystem) => subsystem.artifacts.includes(artifactPath));

export const resolveArtifactOwner = (registry: ArchitectureRegistry, artifactPath: string): string => {
  const owner = findArtifactOwnerSubsystem(registry, artifactPath);
  if (!owner) {
    throw new Error(`playbook explain artifact: unknown artifact "${artifactPath}".`);
  }
  return owner.name;
};

export const resolveArtifactConsumers = (registry: ArchitectureRegistry, artifactPath: string, ownerSubsystem: string): string[] => {
  const registryConsumers = registry.subsystems
    .filter((subsystem) => subsystem.name !== ownerSubsystem && subsystem.artifacts.includes(artifactPath))
    .map((subsystem) => subsystem.name);

  const knownConsumers = KNOWN_CONSUMER_SUBSYSTEMS_BY_ARTIFACT[artifactPath] ?? [];
  return uniqueStable([...knownConsumers, ...registryConsumers].filter((name) => name !== ownerSubsystem));
};

export const resolveArtifactUpstream = (registry: ArchitectureRegistry, artifactPath: string, ownerSubsystem: string): string | null => {
  const known = KNOWN_UPSTREAM_SUBSYSTEM_BY_ARTIFACT[artifactPath];
  if (!known || known === ownerSubsystem) {
    return null;
  }

  const exists = registry.subsystems.some((subsystem) => subsystem.name === known);
  return exists ? known : null;
};

export const resolveArtifactLineage = (registry: ArchitectureRegistry, artifactPath: string): ArtifactLineage => {
  const ownerSubsystem = resolveArtifactOwner(registry, artifactPath);
  return {
    ownerSubsystem,
    upstreamSubsystem: resolveArtifactUpstream(registry, artifactPath, ownerSubsystem),
    downstreamConsumers: resolveArtifactConsumers(registry, artifactPath, ownerSubsystem)
  };
};
