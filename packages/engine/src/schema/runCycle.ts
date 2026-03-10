export type RunCycleArtifactRef = {
  path: string;
  digest?: string;
};

export type RunCycleForwardArc = {
  aiContext?: RunCycleArtifactRef;
  aiContract?: RunCycleArtifactRef;
  repoIndex?: RunCycleArtifactRef;
  repoGraph?: RunCycleArtifactRef;
};

export type RunCycleReturnArc = {
  verify?: RunCycleArtifactRef;
  plan?: RunCycleArtifactRef;
  apply?: RunCycleArtifactRef;
  postVerify?: RunCycleArtifactRef;
};

export type RunCycleZettelkastenRefs = {
  zettels?: RunCycleArtifactRef;
  links?: RunCycleArtifactRef;
};

export type RunCycleStateSpaceRefs = {
  projection: 'bloch-v1';
  bloch: RunCycleArtifactRef;
};

export type RunCycleGraphMemoryRefs = {
  snapshot?: RunCycleArtifactRef;
  groups?: RunCycleArtifactRef;
  candidatePatterns?: RunCycleArtifactRef;
  draftPatternCards?: RunCycleArtifactRef;
  promotionReviewQueue?: RunCycleArtifactRef;
  promotionDecisions?: RunCycleArtifactRef;
  promotedPatternCards?: RunCycleArtifactRef;
};

export type RunCycleMetrics = {
  loopClosureRate: number;
  promotionYield: number;
  compactionGain: number;
  reuseRate: number;
  driftScore: number;
  entropyBudget: number;
};

export type RunCycle = {
  schemaVersion: '1.0';
  kind: 'playbook-run-cycle';
  runCycleId: string;
  createdAt: string;
  repository: {
    root: string;
    git?: {
      commit: string;
      shortSha: string;
    };
  };
  forwardArc: RunCycleForwardArc;
  returnArc: RunCycleReturnArc;
  zettelkasten: RunCycleZettelkastenRefs;
  graphMemory?: RunCycleGraphMemoryRefs;
  stateSpace?: RunCycleStateSpaceRefs;
  metrics: RunCycleMetrics;
};
