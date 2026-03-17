declare module "@zachariahredfield/playbook-core" {
  export const analyze: (...args: any[]) => Promise<any>;
  export const formatAnalyzeCi: (...args: any[]) => Promise<any>;
  export const formatAnalyzeHuman: (...args: any[]) => Promise<any>;
  export const formatAnalyzeJson: (...args: any[]) => Promise<any>;
  export const verify: (...args: any[]) => Promise<any>;
  export const formatHuman: (...args: any[]) => Promise<any>;
  export const formatJson: (...args: any[]) => Promise<any>;
  export const runArchitectureAudit: (...args: any[]) => any;
  export const loadArchitecture: (...args: any[]) => any;
  export type CommandExecutionQualityArtifact = any;
}

declare module "@zachariahredfield/playbook-node" {
  export const createNodeContext: (...args: any[]) => Promise<any>;
}

declare module "@zachariahredfield/playbook-engine" {
  export const loadConfig: (...args: any[]) => Promise<any>;
  export const generateRepositoryHealth: (...args: any[]) => any;
  export const buildRepoAdoptionReadiness: (...args: any[]) => any;
  export type RepoAdoptionReadiness = any;
  export type ArtifactHygieneReport = any;
  export const analyzePullRequest: (...args: any[]) => any;
  export const formatAnalyzePrGithubComment: (...args: any[]) => string;
  export const formatAnalyzePrOutput: (...args: any[]) => string;
  export const generateKnowledgeCandidatesDraft: (...args: any[]) => any;
  export const replayMemoryToCandidates: (...args: any[]) => any;
  export const lookupMemoryEventTimeline: (...args: any[]) => any[];
  export const lookupMemoryCandidateKnowledge: (...args: any[]) => any[];
  export const lookupPromotedMemoryKnowledge: (...args: any[]) => any[];
  export const expandMemoryProvenance: (...args: any[]) => any[];
  export const loadCandidateKnowledgeById: (...args: any[]) => any;
  export const promoteMemoryCandidate: (...args: any[]) => any;
  export const retirePromotedKnowledge: (...args: any[]) => any;
  export const pruneMemoryKnowledge: (...args: any[]) => any;
  export type KnowledgeQueryOptions = any;
  export const knowledgeList: (...args: any[]) => any;
  export const knowledgeQuery: (...args: any[]) => any;
  export const knowledgeInspect: (...args: any[]) => any;
  export const knowledgeTimeline: (...args: any[]) => any;
  export const knowledgeProvenance: (...args: any[]) => any;
  export const knowledgeStale: (...args: any[]) => any;
  export const generateRepositoryIndex: (...args: any[]) => any;
  export const generateRepositoryGraph: (...args: any[]) => any;
  export const buildModuleContextDigests: (...args: any[]) => any;
  export const writeModuleContextDigests: (...args: any[]) => any;
  export const generateCompactionCandidateArtifact: (...args: any[]) => any;
  export const extractCompactionCandidates: (...args: any[]) => any[];
  export const bucketCompactionCandidates: (...args: any[]) => any[];
  export const readPatternCards: (...args: any[]) => any[];
  export const toExistingPatternTargets: (...args: any[]) => any[];
  export type BucketedCandidateEntry = any;
  export const readModuleContextDigest: (...args: any[]) => any;
  export const readRepositoryGraph: (...args: any[]) => any;
  export const summarizeRepositoryGraph: (...args: any[]) => any;
  export const REPOSITORY_GRAPH_RELATIVE_PATH: '.playbook/repo-graph.json';
  export const MODULE_CONTEXT_DIR_RELATIVE_PATH: '.playbook/context/modules';
  export const loadAiContract: (...args: any[]) => any;
  export const buildContractRegistry: (...args: any[]) => any;
  export type OrchestratorContract = any;
  export type OrchestratorLane = any;
  export const buildOrchestratorContract: (...args: any[]) => OrchestratorContract;
  export type CompileOrchestratorArtifactsResult = {
    contract: {
      goal: string;
      laneCountRequested: number;
      laneCountProduced: number;
      warnings: string[];
    };
    artifact: {
      outputDir: string;
      orchestratorPath: string;
      lanePromptPaths: string[];
      workerBundleDirs: string[];
    };
    outputDir: string;
    relativeOutputDir: string;
  };
  export const compileOrchestratorArtifacts: (...args: any[]) => CompileOrchestratorArtifactsResult;

  export const queryRepositoryIndex: (...args: any[]) => any;
  export const queryDependencies: (...args: any[]) => any;
  export const queryImpact: (...args: any[]) => any;
  export const queryRisk: (...args: any[]) => any;
  export const queryDocsCoverage: (...args: any[]) => any;
  export const queryRuleOwners: (...args: any[]) => any;
  export const queryModuleOwners: (...args: any[]) => any;
  export const queryTestHotspots: (...args: any[]) => any;
  export const runDocsAudit: (...args: any[]) => any;
  export type DependenciesQueryResult = any;
  export type ImpactQueryResult = any;
  export type RiskQueryResult = any;
  export type DocsCoverageModuleResult = { module: string; documented: boolean; sources: string[] };
  export type DocsCoverageSummary = { totalModules: number; documentedModules: number; undocumentedModules: number };
  export type DocsCoverageQueryResult = {
    schemaVersion: '1.0';
    command: 'query';
    type: 'docs-coverage';
    modules: DocsCoverageModuleResult[];
    summary: DocsCoverageSummary;
  };
  export type RuleOwnershipEntry = { ruleId: string; area: string; owners: string[]; remediationType: string };
  export type RuleOwnersQueryResult =
    | { schemaVersion: '1.0'; command: 'query'; type: 'rule-owners'; rules: RuleOwnershipEntry[] }
    | { schemaVersion: '1.0'; command: 'query'; type: 'rule-owners'; rule: RuleOwnershipEntry };
  export type ModuleOwnershipStatus =
    | 'configured'
    | 'no-metadata-configured'
    | 'intentionally-unowned'
    | 'inherited-default'
    | 'unresolved-mapping';
  export type ModuleOwnershipEntry = {
    name: string;
    owners: string[];
    area: string;
    ownership: { status: ModuleOwnershipStatus; source: string; sourceLocation?: string };
  };
  export type ModuleOwnersQueryResult =
    | {
        schemaVersion: '1.0';
        command: 'query';
        type: 'module-owners';
        contract: { minimumFields: ['owners', 'area', 'sourceLocation']; metadataPath: '.playbook/module-owners.json' };
        diagnostics: string[];
        modules: ModuleOwnershipEntry[];
      }
    | {
        schemaVersion: '1.0';
        command: 'query';
        type: 'module-owners';
        contract: { minimumFields: ['owners', 'area', 'sourceLocation']; metadataPath: '.playbook/module-owners.json' };
        diagnostics: string[];
        module: ModuleOwnershipEntry;
      };

  export type TestHotspotType = 'broad-retrieval' | 'repeated-fixture-setup' | 'repeated-cli-runner' | 'manual-json-contract-plumbing';
  export type TestHotspot = {
    type: TestHotspotType;
    file: string;
    line: number;
    confidence: 'high' | 'medium';
    currentPattern: string;
    suggestedReplacementHelper: string;
    automationSafety: 'safe-mechanical-refactor' | 'review-required';
  };
  export type TestHotspotsQueryResult = {
    schemaVersion: '1.0';
    command: 'query';
    type: 'test-hotspots';
    hotspots: TestHotspot[];
    summary: { totalHotspots: number; byType: Array<{ type: TestHotspotType; count: number }> };
  };

  export type ModuleContextDigest = any;
  export type GraphNeighborhoodSummary = {
    node: { id: string; kind: 'module' | 'repository' | 'rule'; name: string };
    outgoing: Array<{ kind: 'contains' | 'depends_on' | 'governed_by'; target: string }>;
    incoming: Array<{ kind: 'contains' | 'depends_on' | 'governed_by'; source: string }>;
  };
  export type RepositoryModule = any;
  export const answerRepositoryQuestion: (...args: any[]) => any;
  export const queryPatterns: (...args: any[]) => any;
  export const queryPatternReviewQueue: (...args: any[]) => any;
  export const queryPromotedPatterns: (...args: any[]) => any;
  export const promotePatternCandidate: (...args: any[]) => any;
  export const scorePatternGraph: (...args: any[]) => any;
  export const listTopPatterns: (...args: any[]) => any[];
  export const computePatternFitness: (...args: any[]) => any;
  export const appendFitnessStrengthScore: (...args: any[]) => any;
  export const computePatternStrength: (...args: any[]) => number;
  export type PatternFitnessSignals = any;
  export type PatternOutcomeLinks = any;
  export type PatternGraphArtifact = any;

  export const computeCrossRepoPatternLearning: (...args: any[]) => any;
  export const writeCrossRepoPatternsArtifact: (...args: any[]) => string;
  export const readCrossRepoPatternsArtifact: (...args: any[]) => any;
  export type CrossRepoInput = any;
  export type CrossRepoPatternsArtifact = any;
  export const buildPatternProposalArtifact: (...args: any[]) => any;
  export const generatePatternProposalArtifact: (...args: any[]) => any;
  export const writePatternProposalArtifact: (...args: any[]) => string;
  export const readPatternProposalArtifact: (...args: any[]) => any;
  export type PatternProposalArtifact = any;
  export const explainTarget: (...args: any[]) => any;
  export type ExplainTargetResult = any;
  export const SUPPORTED_QUERY_FIELDS: readonly string[];
  export type RepositoryQueryField = string;
  export const generateArchitectureDiagrams: (...args: any[]) => Promise<any>;
  export const verifyRepo: (...args: any[]) => any;
  export const formatHuman: (...args: any[]) => string;
  export const generateExecutionPlan: (...args: any[]) => any;
  export const generatePlanContract: (...args: any[]) => any;
  export const applyExecutionPlan: (...args: any[]) => Promise<any>;
  export const parsePlanArtifact: (...args: any[]) => any;
  export const validateRemediationPlan: (...args: any[]) => any;
  export const readSecurityBaselineArtifact: (...args: any[]) => any;
  export const showSecurityBaselineForPackage: (...args: any[]) => any;
  export const summarizeSecurityBaseline: (...args: any[]) => any;
  export type SecurityBaselineArtifact = any;
  export type SecurityBaselineSummary = any;
  export const parsePlaybookIgnore: (...args: any[]) => any;
  export const isPlaybookIgnored: (...args: any[]) => boolean;
  export const suggestPlaybookIgnore: (...args: any[]) => any;
  export const applySafePlaybookIgnoreRecommendations: (...args: any[]) => any;
  export type PlaybookIgnoreSuggestResult = any;
  export type PlaybookIgnoreApplyResult = any;
  export const getCliSchemas: (...args: any[]) => any;
  export const getCliSchema: (...args: any[]) => any;
  export const isCliSchemaCommand: (...args: any[]) => boolean;
  export const CLI_SCHEMA_COMMANDS: readonly string[];
  export const cleanupSessionSnapshots: (...args: any[]) => any;
  export const formatMergeReportMarkdown: (...args: any[]) => string;
  export const importChatTextSnapshot: (...args: any[]) => any;
  export const mergeSessionSnapshots: (...args: any[]) => any;
  export const validateSessionSnapshot: (...args: any[]) => any;

  export type RouteDecision = {
    route: 'deterministic_local' | 'model_reasoning' | 'hybrid' | 'unsupported';
    why: string;
    requiredInputs: string[];
    missingPrerequisites: string[];
    repoMutationAllowed: boolean;
  };
  export const routeTask: (...args: any[]) => RouteDecision;
  export const buildExecutionPlan: (...args: any[]) => any;
  export const compileCodexPrompt: (...args: any[]) => string;
  export const safeRecordRepositoryEvent: (callback: () => void) => void;
  export const recordRouteDecision: (...args: any[]) => any;
  export const recordLaneTransition: (...args: any[]) => any;
  export const recordWorkerAssignment: (...args: any[]) => any;
  export const recordLaneOutcome: (...args: any[]) => any;
  export const recordImprovementCandidate: (...args: any[]) => any;
  export const appendCommandExecutionQualityRecord: (...args: any[]) => any;
  export const buildCommandQualitySummaryArtifact: (...args: any[]) => any;
  export const recordCommandExecution: (...args: any[]) => any;
  export const recordCommandQuality: (...args: any[]) => any;
  export type TaskExecutionProfileArtifact = any;
  export type ExecutionPlanArtifact = any;

  export type WorksetPlanArtifact = any;
  export type LaneStateArtifact = any;
  export const buildWorksetPlan: (...args: any[]) => WorksetPlanArtifact;
  export const deriveLaneState: (...args: any[]) => LaneStateArtifact;
  export type WorkerAssignmentsArtifact = any;
  export const assignWorkersToLanes: (...args: any[]) => WorkerAssignmentsArtifact;
  export const buildAssignedPrompt: (...args: any[]) => string;
  export type LaneLifecycleTransition = { action: 'start' | 'complete'; lane_id: string };
  export type LaneLifecycleTransitionResult = { laneState: LaneStateArtifact; applied: boolean; reason?: string };
  export const applyLaneLifecycleTransition: (...args: any[]) => LaneLifecycleTransitionResult;
  export type OutcomeTelemetryArtifact = any;
  export type ProcessTelemetryArtifact = any;
  export const normalizeOutcomeTelemetryArtifact: (...args: any[]) => OutcomeTelemetryArtifact;
  export const normalizeProcessTelemetryArtifact: (...args: any[]) => ProcessTelemetryArtifact;
  export const summarizeStructuralTelemetry: (...args: any[]) => any;
  export const summarizeLaneOutcomeScores: (...args: any[]) => any;
  export const summarizeCycleTelemetry: (...args: any[]) => any;
  export const summarizeCycleRegressions: (...args: any[]) => any;
  export type CycleHistoryArtifact = any;
  export type CycleStateArtifact = any;
  export type LearningStateSnapshotArtifact = any;
  export const POLICY_EVALUATION_RELATIVE_PATH: '.playbook/policy-evaluation.json';
  export const evaluateImprovementPolicy: (...args: any[]) => any;
  export type PolicyEvaluationEntry = any;
  export type PolicyEvaluationArtifact = any;
  export const buildPolicyPreflight: (...args: any[]) => any;
  export type PolicyPreflightProposal = any;
  export type PolicyPreflightArtifact = any;
  export const deriveLearningStateSnapshot: (...args: any[]) => LearningStateSnapshotArtifact;
  export type LearningCompactionArtifact = any;
  export const generateLearningCompactionArtifact: (...args: any[]) => LearningCompactionArtifact;
  export const writeLearningCompactionArtifact: (...args: any[]) => string;
  export type PortabilityOutcomesArtifact = any;
  export const readPortabilityOutcomesArtifact: (...args: any[]) => PortabilityOutcomesArtifact;
  export const appendPortabilityOutcomes: (...args: any[]) => PortabilityOutcomesArtifact;
  export const summarizePortabilityOutcomes: (...args: any[]) => any[];
  export const validateArtifacts: (...args: any[]) => any;

  export type ImprovementCandidatesArtifact = any;
  export type ImprovementActionArtifact = any;
  export type ImprovementGovernanceApprovalArtifact = any;
  export const generateImprovementCandidates: (...args: any[]) => ImprovementCandidatesArtifact;
  export const writeImprovementCandidatesArtifact: (...args: any[]) => string;
  export const applyAutoSafeImprovements: (...args: any[]) => ImprovementActionArtifact;
  export const approveGovernanceImprovement: (...args: any[]) => ImprovementGovernanceApprovalArtifact;

  export const listRuntimeRuns: (...args: any[]) => any[];
  export const readRuntimeRun: (...args: any[]) => any;
  export const listRuntimeTasks: (...args: any[]) => any[];
  export const listRuntimeLogRecords: (...args: any[]) => any[];
  export const readRuntimeControlPlaneStatus: (...args: any[]) => any;
  export const runAgentPlanDryRun: (...args: any[]) => any;
  export const createExecutionIntent: (...args: any[]) => any;
  export const createExecutionRun: (...args: any[]) => any;
  export const appendExecutionStep: (...args: any[]) => any;
  export const completeExecutionRun: (...args: any[]) => any;
  export const listExecutionRuns: (...args: any[]) => any[];
  export const readExecutionRun: (...args: any[]) => any;
  export const getLatestMutableRun: (...args: any[]) => any;
  export const executionRunPath: (...args: any[]) => string;
  export const writeSystemMapArtifact: (...args: any[]) => { artifactPath: string; artifact: any };
  export const SYSTEM_MAP_RELATIVE_PATH: '.playbook/system-map.json';

  export const initializeSession: (...args: any[]) => any;
  export const readSession: (...args: any[]) => any;
  export const updateSession: (...args: any[]) => any;
  export const pinSessionArtifact: (...args: any[]) => any;
  export const clearSession: (...args: any[]) => boolean;
  export const resumeSession: (...args: any[]) => any;
  export const attachSessionRunState: (...args: any[]) => any;
}
