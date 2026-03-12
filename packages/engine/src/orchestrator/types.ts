export interface OrchestratorLane {
  id: string;
  title: string;
  objective: string;
  whyThisLaneExists: string;
  allowedPaths: string[];
  forbiddenPaths: string[];
  sharedPaths: string[];
  wave: number;
  dependsOn: string[];
  promptFile: string;
  verification: string[];
  documentationUpdates: string[];
  implementationPlan: string[];
  mergeNotes: string[];
}

export interface OrchestratorContract {
  schemaVersion: '1.0';
  command: 'orchestrate';
  goal: string;
  laneCountRequested: number;
  laneCountProduced: number;
  sharedPaths: string[];
  warnings: string[];
  lanes: OrchestratorLane[];
}

export interface BuildOrchestratorContractInput {
  goal: string;
  laneCountRequested: number;
}

export interface OrchestratorArtifactWriteResult {
  outputDir: string;
  orchestratorPath: string;
  lanePromptPaths: string[];
}
