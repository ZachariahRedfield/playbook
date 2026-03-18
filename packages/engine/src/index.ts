export { analyzeRepo } from './analyze/index.js';
export { verifyRepo } from './verify/index.js';
export { formatHuman, formatJson } from './report/format.js';
export { formatAnalyzeHuman, formatAnalyzeCi, formatAnalyzeJson } from './format/analyze.js';
export { loadConfig } from './config/load.js';
export type { VerifyReport } from './report/types.js';
export type { AnalyzeResult, AnalyzeRecommendation, AnalyzeSeverity } from './analyze/index.js';

export { generateArchitectureDiagrams, scanRepoStructure, scanWorkspaceDeps, generateMermaidStructure, generateMermaidDeps } from './diagrams/index.js';
export type { DiagramOptions, StructureModel, DependencyModel, MermaidDiagramResult, DiagramRunOptions, DiagramOutput } from './diagrams/index.js';
export { generateSystemMapArtifact, writeSystemMapArtifact, SYSTEM_MAP_RELATIVE_PATH, SYSTEM_MAP_SCHEMA_VERSION } from './diagrams/systemMap.js';
export type { SystemMapArtifact, SystemMapLayer, SystemMapNode, SystemMapEdge } from './diagrams/systemMap.js';

export * from './sessions/index.js';

export { runRuleExecution, generateExecutionPlan, generatePlanContract, applyExecutionPlan, parsePlanArtifact, selectPlanTasks, RuleRunner, PlanGenerator, FixExecutor } from './execution/index.js';
export { renderLanePrompt, writeLanePrompts, buildLanePromptFilename } from './execution/lanePrompts.js';
export type { LanePromptSpec, RenderLanePromptInput, WriteLanePromptsInput } from './execution/lanePrompts.js';

export { generateRepositoryHealth } from './doctor/index.js';
export type { RepositoryHealth, GovernanceStatusItem, ArtifactHygieneReport } from './doctor/index.js';

export { buildRepoAdoptionReadiness } from './adoption/readiness.js';
export { runBootstrapProof, resolveBootstrapCliAvailability, defaultBootstrapCliResolutionCommands } from './adoption/bootstrapProof.js';
export type { BootstrapProofStage, BootstrapProofFailureCategory, BootstrapProofCheck, BootstrapProofResult, BootstrapCliResolutionCommand } from './adoption/bootstrapProof.js';
export type { RepoAdoptionReadiness, RepoAdoptionBlocker, ReadinessLifecycleStage, ReadinessConnectionStatus, ReadinessArtifactStatus, ReadinessArtifactStatusCode } from './adoption/readiness.js';
export { buildFleetAdoptionReadinessSummary } from './adoption/fleetReadiness.js';
export type { FleetRepoReadinessEntry, FleetPriorityStage, FleetBlockerFrequency, FleetRecommendedAction, FleetRepoPriorityEntry, FleetAdoptionReadinessSummary } from './adoption/fleetReadiness.js';
export { buildFleetAdoptionWorkQueue } from './adoption/workQueue.js';
export type { FleetAdoptionWorkQueue, AdoptionWorkItem, AdoptionWorkWave, AdoptionGroupedActionLane, AdoptionBlockedItem, WorkQueueAction, WorkQueueParallelGroup, WorkQueueSeverity, AdoptionQueueSource, AdoptionNextAction } from './adoption/workQueue.js';
export { buildFleetCodexExecutionPlan } from './adoption/executionPlan.js';
export type { FleetCodexExecutionPlan, CodexExecutionWave, CodexExecutionWorkerLane, CodexExecutionPrompt, CodexExecutionBlockedFollowup } from './adoption/executionPlan.js';
export { buildFleetExecutionReceipt } from './adoption/executionReceipt.js';
export type { FleetExecutionOutcomeInput, ExecutionPromptOutcomeInput, FleetExecutionReceipt, ExecutionPromptResult, ExecutionWaveResult, ExecutionRepoResult, ExecutionArtifactEvidence, ExecutionBlocker, ExecutionVerificationSummary, ExecutionObservedStatus, ExecutionComparisonStatus, LifecycleTransition } from './adoption/executionReceipt.js';
export { buildFleetUpdatedAdoptionState } from './adoption/executionUpdatedState.js';
export type { FleetUpdatedAdoptionState, ReconciledRepoState, ReconciliationStatus } from './adoption/executionUpdatedState.js';
export { deriveNextAdoptionQueueFromUpdatedState } from './adoption/updatedStateQueue.js';

export { generateRepositoryIndex } from './indexer/repoIndexer.js';
export type { RepositoryIndex, RepositoryModule, RepositoryDependencyEdge, RepositoryWorkspaceNode, RepositoryTestCoverage, RepositoryConfigEntry } from './indexer/repoIndexer.js';
export {
  parsePlaybookIgnore,
  parsePlaybookIgnoreContent,
  getDefaultPlaybookIgnoreSuggestions,
  isPlaybookIgnored,
  readIgnoreRecommendationArtifact,
  suggestPlaybookIgnore,
  applySafePlaybookIgnoreRecommendations,
  PLAYBOOK_IGNORE_MANAGED_START,
  PLAYBOOK_IGNORE_MANAGED_END
} from './indexer/playbookIgnore.js';
export type {
  PlaybookIgnoreRule,
  RecommendationSafetyLevel,
  RecommendationImpactLevel,
  IgnoreRecommendation,
  IgnoreRecommendationArtifact,
  PlaybookIgnoreSuggestion,
  PlaybookIgnoreSuggestResult,
  PlaybookIgnoreApplyResult
} from './indexer/playbookIgnore.js';
export { generateRepositoryGraph, readRepositoryGraph, summarizeRepositoryGraph, summarizeGraphNeighborhood, REPOSITORY_GRAPH_RELATIVE_PATH, REPOSITORY_GRAPH_SCHEMA_VERSION } from './graph/repoGraph.js';
export { buildModuleContextDigests, writeModuleContextDigests, readModuleContextDigest, MODULE_CONTEXT_DIR_RELATIVE_PATH } from './context/moduleContext.js';
export type { ModuleContextDigest } from './context/moduleContext.js';
export type { RepositoryGraph, RepositoryGraphNode, RepositoryGraphEdge, RepositoryGraphSummary, GraphNeighborhoodSummary } from './graph/repoGraph.js';

export { queryRepositoryIndex, SUPPORTED_QUERY_FIELDS } from './query/repoQuery.js';
export { queryPatterns } from './query/patterns.js';
export {
  listPatternKnowledgePatterns,
  getPatternKnowledgePatternById,
  listPatternKnowledgeRelatedPatterns,
  listPatternKnowledgeInstances,
  listPatternKnowledgeEvidence,
  readPatternKnowledgeGraphArtifact,
  PATTERN_KNOWLEDGE_GRAPH_RELATIVE_PATH
} from './query/patternKnowledgeGraph.js';
export { queryPatternReviewQueue, queryPromotedPatterns } from './query/patternPromotion.js';
export type { RepositoryQueryField, RepositoryQueryResult } from './query/repoQuery.js';
export type {
  PatternKnowledgeLayer,
  PatternKnowledgePattern,
  PatternKnowledgeRelation,
  PatternKnowledgeInstance,
  PatternKnowledgeGraphArtifact
} from './schema/patternKnowledgeGraph.js';
export { answerRepositoryQuestion } from './ask/askEngine.js';
export type { AskEngineResult } from './ask/askEngine.js';
export { resolveDiffAskContext } from './ask/diffContext.js';
export type { DiffAskContext } from './ask/diffContext.js';
export { generateKnowledgeCandidatesDraft } from './learn/draft.js';
export { extractDoctrineFromSummary, readDoctrineExtractionInput } from './learn/doctrine.js';
export type { DoctrineExtractionInput, DoctrineExtractionResult, DoctrineExtractionEntry, DoctrineExtractionSuggestion, DoctrineCheckCandidate } from './learn/doctrine.js';
export { LEARNING_COMPACTION_SCHEMA_VERSION, LEARNING_COMPACTION_RELATIVE_PATH, generateLearningCompactionArtifact, writeLearningCompactionArtifact } from './learning/learningCompaction.js';
export type { LearningCompactionArtifact } from './learning/learningCompaction.js';
export {
  PATTERN_PORTABILITY_SCHEMA_VERSION,
  PATTERN_PORTABILITY_RELATIVE_PATH,
  generatePatternPortabilityRun,
  scorePatternPortability,
  writePatternPortabilityArtifact
} from './learning/patternPortability.js';
export type { PatternPortabilityArtifact, PatternPortabilityRun } from './learning/patternPortability.js';

export {
  TRANSFER_READINESS_SCHEMA_VERSION,
  TRANSFER_READINESS_RELATIVE_PATH,
  generateTransferReadinessArtifact,
  writeTransferReadinessArtifact
} from './learning/transferReadiness.js';
export type { TransferReadinessArtifact, TransferReadinessEntry } from '@zachariahredfield/playbook-core';

export {
  PORTABILITY_CONFIDENCE_SCHEMA_VERSION,
  PORTABILITY_CONFIDENCE_RELATIVE_PATH,
  generatePortabilityConfidenceArtifact,
  writePortabilityConfidenceArtifact
} from './learning/portabilityConfidence.js';
export type { PortabilityConfidenceArtifact } from './learning/portabilityConfidence.js';


export {
  TRANSFER_PLANS_SCHEMA_VERSION,
  TRANSFER_PLANS_RELATIVE_PATH,
  generateTransferPlansArtifact,
  writeTransferPlansArtifact
} from './learning/transferPlanning.js';
export type { TransferPlanArtifact, TransferPlanRecord } from '@zachariahredfield/playbook-core';

export {
  PORTABILITY_OUTCOMES_SCHEMA_VERSION,
  PORTABILITY_OUTCOMES_RELATIVE_PATH,
  normalizePortabilityOutcomesArtifact,
  readPortabilityOutcomesArtifact,
  appendPortabilityOutcomes,
  summarizePortabilityOutcomes
} from './learning/portabilityOutcomes.js';
export type { PortabilityOutcomesArtifact, PortabilityOutcomeLookup } from './learning/portabilityOutcomes.js';
export {
  OBSERVER_REPO_REGISTRY_RELATIVE_PATH,
  OBSERVER_SNAPSHOT_RELATIVE_PATH,
  readObserverRepoRegistry,
  buildObserverSnapshot,
  buildObserverSnapshotFromRegistry,
  writeObserverSnapshotArtifact,
  readObserverSnapshotArtifact
} from './observer/snapshot.js';
export type {
  ObserverArtifactKey,
  ObserverRepoRegistryEntry,
  ObserverRepoRegistry,
  ObserverRepoWarning,
  ObserverRepoSnapshot,
  ObserverSnapshot
} from './observer/snapshot.js';
export { replayMemoryToCandidates, MEMORY_CANDIDATES_RELATIVE_PATH } from './memory/replay.js';
export { listCandidateKnowledge, loadCandidateKnowledgeById, promoteMemoryCandidate, retirePromotedKnowledge, supersedePromotedKnowledge, pruneMemoryKnowledge } from './memory/knowledge.js';
export type { MemoryKnowledgeKind, MemoryKnowledgeEntry, MemoryKnowledgeArtifact, MemoryPromotionResult, MemoryRetireResult, MemorySupersedeResult, MemoryPruneResult } from './memory/knowledge.js';
export type { MemoryCandidateKind, MemoryReplayResult, MemoryReplayCandidate, MemoryReplayCandidateProvenance, MemoryReplaySalienceFactors, MemoryReplayIndex, MemoryReplayEventReference } from './schema/memoryReplay.js';
export type { LearnDraftResult, KnowledgeCandidate, KnowledgeCandidateEvidencePointer, KnowledgeCandidateDedupe } from './schema/knowledgeCandidate.js';
export { analyzePullRequest } from './pr/analyzePr.js';
export type { AnalyzePullRequestResult } from './pr/analyzePr.js';
export { formatAnalyzePrOutput, formatAnalyzePrText, formatAnalyzePrJson, formatAnalyzePrGithubComment, formatAnalyzePrGithubReview } from './formatters/analyzePrFormatter.js';
export type { AnalyzePrOutputFormat } from './formatters/analyzePrFormatter.js';

export { resolveRepositoryTarget } from './intelligence/targetResolver.js';
export type { ResolvedTarget, TargetKind } from './intelligence/targetResolver.js';

export { explainArtifactFromArchitecture, explainSubsystemFromArchitecture } from './architecture/introspection.js';
export { explainTarget } from './explain/explainEngine.js';
export type { ExplainTargetResult, RuleExplanation, ModuleExplanation, ArchitectureExplanation, SubsystemExplanation, ArtifactExplanation, UnknownExplanation } from './explain/explainEngine.js';

export { loadAiContract, validateAiContract, getDefaultAiContract, AI_CONTRACT_FILE, AI_CONTRACT_SCHEMA_VERSION } from './ai/aiContract.js';

export { parseOrchestratorContract, buildOrchestratorPlan, writeOrchestratorArtifacts } from './orchestrator.js';
export type { OrchestratorContract, OrchestratorLane, OrchestratorPlan, RepoShape } from './orchestrator.js';
export type { AiContract, LoadedAiContract, AiContractSource } from './ai/aiContract.js';

export { getCliSchemas, getCliSchema, isCliSchemaCommand, CLI_SCHEMA_COMMANDS } from './schema/cliSchemas.js';
export type { CliSchemaCommand, JsonSchema } from './schema/cliSchemas.js';
export type { WorkflowPromotion, WorkflowPromotionStatus, WorkflowPromotionValidationStatus } from './schema/workflowPromotion.js';

export { buildExecutionOutcomeInputFromResults, ingestExecutionResults } from './adoption/executionOutcomeIngestion.js';
export type { ExecutionResult, IngestExecutionResultsOutput } from './adoption/executionOutcomeIngestion.js';
export { VERTEX_KIND, EDGE_KIND } from './schema/graphMemory.js';
export { buildGraphSnapshot } from './graph/buildGraphSnapshot.js';
export { groupDeterministicMemory } from './graph/groupDeterministicMemory.js';
export type { GroupDeterministicMemoryInput } from './graph/groupDeterministicMemory.js';
export type { BuildGraphSnapshotInput } from './graph/buildGraphSnapshot.js';
export { materializeDeterministicEdges, countOrphanVertices } from './graph/deterministicEdges.js';
export { checkVertexCompatibility, GROUP_BOUNDARY_FLAGS } from './graph/compatibilityGuards.js';
export type { EdgeSeed } from './graph/deterministicEdges.js';
export type { VertexKind, EdgeKind, GraphVertexStatus, GraphVertex, GraphEdge, RelationVertex, GraphSnapshotMetrics, GraphSnapshot, GroupingReason, GroupCompatibilityStatus, GroupBoundaryFlag, GraphGroup, GraphGroupingMetrics, GraphGroupArtifact, CandidatePatternPreview, CandidatePatternPreviewArtifact } from './schema/graphMemory.js';
export type { PatternCardDraftStatus, PatternCardDraftRecurrence, PatternCardDraft, PatternCardDraftArtifact } from './schema/patternCardDraft.js';
export type { PromotionReadinessBucket, PromotionReadiness, PromotionReviewQueueItem, PromotionReviewQueue } from './schema/promotion.js';
export type { PromotionDecisionType, PromotionDecision, PromotionDecisionArtifact, PromotionState, PromotionStateTransition, DecisionBatch, PatternCardVersionRef } from './schema/promotionDecision.js';
export type { PatternCardDecisionType, PatternCardVersionEntry, PatternCardLineage, PatternTopologyDescriptor, PatternCard as PromotionPatternCard, PatternCardCollectionArtifact } from './schema/patternCard.js';

export { queryDependencies } from './query/dependencies.js';
export type { DependenciesQueryResult } from './query/dependencies.js';
export { queryImpact } from './query/impact.js';
export type { ImpactQueryResult } from './query/impact.js';
export { knowledgeInspect, knowledgeList, knowledgeProvenance, knowledgeQuery, knowledgeStale, knowledgeTimeline } from './query/knowledge.js';
export type {
  KnowledgeInspectResult,
  KnowledgeListResult,
  KnowledgeProvenanceQueryResult,
  KnowledgeQueryResult,
  KnowledgeRecord,
  KnowledgeQueryOptions,
  KnowledgeStaleResult,
  KnowledgeSummary,
  KnowledgeTimelineOptions,
  KnowledgeTimelineResult
} from './query/knowledge.js';

export { resolveIndexedModuleContext, buildModuleAskContext } from './query/moduleIntelligence.js';
export type { IndexedModuleContext, IndexedModuleIdentity, ModuleImpact } from './query/moduleIntelligence.js';

export { queryRisk } from './query/risk.js';
export type { RiskQueryResult, RiskLevel, RiskSignals, RiskContributions } from './query/risk.js';

export { queryDocsCoverage } from './query/docsCoverage.js';
export type { DocsCoverageQueryResult, DocsCoverageModuleResult, DocsCoverageSummary } from './query/docsCoverage.js';

export { queryRuleOwners } from './query/ruleOwners.js';
export type { RuleOwnersQueryResult, RuleOwnershipEntry } from './query/ruleOwners.js';

export { queryModuleOwners } from './query/moduleOwners.js';
export type { ModuleOwnersQueryResult, ModuleOwnershipEntry } from './query/moduleOwners.js';

export { queryTestHotspots, TEST_HOTSPOT_TYPES } from './query/testHotspots.js';
export type {
  TestHotspot,
  TestHotspotType,
  TestHotspotConfidence,
  TestHotspotAutomationSafety,
  TestHotspotsQueryResult
} from './query/testHotspots.js';

export { runDocsAudit } from './docs/audit.js';
export {
  IMPROVEMENT_CANDIDATES_SCHEMA_VERSION,
  IMPROVEMENT_CANDIDATES_RELATIVE_PATH,
  ROUTER_RECOMMENDATIONS_RELATIVE_PATH,
  KNOWLEDGE_CANDIDATES_RELATIVE_PATH,
  KNOWLEDGE_PROMOTIONS_RELATIVE_PATH,
  COMMAND_IMPROVEMENTS_RELATIVE_PATH,
  generateImprovementCandidates,
  writeImprovementCandidatesArtifact,
  writeRouterRecommendationsArtifact,
  applyAutoSafeImprovements,
  approveGovernanceImprovement
} from './improvement/candidateEngine.js';
export {
  COMMAND_IMPROVEMENTS_SCHEMA_VERSION,
  generateCommandImprovementProposals,
  writeCommandImprovementArtifact
} from './improvement/commandProposals.js';
export { generateDoctrinePromotionArtifacts, writeDoctrinePromotionArtifacts } from './improvement/doctrinePromotion.js';
export type {
  ImprovementCandidateCategory,
  ImprovementTier,
  ImprovementGatingTier,
  ImprovementCandidate,
  RejectedImprovementCandidate,
  RouterRecommendationGatingTier,
  RouterRecommendation,
  RejectedRouterRecommendation,
  RouterRecommendationsArtifact,
  ImprovementCandidatesArtifact,
  ImprovementActionArtifact,
  ImprovementGovernanceApprovalArtifact
} from './improvement/candidateEngine.js';
export type {
  CommandImprovementIssueType,
  CommandImprovementProposal,
  RejectedCommandImprovementProposal,
  CommandImprovementsArtifact
} from './improvement/commandProposals.js';
export type {
  DoctrineLifecycleStage,
  DoctrineGatingTier,
  DoctrinePromotionCandidate,
  DoctrinePromotionDecision,
  DoctrinePromotionCandidatesArtifact,
  DoctrinePromotionsArtifact
} from './improvement/doctrinePromotion.js';


export {
  POLICY_EVALUATION_SCHEMA_VERSION,
  POLICY_EVALUATION_RELATIVE_PATH,
  evaluateImprovementPolicy
} from './policy/proposalEvaluator.js';
export type {
  PolicyEvaluateDecision,
  PolicyEvaluationEntry,
  PolicyEvaluationArtifact
} from './policy/proposalEvaluator.js';


export { POLICY_PREFLIGHT_SCHEMA_VERSION, buildPolicyPreflight } from './policy/preflight.js';
export type { PolicyPreflightArtifact, PolicyPreflightProposal } from './policy/preflight.js';

export {
  captureMemoryEvent,
  captureMemoryEventSafe,
  computeMemoryEventFingerprint,
  recordRouteDecision,
  recordLaneTransition,
  recordWorkerAssignment,
  recordLaneOutcome,
  recordExecutionOutcome,
  recordImprovementCandidate,
  recordImprovementSignal,
  recordCommandExecution,
  recordCommandQuality,
  queryRepositoryEvents,
  listRecentRouteDecisions,
  listLaneTransitionsForRun,
  listWorkerAssignmentsForRun,
  listImprovementSignalsForArtifact,
  readRepositoryEvents,
  safeRecordRepositoryEvent,
  REPOSITORY_EVENTS_SCHEMA_VERSION
} from './memory/index.js';
export type { MemoryEvent, MemoryEventInput, MemoryIndex, MemoryEventKind, MemoryOutcome, MemoryRiskSummary } from './memory/types.js';
export type {
  RepositoryEvent,
  RepositoryEventIndex,
  RepositoryEventType,
  RepositoryEventBase,
  RepositoryEventRelatedArtifact,
  RepositoryEventLookupOptions,
  RepositoryEventQueryOptions,
  RouteDecisionEvent,
  LaneTransitionEvent,
  WorkerAssignmentEvent,
  ExecutionOutcomeEvent,
  ImprovementSignalEvent,
  CommandQualityEvent
} from './memory/events.js';
export { lookupMemoryEventTimeline, lookupMemoryCandidateKnowledge, lookupPromotedMemoryKnowledge, expandMemoryProvenance } from './memory/inspection.js';
export type { MemoryTimelineLookupOptions, MemoryCandidateLookupOptions, MemoryKnowledgeLookupOptions, ExpandedMemoryProvenance } from './memory/inspection.js';
export type { DocsAuditResult, DocsAuditFinding, DocsAuditStatus, DocsAuditLevel } from './docs/audit.js';

export { buildContractRegistry } from './contracts/contractRegistry.js';
export type { ContractRegistryPayload } from './contracts/contractRegistry.js';


export { buildContractProposal } from './contracts/buildContractProposal.js';
export type { BuildContractProposalInput } from './contracts/buildContractProposal.js';
export { applyContractProposal, replayAcceptedContractProposals } from './contracts/applyContractProposal.js';
export type { ApplyContractProposalInput, ApplyContractProposalResult, VerifyProposedContract } from './contracts/applyContractProposal.js';
export { buildProposalArtifactPath, buildContractVersionArtifactPath, createContractVersionRef, writeProposalArtifact, writeContractVersion } from './contracts/versioning.js';
export type { VersionedContract, ContractRule } from './contracts/versioning.js';
export type {
  ContractMutationType,
  ContractProposal,
  ContractMutation,
  ContractVersionRef,
  ContractProposalDecisionStatus,
  ContractProposalVerificationStatus
} from './schema/contractProposal.js';


export { FUNCTOR_REGISTRY, getFunctorById } from './functors/registry.js';
export { applyFunctor } from './functors/applyFunctor.js';
export type { ApplyFunctorInput } from './functors/applyFunctor.js';
export type {
  FunctorTargetDomain,
  StructuralInvariantProjection,
  FunctorMapping,
  KnowledgeFunctor,
  FunctorLineage,
  FunctorApplication,
  FunctorApplicationArtifact
} from './schema/functor.js';

export { validateRepoBoundary, validateRemediationPlan, redactSecretsForLogs } from './security/guards.js';
export {
  SECURITY_BASELINE_RELATIVE_PATH,
  SECURITY_BASELINE_STATUSES,
  readSecurityBaselineArtifact,
  sortSecurityBaselineFindings,
  summarizeSecurityBaseline,
  showSecurityBaselineForPackage
} from './security/securityBaseline.js';
export type { SecurityBaselineArtifact, SecurityBaselineFinding, SecurityBaselineStatus, SecurityBaselineSummary } from './security/securityBaseline.js';
export {
  extractPatternCandidates,
  buildPatternCandidateArtifact,
  writePatternCandidateArtifact,
  generatePatternCandidateArtifact,
  PATTERN_CANDIDATES_RELATIVE_PATH
} from './extract/patternCandidates.js';
export { linkPatternCandidatesToGraph } from './extract/candidateLinking.js';
export {
  layeringDetector,
  modularityDetector,
  workflowRecursionDetector,
  contractSymmetryDetector,
  queryBeforeMutationDetector,
  DEFAULT_PATTERN_CANDIDATE_DETECTORS
} from './extract/detectors/index.js';
export type { PatternCandidateArtifact, ExtractPatternCandidatesInput } from './extract/patternCandidates.js';
export type { PatternCandidate, Detector, ExtractionArtifacts, PatternEvidence } from './extract/detectors/index.js';
export type {
  CandidateLinkProposalOperation,
  CandidateLinkScore,
  CandidateLinkMatch,
  CandidateLinkReportEntry,
  CandidateLinkReport
} from './extract/candidateLinking.js';

export {
  compactPatterns,
  readCompactedPatterns,
  generateCompactionCandidateArtifact,
  extractCompactionCandidates,
  canonicalizeCandidate,
  createCandidateFingerprint,
  compactionCandidateArtifactSchema,
  bucketCompactionCandidates,
  assessRelation,
  assessImportance,
  decideBucket,
  compactionBucketArtifactSchema,
  createPatternCardId,
  buildPatternCardsFromBuckets,
  readPatternCards,
  writePatternCards,
  toExistingPatternTargets,
  buildCandidatePatterns,
  synthesizePatternCardDrafts,
  buildPatternReviewQueue,
  buildDoctrineCandidatesArtifact,
  writePatternReviewQueue,
  writeDoctrineCandidatesArtifact,
  readPatternReviewQueue,
  readPromotedPatterns,
  promotePatternCandidate,
  scorePatternCandidate
} from './compaction/index.js';
export type {
  CompactionCandidate,
  CompactionCandidateArtifact,
  CandidateSourceKind,
  CandidateSubjectKind,
  BucketDecision,
  BucketTarget,
  BucketedCandidateEntry,
  CompactionBucketArtifact,
  CompactionBucketKind,
  ImportanceAssessment,
  ImportanceLevel,
  RecurrenceSignal,
  RelationAssessment,
  RelationKind,
  PatternCard,
  PatternCardReviewDraftArtifact,
  PatternCardReviewDraftEntry,
  SynthesizePatternCardDraftsInput,
  PatternCandidateScore,
  PatternReviewQueueArtifact,
  PromotedPatternsArtifact,
  DoctrineCandidate,
  DoctrineCandidatesArtifact
} from './compaction/index.js';

export { scorePromotionReadiness } from './promotion/scorePromotionReadiness.js';
export { buildPromotionReviewQueue } from './promotion/buildPromotionReviewQueue.js';
export type { BuildPromotionReviewQueueInput } from './promotion/buildPromotionReviewQueue.js';
export { applyPromotionDecision, buildPromotionDecisionArtifact, buildPatternCardCollectionArtifact } from './promotion/applyPromotionDecision.js';
export { validateTransition } from './promotion/validateTransition.js';
export { replayDecisionJournal } from './promotion/replayDecisionJournal.js';
export { createStablePatternId, createPatternCard } from './patternCards/createPatternCard.js';
export { materializePatternCardVersion } from './patternCards/materializePatternCardVersion.js';
export { appendPatternVersion, markPatternSuperseded } from './patternCards/versioning.js';


export { buildPatternTopologySignature, buildPatternTopologySignatures } from './topology/buildPatternTopology.js';
export { detectPatternEquivalenceClasses, buildPatternEquivalenceArtifact, writePatternEquivalenceArtifact } from './topology/detectEquivalence.js';

export {
  calculateRecurrenceScore,
  calculateCrossDomainScore,
  calculateEvidenceScore,
  calculateRepositoryImpactScore,
  calculateGovernanceAlignmentScore,
  computeAttractorScore,
  appendAttractorScore,
  evaluatePromotionState,
  scorePatternGraph,
  listTopPatterns
} from './scoring/patternAttractorScore.js';
export {
  computePatternFitness,
  appendFitnessStrengthScore,
  computePatternStrength,
  rankPatternStrength
} from './scoring/patternFitnessScore.js';
export type {
  PromotionState as PatternGraphPromotionState,
  AttractorScore as PatternGraphAttractorScore,
  PatternGraphPattern,
  PatternGraphEvidence,
  PatternGraphRelation,
  PatternGraphArtifact,
  PatternAttractorScoreSignals,
  PatternAttractorScoreResult
} from './scoring/patternAttractorScore.js';
export type { PatternFitnessSignals, PatternFitnessScoreResult, PatternOutcomeLinks, RankedPatternStrength } from './scoring/patternFitnessScore.js';

export {
  computeCrossRepoPatternLearning,
  writeCrossRepoPatternsArtifact,
  readCrossRepoPatternsArtifact
} from './scoring/crossRepoPatternLearning.js';
export type {
  CrossRepoInput,
  CrossRepoPatternRepositorySummary,
  CrossRepoPatternAggregate,
  CrossRepoPatternsArtifact
} from './scoring/crossRepoPatternLearning.js';
export {
  computeCrossRepoCandidateAggregation,
  writeCrossRepoCandidatesArtifact,
  readCrossRepoCandidatesArtifact
} from './learning/crossRepoCandidateAggregation.js';
export type {
  CrossRepoCandidateInput,
  CrossRepoCandidateFamilyAggregate,
  CrossRepoCandidatesArtifact
} from './learning/crossRepoCandidateAggregation.js';
export {
  buildPatternFamilyDiscoveryArtifact,
  writePatternFamilyDiscoveryArtifact,
  readPatternFamilyDiscoveryArtifact,
  PATTERN_FAMILY_DISCOVERY_RELATIVE_PATH
} from './learning/patternFamilyNormalization.js';
export type {
  PatternFamilyDiscoveryInput,
  PatternFamilyDiscoveryFamily,
  PatternFamilyAssignment,
  PatternFamilyDiscoveryArtifact
} from './learning/patternFamilyNormalization.js';

export {
  buildPatternProposalArtifact,
  generatePatternProposalArtifact,
  writePatternProposalArtifact,
  readPatternProposalArtifact,
  PATTERN_PROPOSALS_RELATIVE_PATH
} from './learning/patternProposalBridge.js';
export type { PatternProposal, PatternProposalArtifact } from './learning/patternProposalBridge.js';
export type { PatternTopologySignature, PatternEquivalenceClass, PatternVariant, PatternTopologyTelemetry, PatternEquivalenceArtifact } from './schema/patternTopology.js';

export { buildStateSpaceSnapshot } from './stateSpace/buildStateSpaceSnapshot.js';
export type { BuildStateSpaceSnapshotInput } from './stateSpace/buildStateSpaceSnapshot.js';
export type {
  StateSpaceSnapshot,
  BlochAxesV1,
  BlochVector,
  GateEvent,
  BlochProjectionMetadata,
  BlochTelemetry
} from './schema/stateSpaceSnapshot.js';


export { analyzePlaybookArtifacts } from './meta/analyzePlaybookArtifacts.js';
export { buildMetaFindings } from './meta/buildMetaFindings.js';
export type { MetaAnalysisInput } from './meta/buildMetaFindings.js';
export { buildMetaTelemetry } from './meta/buildMetaTelemetry.js';
export { buildMetaProposals } from './meta/buildMetaProposals.js';
export type { AnalyzePlaybookArtifactsInput, AnalyzePlaybookArtifactsResult } from './meta/analyzePlaybookArtifacts.js';
export type { MetaFindingType, MetaFinding, MetaFindingsArtifact } from './schema/metaFinding.js';
export type { MetaProposal, MetaProposalsArtifact } from './schema/metaProposal.js';
export type { MetaTelemetryArtifact } from './schema/metaTelemetry.js';
export type { Evidence, Zettel, Edge, Pattern, Decision } from './schema/evidence.js';

export { writeJsonArtifact as writeArtifactJson, readJsonArtifact as readArtifactJson, INVALID_ARTIFACT_ERROR } from './artifacts/artifactIO.js';

export { routeTask } from './routing/routeTask.js';
export type { RouteDecision, RouteTaskInput, RouteTaskKind, RouteMutabilityLevel, RouteSafetyConstraints, TaskRoute } from './routing/types.js';
export { buildTaskExecutionProfile } from './routing/executionRouter.js';
export { buildExecutionPlan } from './routing/executionPlan.js';
export type { BuildExecutionPlanInput, ExecutionPlanArtifact, ExecutionPlanSourceArtifacts } from './routing/executionPlan.js';
export { compileCodexPrompt } from './routing/codexPrompt.js';
export { buildWorksetPlan, deriveLaneState, applyLaneLifecycleTransition, assignWorkersToLanes, buildAssignedPrompt } from './orchestration/index.js';
export type {
  WorksetPlanArtifact,
  WorksetTaskInput,
  WorksetLane,
  LaneStateArtifact,
  LaneStateEntry,
  LaneExecutionStatus,
  LaneLifecycleTransition,
  LaneLifecycleTransitionResult,
  WorkerAssignmentsArtifact,
  WorkerAssignmentEntry,
  WorkerAssignmentWorker,
  WorkerAssignmentLaneStatus
} from './orchestration/index.js';
export type {
  ExecutionSurface,
  ExecutionScope,
  ExecutionTaskFamily,
  TaskExecutionProfileArtifact,
  TaskExecutionProfileInput,
  TaskExecutionProfileProposal
} from './routing/executionRouter.js';

export {
  appendRuntimeLogRecord,
  createRuntimeRun,
  createRuntimeTask,
  listRuntimeLogRecords,
  listRuntimeRuns,
  listRuntimeTasks,
  readRuntimeControlPlaneStatus,
  readRuntimeRun,
  readRuntimeTask,
  runAgentPlanDryRun,
  runtimeLifecyclePaths,
  transitionRuntimeRunState,
  transitionRuntimeTaskState,
  type RuntimeControlPlaneStatus
} from './runtime/index.js';

export type { AgentRunPlanDryRunInput, AgentRunPlanDryRunResult } from './runtime/index.js';

export { createExecutionRun, createExecutionIntent } from './execution/createExecutionRun.js';
export { startExecution, updateLaneState, recordWorkerResult, finalizeExecution } from './execution/supervisor.js';
export type { WorkerResult } from './execution/supervisor.js';
export { initializeSession, readSession, updateSession, pinSessionArtifact, clearSession, resumeSession, attachSessionRunState, sessionArtifactPath, SESSION_ARTIFACT_RELATIVE_PATH } from './session/sessionStore.js';
export { appendExecutionStep, completeExecutionRun, recordExecutionFailure } from './execution/updateExecutionRun.js';
export { writeExecutionRun, readExecutionRun, listExecutionRuns, getLatestMutableRun, executionRunPath } from './execution/writeExecutionRun.js';

export type { ExecutionIntent, ExecutionRun, ExecutionStep, ExecutionEvidence, ExecutionOutcome, ExecutionCheckpoint, ExecutionStepKind, ExecutionStepStatus, ExecutionRequestedBy } from './execution/runContract.js';

export { buildOrchestratorContract, writeOrchestratorArtifact, compileOrchestratorArtifacts } from './orchestrator/index.js';
export type {
  BuildOrchestratorContractInput,
  CompileOrchestratorArtifactsInput,
  CompileOrchestratorArtifactsResult,
  OrchestratorArtifactWriteResult,
  OrchestratorContract as OrchestratorLaneContractArtifact,
  OrchestratorLaneContract
} from './orchestrator/index.js';

export * from './telemetry/index.js';

export { validateArtifacts } from "./architecture/validateArtifacts.js";
export type { ArchitectureValidationResult, ValidateArtifactsOptions } from "./architecture/validateArtifacts.js";

export { appendCommandExecutionQualityRecord, readCommandExecutionQualityArtifact, summarizeCommandExecutionQuality, summarizeCommandQualityByCommand, buildCommandQualitySummaryArtifact, COMMAND_QUALITY_SUMMARY_COMMANDS } from './telemetry/commandQuality.js';
