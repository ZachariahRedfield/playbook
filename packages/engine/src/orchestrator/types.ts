export interface ProtectedSingletonDoc {
  targetDoc: string;
  consolidationStrategy: 'deterministic-final-pass';
  rationale: string;
}

export interface WorkerFragmentContract {
  schemaVersion: '1.0';
  kind: 'worker-fragment';
  artifactPath: string;
  targetDoc: string;
  sectionKey: string;
  conflictKey: string;
  orderingKey: string;
  machineFacing: true;
}

export interface OrchestratorLaneContract {
  id: string;
  title: string;
  objective: string;
  shardKey: string;
  allowedPaths: string[];
  forbiddenPaths: string[];
  sharedPaths: string[];
  protectedSingletonDocs: ProtectedSingletonDoc[];
  workerFragment: WorkerFragmentContract | null;
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
  protectedSingletonDocs: ProtectedSingletonDoc[];
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
  workerBundleDirs: string[];
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
