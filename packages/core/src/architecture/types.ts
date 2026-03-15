export type Subsystem = {
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
