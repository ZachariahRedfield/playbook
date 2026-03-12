export interface OrchestratorLaneContract {
  id: string;
  title: string;
  objective: string;
  allowedPaths: string[];
  forbiddenPaths: string[];
  sharedPaths: string[];
  wave: number;
  dependsOn: string[];
  promptFile: string;
  verification: string[];
  documentationUpdates: string[];
}

export interface OrchestratorContract {
  schemaVersion: '1.0';
  command: 'orchestrate';
  goal: string;
  laneCountRequested: number;
  laneCountProduced: number;
  sharedPaths: string[];
  warnings: string[];
  lanes: OrchestratorLaneContract[];
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

export interface CompileOrchestratorArtifactsInput {
  cwd: string;
  goal: string;
  laneCountRequested: number;
  outDir: string;
  artifactFormat: 'md' | 'json' | 'both';
}

export interface CompileOrchestratorArtifactsResult {
  contract: OrchestratorContract;
  artifact: OrchestratorArtifactWriteResult;
  outputDir: string;
  relativeOutputDir: string;
}
