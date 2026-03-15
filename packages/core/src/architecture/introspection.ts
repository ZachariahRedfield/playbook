import type { ArchitectureRegistry, Subsystem } from './types.js';
import { loadArchitecture } from './loadArchitecture.js';

export type SubsystemOwnership = {
  subsystem: Subsystem;
};

export type ArtifactOwnershipDetails = {
  artifact: string;
  subsystem: Subsystem;
};

const findSubsystemByName = (registry: ArchitectureRegistry, subsystemName: string): Subsystem | undefined =>
  registry.subsystems.find((subsystem) => subsystem.name === subsystemName);

const findArtifactOwner = (registry: ArchitectureRegistry, artifactPath: string): Subsystem | undefined =>
  registry.subsystems.find((subsystem) => subsystem.artifacts.includes(artifactPath));

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
  const subsystem = findArtifactOwner(registry, artifactPath);

  if (!subsystem) {
    throw new Error(`playbook explain artifact: unknown artifact "${artifactPath}".`);
  }

  return {
    artifact: artifactPath,
    subsystem
  };
};
