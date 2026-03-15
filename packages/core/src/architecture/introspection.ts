import type { ArchitectureRegistry, ArtifactLineage, Subsystem } from './types.js';
import { resolveArtifactLineage, resolveArtifactOwner } from './artifactLineage.js';
import { loadArchitecture } from './loadArchitecture.js';

export type SubsystemOwnership = {
  subsystem: Subsystem;
};

export type ArtifactOwnershipDetails = {
  artifact: string;
  subsystem: Subsystem;
  lineage: ArtifactLineage;
};

const findSubsystemByName = (registry: ArchitectureRegistry, subsystemName: string): Subsystem | undefined =>
  registry.subsystems.find((subsystem) => subsystem.name === subsystemName);

export const explainSubsystemOwnership = (repoRoot: string, subsystemName: string): SubsystemOwnership => {
  const registry = loadArchitecture(repoRoot);
  const subsystem = findSubsystemByName(registry, subsystemName);

  if (!subsystem) {
    throw new Error(`playbook explain subsystem: unknown subsystem "${subsystemName}".`);
  }

  return { subsystem };
};

export const explainArtifactOwnership = (repoRoot: string, artifactPath: string): ArtifactOwnershipDetails => {
  const registry = loadArchitecture(repoRoot);
  const ownerSubsystemName = resolveArtifactOwner(registry, artifactPath);
  const subsystem = findSubsystemByName(registry, ownerSubsystemName);

  if (!subsystem) {
    throw new Error(`playbook explain artifact: unknown artifact "${artifactPath}".`);
  }

  return {
    artifact: artifactPath,
    subsystem,
    lineage: resolveArtifactLineage(registry, artifactPath)
  };
};
