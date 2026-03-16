export type SubsystemDependencies = {
  upstream?: string[];
  downstream?: string[];
};

export type Subsystem = SubsystemDependencies & {
  name: string;
  purpose: string;
  commands: string[];
  artifacts: string[];
};

export type ArchitectureRegistry = {
  version: number;
  subsystems: Subsystem[];
};

export type ArtifactOwnership = {
  artifact: string;
  subsystem: string;
};

export type ArtifactLineage = {
  ownerSubsystem: string;
  upstreamSubsystem: string | null;
  downstreamConsumers: string[];
};

export type CommandInspection = {
  command: string;
  subsystem: string;
  artifactsRead: string[];
  artifactsWritten: string[];
  rationaleSummary: string;
  downstreamConsumers: string[];
  commonFailurePrerequisites: string[];
};
