import {
  explainArtifactOwnership as explainArtifactOwnershipFromRegistry,
  explainCommandOwnership as explainCommandOwnershipFromRegistry,
  explainSubsystemOwnership as explainSubsystemOwnershipFromRegistry,
  type ArtifactOwnershipDetails,
  type CommandInspectionDetails,
  type SubsystemOwnership
} from '@zachariahredfield/playbook-core';

export const explainSubsystemFromArchitecture = (projectRoot: string, subsystemName: string): SubsystemOwnership =>
  explainSubsystemOwnershipFromRegistry(projectRoot, subsystemName);

export const explainArtifactFromArchitecture = (projectRoot: string, artifactPath: string): ArtifactOwnershipDetails =>
  explainArtifactOwnershipFromRegistry(projectRoot, artifactPath);


export const explainCommandFromArchitecture = (projectRoot: string, commandName: string): CommandInspectionDetails =>
  explainCommandOwnershipFromRegistry(projectRoot, commandName);
