export type SharedFileHandling = 'single-owner' | 'deferred-merge';

export interface SharedFilePolicy {
  path: string;
  handling: SharedFileHandling;
  ownerLaneId: string | null;
  notes: string;
}

export interface LaneContract {
  id: string;
  wave: number;
  goal: string;
  dependsOn: string[];
  allowedPaths: string[];
  forbiddenPaths: string[];
  sharedPaths: string[];
}

export interface OrchestratorContract {
  generatedAt: string;
  goal: string;
  lanes: LaneContract[];
  sharedFilePolicy: SharedFilePolicy[];
}

export interface PlannerLaneInput {
  goal: string;
  wave?: number;
  dependsOn?: string[];
  allowedPaths: string[];
  forbiddenPaths?: string[];
  sharedPaths?: string[];
}

export interface BuildOrchestratorContractInput {
  goal: string;
  repoRoot: string;
  lanes: PlannerLaneInput[];
  overlapStrategy?: 'fail' | 'migrate-to-shared';
}

export interface OrchestratorArtifactWriteResult {
  outputDir: string;
  orchestratorPath: string;
  lanePromptPaths: string[];
}
