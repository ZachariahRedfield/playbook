import type { ArchitectureRegistry, ArtifactLineage, CommandInspection, Subsystem } from './types.js';
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

export type CommandInspectionDetails = {
  command: string;
  inspection: CommandInspection;
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


const normalizeArtifacts = (artifacts: string[]): string[] => [...artifacts].sort((left, right) => left.localeCompare(right));

const deriveCommonFailurePrerequisites = (subsystem: Subsystem): string[] => {
  const prerequisites: string[] = [
    `Architecture registry contains subsystem \"${subsystem.name}\" and command mappings.`,
    ...subsystem.artifacts.map((artifact) => `Required artifact available: ${artifact}.`)
  ];

  if ((subsystem.upstream ?? []).length > 0) {
    prerequisites.push(...(subsystem.upstream ?? []).map((upstream) => `Upstream subsystem healthy: ${upstream}.`));
  }

  return prerequisites;
};

const findSubsystemByCommand = (registry: ArchitectureRegistry, commandName: string): Subsystem | undefined =>
  registry.subsystems.find((subsystem) => subsystem.commands.includes(commandName));

export const explainCommandOwnership = (repoRoot: string, commandName: string): CommandInspectionDetails => {
  const registry = loadArchitecture(repoRoot);
  const subsystem = findSubsystemByCommand(registry, commandName);

  if (!subsystem) {
    throw new Error(`playbook explain command: unknown command \"${commandName}\".`);
  }

  const artifactsWritten = normalizeArtifacts(subsystem.artifacts);
  const artifactsRead = normalizeArtifacts(
    registry.subsystems
      .filter((candidate) => candidate.name !== subsystem.name && (candidate.downstream ?? []).includes(subsystem.name))
      .flatMap((candidate) => candidate.artifacts)
  );

  return {
    command: commandName,
    inspection: {
      command: commandName,
      subsystem: subsystem.name,
      artifactsRead,
      artifactsWritten,
      rationaleSummary: subsystem.purpose,
      downstreamConsumers: [...(subsystem.downstream ?? [])],
      commonFailurePrerequisites: deriveCommonFailurePrerequisites(subsystem)
    }
  };
};
