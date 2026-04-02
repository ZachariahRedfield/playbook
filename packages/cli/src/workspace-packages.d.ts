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
  export const TEST_AUTOFIX_ARTIFACT_KIND: any;
  export const TEST_AUTOFIX_SCHEMA_VERSION: any;
  export type TestAutofixArtifact = any;
  export type TestAutofixApplySummary = any;
  export type TestAutofixExcludedFindingSummary = any;
  export type TestAutofixFinalStatus = any;
  export type TestAutofixVerificationCommandResult = any;
  export type TestAutofixVerificationSummary = any;
  export type TestFixPlanArtifact = any;
  export type TestTriageArtifact = any;
}

declare module "@zachariahredfield/playbook-node" {
  export const createNodeContext: (...args: any[]) => Promise<any>;
}

declare module "@zachariahredfield/playbook-engine" {
  export const loadConfig: (...args: any[]) => Promise<any>;
  export const buildMemoryPressureStatusArtifact: (...args: any[]) => any;
  export const generateRepositoryHealth: (...args: any[]) => any;
  export const buildRepoAdoptionReadiness: (...args: any[]) => any;
  export const runBootstrapProof: (...args: any[]) => any;
  export const classifyProofFailureDomains: (...args: any[]) => any;
  export const classifySignalFailureDomains: (...args: any[]) => any;
  export const readProofParallelWorkSummary: (...args: any[]) => any;
  export const resolveBootstrapCliAvailability: (...args: any[]) => any;
  export const defaultBootstrapCliResolutionCommands: (...args: any[]) => any;
  export type BootstrapCliResolutionCommand = any;
  export type FailureDomainSummary = any;
  export const buildFleetAdoptionReadinessSummary: (...args: any[]) => any;
  export const buildFleetAdoptionWorkQueue: (...args: any[]) => any;
  export const buildFleetCodexExecutionPlan: (...args: any[]) => any;
  export const buildFleetExecutionReceipt: (...args: any[]) => any;
  export const buildFleetUpdatedAdoptionState: (...args: any[]) => any;
  export const deriveNextAdoptionQueueFromUpdatedState: (...args: any[]) => any;
  export const buildExecutionOutcomeInputFromResults: (...args: any[]) => any;
  export const ingestExecutionResults: (...args: any[]) => any;
  export type ExecutionResult = any;
  export type RepoAdoptionReadiness = any;
  export type FleetAdoptionReadinessSummary = any;
  export type FleetAdoptionWorkQueue = any;
  export type FleetCodexExecutionPlan = any;
  export type FleetExecutionOutcomeInput = any;
  export type FleetExecutionReceipt = any;
  export type FleetUpdatedAdoptionState = any;
  export type ArtifactHygieneReport = any;
  export const analyzePullRequest: (...args: any[]) => any;
  export const formatAnalyzePrGithubComment: (...args: any[]) => string;
  export const formatAnalyzePrOutput: (...args: any[]) => string;
  export const generateKnowledgeCandidatesDraft: (...args: any[]) => any;
  export const extractDoctrineFromSummary: (...args: any[]) => any;
  export const readDoctrineExtractionInput: (...args: any[]) => any;
  export type DoctrineExtractionResult = any;
  export const replayMemoryToCandidates: (...args: any[]) => any;
  export const lookupMemoryEventTimeline: (...args: any[]) => any[];
  export const lookupMemoryCandidateKnowledge: (...args: any[]) => any[];
  export const lookupPromotedMemoryKnowledge: (...args: any[]) => any[];
  export const expandMemoryProvenance: (...args: any[]) => any[];
  export const loadCandidateKnowledgeById: (...args: any[]) => any;
  export const promoteMemoryCandidate: (...args: any[]) => any;
  export const retirePromotedKnowledge: (...args: any[]) => any;
  export const pruneMemoryKnowledge: (...args: any[]) => any;
  export const generateAndWriteLifecycleCandidatesArtifact: (...args: any[]) => any;
  export const REVIEW_QUEUE_SCHEMA_VERSION: any;
  export const REVIEW_QUEUE_RELATIVE_PATH: '.playbook/review-queue.json';
  export const buildReviewQueue: (...args: any[]) => any;
  export const writeReviewQueueArtifact: (...args: any[]) => any;
  export type ReviewRecommendedAction = any;
  export type ReviewPriority = any;
  export type ReviewTargetKind = any;
  export type ReviewQueueEntry = any;
  export type ReviewQueueArtifact = any;
  export type BuildReviewQueueOptions = any;
  export const REVIEW_HANDOFFS_SCHEMA_VERSION: any;
  export const REVIEW_HANDOFFS_RELATIVE_PATH: '.playbook/review-handoffs.json';
  export const buildReviewHandoffsArtifact: (...args: any[]) => any;
  export const writeReviewHandoffsArtifact: (...args: any[]) => any;
  export type ReviewHandoffDecision = any;
  export type ReviewHandoffFollowupType = any;
  export type ReviewHandoffEntry = any;
  export type ReviewDeferredMetadata = any;
  export type ReviewHandoffsArtifact = any;
  export const REVIEW_HANDOFF_ROUTES_SCHEMA_VERSION: any;
  export const REVIEW_HANDOFF_ROUTES_RELATIVE_PATH: '.playbook/review-handoff-routes.json';
  export const buildReviewHandoffRoutesArtifact: (...args: any[]) => any;
  export const writeReviewHandoffRoutesArtifact: (...args: any[]) => any;
  export type ReviewHandoffRouteTargetKind = any;
  export type ReviewHandoffRouteSurface = any;
  export type ReviewHandoffRouteEntry = any;
  export type ReviewHandoffRoutesArtifact = any;
  export const REVIEW_DOWNSTREAM_FOLLOWUPS_SCHEMA_VERSION: any;
  export const REVIEW_DOWNSTREAM_FOLLOWUPS_RELATIVE_PATH: '.playbook/review-downstream-followups.json';
  export const buildReviewDownstreamFollowupsArtifact: (...args: any[]) => any;
  export const writeReviewDownstreamFollowupsArtifact: (...args: any[]) => any;
  export type ReviewDownstreamFollowupType = any;
  export type ReviewDownstreamFollowupEntry = any;
  export type ReviewDownstreamFollowupsArtifact = any;
  export const KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION: any;
  export const KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH: '.playbook/knowledge-review-receipts.json';
  export const readKnowledgeReviewReceiptsArtifact: (...args: any[]) => any;
  export const writeKnowledgeReviewReceiptsArtifact: (...args: any[]) => any;
  export const writeKnowledgeReviewReceipt: (...args: any[]) => any;
  export type KnowledgeReviewDecision = any;
  export type KnowledgeReviewTargetKind = any;
  export type KnowledgeReviewReceiptEntry = any;
  export type KnowledgeReviewReceiptsArtifact = any;
  export type WriteKnowledgeReviewReceiptInput = any;
  export type KnowledgeQueryOptions = any;
  export const knowledgeList: (...args: any[]) => any;
  export const knowledgeQuery: (...args: any[]) => any;
  export const knowledgeInspect: (...args: any[]) => any;
  export const knowledgeCompareQuery: (...args: any[]) => any;
  export const knowledgeTimeline: (...args: any[]) => any;
  export const knowledgeProvenance: (...args: any[]) => any;
  export const knowledgeSupersession: (...args: any[]) => any;
  export const knowledgeStale: (...args: any[]) => any;
  export const generateRepositoryIndex: (...args: any[]) => any;
  export const generateRepositoryGraph: (...args: any[]) => any;
  export const buildModuleContextDigests: (...args: any[]) => any;
  export const RUNTIME_MANIFESTS_RELATIVE_PATH: ".playbook/runtime-manifests.json";
  export const readConsumedRuntimeManifestsArtifact: (...args: any[]) => any;
  export const materializeRuntimeManifestsArtifact: (...args: any[]) => any;
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
  export const REPOSITORY_GRAPH_RELATIVE_PATH: ".playbook/repo-graph.json";
  export const MODULE_CONTEXT_DIR_RELATIVE_PATH: ".playbook/context/modules";
  export const loadAiContract: (...args: any[]) => any;
  export const generateAiProposal: (...args: any[]) => any;
  export type GenerateAiProposalOptions = any;
  export const assessReleaseSync: (...args: any[]) => any;
  export const classifyReleaseSyncReconciliation: (...args: any[]) => any;
  export const buildContractRegistry: (...args: any[]) => any;
  export type OrchestratorContract = any;
  export type OrchestratorLane = any;
  export const buildOrchestratorContract: (
    ...args: any[]
  ) => OrchestratorContract;
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
  export const compileOrchestratorArtifacts: (
    ...args: any[]
  ) => CompileOrchestratorArtifactsResult;

  export const queryRepositoryIndex: (...args: any[]) => any;
  export const queryDependencies: (...args: any[]) => any;
  export const queryImpact: (...args: any[]) => any;
  export const queryRisk: (...args: any[]) => any;
  export const queryDocsCoverage: (...args: any[]) => any;
  export const queryRuleOwners: (...args: any[]) => any;
  export const queryModuleOwners: (...args: any[]) => any;
  export const queryTestHotspots: (...args: any[]) => any;
  export const runDocsAudit: (...args: any[]) => any;
  export const runDocsConsolidation: (...args: any[]) => any;
  export const runDocsConsolidationPlan: (...args: any[]) => any;
  export type DependenciesQueryResult = any;
  export type ImpactQueryResult = any;
  export type RiskQueryResult = any;
  export type DocsCoverageModuleResult = {
    module: string;
    documented: boolean;
    sources: string[];
  };
  export type DocsCoverageSummary = {
    totalModules: number;
    documentedModules: number;
    undocumentedModules: number;
  };
  export type DocsCoverageQueryResult = {
    schemaVersion: "1.0";
    command: "query";
    type: "docs-coverage";
    modules: DocsCoverageModuleResult[];
    summary: DocsCoverageSummary;
  };
  export type RuleOwnershipEntry = {
    ruleId: string;
    area: string;
    owners: string[];
    remediationType: string;
  };
  export type RuleOwnersQueryResult =
    | {
        schemaVersion: "1.0";
        command: "query";
        type: "rule-owners";
        rules: RuleOwnershipEntry[];
      }
    | {
        schemaVersion: "1.0";
        command: "query";
        type: "rule-owners";
        rule: RuleOwnershipEntry;
      };
  export type ModuleOwnershipStatus =
    | "configured"
    | "no-metadata-configured"
    | "intentionally-unowned"
    | "inherited-default"
    | "unresolved-mapping";
  export type ModuleOwnershipEntry = {
    name: string;
    owners: string[];
    area: string;
    ownership: {
      status: ModuleOwnershipStatus;
      source: string;
      sourceLocation?: string;
    };
  };
  export type ModuleOwnersQueryResult =
    | {
        schemaVersion: "1.0";
        command: "query";
        type: "module-owners";
        contract: {
          minimumFields: ["owners", "area", "sourceLocation"];
          metadataPath: ".playbook/module-owners.json";
        };
        diagnostics: string[];
        modules: ModuleOwnershipEntry[];
      }
    | {
        schemaVersion: "1.0";
        command: "query";
        type: "module-owners";
        contract: {
          minimumFields: ["owners", "area", "sourceLocation"];
          metadataPath: ".playbook/module-owners.json";
        };
        diagnostics: string[];
        module: ModuleOwnershipEntry;
      };

  export type TestHotspotType =
    | "broad-retrieval"
    | "repeated-fixture-setup"
    | "repeated-cli-runner"
    | "manual-json-contract-plumbing";
  export type TestHotspot = {
    type: TestHotspotType;
    file: string;
    line: number;
    confidence: "high" | "medium";
    currentPattern: string;
    suggestedReplacementHelper: string;
    automationSafety: "safe-mechanical-refactor" | "review-required";
  };
  export type TestHotspotsQueryResult = {
    schemaVersion: "1.0";
    command: "query";
    type: "test-hotspots";
    hotspots: TestHotspot[];
    summary: {
      totalHotspots: number;
      byType: Array<{ type: TestHotspotType; count: number }>;
    };
  };

  export type ModuleContextDigest = any;
  export type GraphNeighborhoodSummary = {
    node: { id: string; kind: "module" | "repository" | "rule"; name: string };
    outgoing: Array<{
      kind: "contains" | "depends_on" | "governed_by";
      target: string;
    }>;
    incoming: Array<{
      kind: "contains" | "depends_on" | "governed_by";
      source: string;
    }>;
  };
  export type RepositoryModule = any;
  export const answerRepositoryQuestion: (...args: any[]) => any;
  export const queryPatterns: (...args: any[]) => any;
  export const loadValidatedCsiaFramework: (...args: any[]) => { artifact: any; sourcePathForOutput: string };
  export const DEFAULT_CSIA_SOURCE: string;
  export const CSIA_SCHEMA_SOURCE: string;
  export type CsiaPrimitive = 'compute' | 'simulate' | 'interpret' | 'adapt';
  export type CsiaRegime = any;
  export type CsiaFailureMode = any;
  export type CsiaFrameworkArtifact = any;
  export const queryPatternReviewQueue: (...args: any[]) => any;
  export const queryPromotedPatterns: (...args: any[]) => any;
  export const listOrchestrationExecutionRuns: (...args: any[]) => any;
  export const readOrchestrationExecutionRun: (...args: any[]) => any;
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
  export const promotePatternProposalToMemory: (...args: any[]) => any;
  export const promotePatternProposalToStory: (...args: any[]) => any;
  export const GLOBAL_PATTERNS_RELATIVE_PATH: string;
  export const materializeStoryFromSource: (...args: any[]) => any;
  export const materializePatternFromCandidate: (...args: any[]) => any;
  export const transitionPatternLifecycle: (...args: any[]) => any;
  export const resolvePatternKnowledgeStore: (...args: any[]) => any;
  export const exportPatternTransferPackage: (...args: any[]) => any;
  export const importPatternTransferPackage: (...args: any[]) => any;
  export const PATTERN_TRANSFER_PACKAGES_RELATIVE_DIR: string;
  export type PromotionSourceRef = string;
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
    route: "deterministic_local" | "model_reasoning" | "hybrid" | "unsupported";
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
  export type WorkerResultsArtifact = any;
  export type WorkerResultFragmentRef = any;
  export type WorkerResultArtifactRef = any;
  export const WORKER_RESULTS_RELATIVE_PATH: '.playbook/worker-results.json';
  export const buildWorksetPlan: (...args: any[]) => WorksetPlanArtifact;
  export const deriveLaneState: (...args: any[]) => LaneStateArtifact;
  export const createWorkerResultsArtifact: (...args: any[]) => WorkerResultsArtifact;
  export const readWorkerResultsArtifact: (...args: any[]) => WorkerResultsArtifact;
  export const validateWorkerResultInput: (...args: any[]) => string[];
  export const mergeWorkerResult: (...args: any[]) => { artifact: WorkerResultsArtifact; result: any };
  export const writeWorkerResultsArtifact: (...args: any[]) => void;
  export type WorkerAssignmentsArtifact = any;
  export type WorkerLaunchPlanArtifact = any;
  export const WORKER_LAUNCH_PLAN_RELATIVE_PATH: '.playbook/worker-launch-plan.json';
  export const buildWorkerLaunchPlan: (...args: any[]) => WorkerLaunchPlanArtifact;
  export const writeWorkerLaunchPlanArtifact: (...args: any[]) => void;
  export const assignWorkersToLanes: (
    ...args: any[]
  ) => WorkerAssignmentsArtifact;
  export const buildAssignedPrompt: (...args: any[]) => string;
  export type LaneLifecycleTransition = {
    action: "start" | "complete";
    lane_id: string;
  };
  export type LaneLifecycleTransitionResult = {
    laneState: LaneStateArtifact;
    applied: boolean;
    reason?: string;
  };
  export const applyLaneLifecycleTransition: (
    ...args: any[]
  ) => LaneLifecycleTransitionResult;
  export type OutcomeTelemetryArtifact = any;
  export type ProcessTelemetryArtifact = any;
  export const normalizeOutcomeTelemetryArtifact: (
    ...args: any[]
  ) => OutcomeTelemetryArtifact;
  export const normalizeProcessTelemetryArtifact: (
    ...args: any[]
  ) => ProcessTelemetryArtifact;
  export const summarizeStructuralTelemetry: (...args: any[]) => any;
  export const summarizeLaneOutcomeScores: (...args: any[]) => any;
  export const summarizeCycleTelemetry: (...args: any[]) => any;
  export const summarizeCycleRegressions: (...args: any[]) => any;
  export type CycleHistoryArtifact = any;
  export type CycleStateArtifact = any;
  export type LearningStateSnapshotArtifact = any;
  export const POLICY_EVALUATION_RELATIVE_PATH: ".playbook/policy-evaluation.json";
  export const evaluateImprovementPolicy: (...args: any[]) => any;
  export type PolicyEvaluationEntry = any;
  export type PolicyEvaluationArtifact = any;
  export const buildPolicyPreflight: (...args: any[]) => any;
  export type PolicyPreflightProposal = any;
  export type PolicyPreflightArtifact = any;
  export const deriveLearningStateSnapshot: (
    ...args: any[]
  ) => LearningStateSnapshotArtifact;
  export type LearningCompactionArtifact = any;
  export const generateLearningCompactionArtifact: (
    ...args: any[]
  ) => LearningCompactionArtifact;
  export const writeLearningCompactionArtifact: (...args: any[]) => string;
  export type PortabilityOutcomesArtifact = any;
  export const readPortabilityOutcomesArtifact: (
    ...args: any[]
  ) => PortabilityOutcomesArtifact;
  export const appendPortabilityOutcomes: (
    ...args: any[]
  ) => PortabilityOutcomesArtifact;
  export const summarizePortabilityOutcomes: (...args: any[]) => any[];
  export const validateArtifacts: (...args: any[]) => any;

  export const buildTestTriageArtifact: (...args: any[]) => any;
  export const renderTestTriageMarkdown: (...args: any[]) => string;
  export const renderTestTriageText: (...args: any[]) => string;
  export type TestTriageArtifact = any;
  export type TestTriageFailureKind = any;
  export type TestTriageFinding = any;
  export type TestTriageFailureModeNote = any;
  export type TestTriageRepairClass = any;
  export type TestTriageRepairPlan = any;

  export type StoryStatus =
    | "proposed"
    | "ready"
    | "in_progress"
    | "blocked"
    | "done"
    | "archived";
  export type StoryReconciliationStatus =
    | "pending_plan"
    | "in_progress"
    | "completed"
    | "blocked";
  export type StoryRecord = {
    story_reference?: string;
    id: string;
    repo: string;
    title: string;
    type: string;
    source: string;
    severity: string;
    priority: string;
    confidence: string;
    status: StoryStatus;
    evidence: string[];
    rationale: string;
    acceptance_criteria: string[];
    dependencies: string[];
    execution_lane: string | null;
    suggested_route: string | null;
    last_plan_ref?: string | null;
    last_receipt_ref?: string | null;
    last_updated_state_ref?: string | null;
    reconciliation_status?: StoryReconciliationStatus | null;
    planned_at?: string | null;
    last_receipt_at?: string | null;
    last_updated_state_at?: string | null;
    reconciled_at?: string | null;
  };
  export type StoriesArtifact = {
    schemaVersion: "1.0";
    repo: string;
    stories: StoryRecord[];
  };
  export type StoryBacklogSummary = {
    counts_by_status: Record<StoryStatus, number>;
    highest_priority_ready_story: StoryRecord | null;
    blocked_stories: StoryRecord[];
    primary_next_action: string | null;
  };
  export const STORIES_RELATIVE_PATH: ".playbook/stories.json";
  export const STORY_TYPES: readonly string[];
  export const STORY_SEVERITIES: readonly string[];
  export const STORY_PRIORITIES: readonly string[];
  export const STORY_CONFIDENCES: readonly string[];
  export const STORY_STATUSES: readonly StoryStatus[];
  export const createStoryRecord: (...args: any[]) => StoryRecord;
  export const readStoriesArtifact: (...args: any[]) => StoriesArtifact;
  export const sortStoriesForBacklog: (...args: any[]) => StoryRecord[];
  export const summarizeStoriesBacklog: (...args: any[]) => StoryBacklogSummary;
  export type StoryPlanningReference = {
    story_reference: string;
    id: string;
    title: string;
    status: StoryStatus;
    artifact_path: ".playbook/stories.json";
    suggested_route: string | null;
    execution_lane: string | null;
  };
  export type StoryLifecycleEvent =
    | "planned"
    | "receipt_blocked"
    | "receipt_completed";
  export type StoryTransitionPreview = {
    story_id: string;
    previous_status: StoryStatus;
    next_status: StoryStatus;
  };
  export const findStoryById: (...args: any[]) => StoryRecord | null;
  export const buildStableStoryReference: (...args: any[]) => string;
  export const toStoryPlanningReference: (
    ...args: any[]
  ) => StoryPlanningReference;
  export const buildStoryRouteTask: (...args: any[]) => string;
  export const deriveStoryLifecycleStatus: (
    ...args: any[]
  ) => StoryStatus | null;
  export const deriveStoryTransitionPreview: (
    ...args: any[]
  ) => StoryTransitionPreview | null;
  export const transitionStoryFromEvent: (...args: any[]) => StoriesArtifact;
  export const linkStoryToPlan: (...args: any[]) => StoriesArtifact;
  export const reconcileStoryExecution: (...args: any[]) => {
    artifact: StoriesArtifact;
    outcome: "applied" | "noop" | "conflict";
  };
  export const validateStoriesArtifact: (...args: any[]) => string[];
  export const upsertStory: (...args: any[]) => StoriesArtifact;
  export const updateStoryStatus: (...args: any[]) => StoriesArtifact;

  export type StoryPatternContextMatch = {
    pattern_id: string;
    why_matched: string;
    provenance_refs: string[];
    freshness: { status: string; promoted_at: string | null };
    lifecycle: { state: string; warnings: string[]; superseded_by: string[] };
  };
  export type StoryPatternContext = { patterns: StoryPatternContextMatch[] };
  export const buildStoryPatternContext: (
    ...args: any[]
  ) => StoryPatternContext;

  export type StoryCandidateRecord = StoryRecord & {
    candidate_fingerprint: string;
    candidate_id: string;
    grouping_keys: string[];
    source_signals: string[];
    source_artifacts: string[];
    promotion_hint: string;
    explanation: string[];
  };
  export type StoryCandidatesArtifact = {
    schemaVersion: "1.0";
    kind: "story-candidates";
    generatedAt: string;
    repo: string;
    readOnly: true;
    sourceArtifacts: {
      readiness: string[];
      improvementCandidatesPath: string;
      updatedStatePath: string;
      routerRecommendationsPath: string;
    };
    candidates: StoryCandidateRecord[];
  };
  export const STORY_CANDIDATES_RELATIVE_PATH: ".playbook/story-candidates.json";
  export const generateStoryCandidates: (
    ...args: any[]
  ) => StoryCandidatesArtifact;
  export const writeStoryCandidatesArtifact: (...args: any[]) => string;
  export const readStoryCandidatesArtifact: (
    ...args: any[]
  ) => StoryCandidatesArtifact;
  export const promoteStoryCandidate: (...args: any[]) => {
    story: StoryRecord;
    artifact: StoriesArtifact;
    artifactPath: string;
  };

  export type ImprovementCandidatesArtifact = any;
  export type ImprovementActionArtifact = any;
  export type ImprovementGovernanceApprovalArtifact = any;
  export const generateImprovementCandidates: (
    ...args: any[]
  ) => ImprovementCandidatesArtifact;
  export const writeImprovementCandidatesArtifact: (...args: any[]) => string;
  export const applyAutoSafeImprovements: (
    ...args: any[]
  ) => ImprovementActionArtifact;
  export const approveGovernanceImprovement: (
    ...args: any[]
  ) => ImprovementGovernanceApprovalArtifact;

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
  export const writeSystemMapArtifact: (...args: any[]) => {
    artifactPath: string;
    artifact: any;
  };
  export const SYSTEM_MAP_RELATIVE_PATH: ".playbook/system-map.json";

  export const initializeSession: (...args: any[]) => any;
  export const readSession: (...args: any[]) => any;
  export const updateSession: (...args: any[]) => any;
  export const pinSessionArtifact: (...args: any[]) => any;
  export const clearSession: (...args: any[]) => boolean;
  export const resumeSession: (...args: any[]) => any;
  export const attachSessionRunState: (...args: any[]) => any;
}
