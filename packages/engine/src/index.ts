export { analyzeRepo } from './analyze/index.js';
export { verifyRepo } from './verify/index.js';
export { formatHuman, formatJson } from './report/format.js';
export { formatAnalyzeHuman, formatAnalyzeCi, formatAnalyzeJson } from './format/analyze.js';
export { loadConfig } from './config/load.js';
export type { VerifyReport } from './report/types.js';
export type { AnalyzeResult, AnalyzeRecommendation, AnalyzeSeverity } from './analyze/index.js';

export { generateArchitectureDiagrams, scanRepoStructure, scanWorkspaceDeps, generateMermaidStructure, generateMermaidDeps } from './diagrams/index.js';
export type { DiagramOptions, StructureModel, DependencyModel, MermaidDiagramResult, DiagramRunOptions, DiagramOutput } from './diagrams/index.js';

export * from './sessions/index.js';

export { runRuleExecution, generateExecutionPlan, generatePlanContract, applyExecutionPlan, parsePlanArtifact, selectPlanTasks, RuleRunner, PlanGenerator, FixExecutor } from './execution/index.js';
export { renderLanePrompt, writeLanePrompts, buildLanePromptFilename } from './execution/lanePrompts.js';
export type { LanePromptSpec, RenderLanePromptInput, WriteLanePromptsInput } from './execution/lanePrompts.js';

export { generateRepositoryHealth } from './doctor/index.js';
export type { RepositoryHealth, GovernanceStatusItem, ArtifactHygieneReport } from './doctor/index.js';

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
export { queryPatternReviewQueue, queryPromotedPatterns } from './query/patternPromotion.js';
export type { RepositoryQueryField, RepositoryQueryResult } from './query/repoQuery.js';
export { answerRepositoryQuestion } from './ask/askEngine.js';
export type { AskEngineResult } from './ask/askEngine.js';
export { resolveDiffAskContext } from './ask/diffContext.js';
export type { DiffAskContext } from './ask/diffContext.js';
export { generateKnowledgeCandidatesDraft } from './learn/draft.js';
export { replayMemoryToCandidates, MEMORY_CANDIDATES_RELATIVE_PATH } from './memory/replay.js';
export { promoteMemoryCandidate, pruneMemoryKnowledge } from './memory/knowledge.js';
export type { MemoryKnowledgeKind, MemoryKnowledgeEntry, MemoryKnowledgeArtifact, MemoryPromotionResult, MemoryPruneResult } from './memory/knowledge.js';
export type { MemoryCandidateKind, MemoryReplayResult, MemoryReplayCandidate, MemoryReplayCandidateProvenance, MemoryReplaySalienceFactors, MemoryReplayIndex, MemoryReplayEventReference } from './schema/memoryReplay.js';
export type { LearnDraftResult, KnowledgeCandidate, KnowledgeCandidateEvidencePointer, KnowledgeCandidateDedupe } from './schema/knowledgeCandidate.js';
export { analyzePullRequest } from './pr/analyzePr.js';
export type { AnalyzePullRequestResult } from './pr/analyzePr.js';
export { formatAnalyzePrOutput, formatAnalyzePrText, formatAnalyzePrJson, formatAnalyzePrGithubComment, formatAnalyzePrGithubReview } from './formatters/analyzePrFormatter.js';
export type { AnalyzePrOutputFormat } from './formatters/analyzePrFormatter.js';

export { resolveRepositoryTarget } from './intelligence/targetResolver.js';
export type { ResolvedTarget, TargetKind } from './intelligence/targetResolver.js';

export { explainTarget } from './explain/explainEngine.js';
export type { ExplainTargetResult, RuleExplanation, ModuleExplanation, ArchitectureExplanation, UnknownExplanation } from './explain/explainEngine.js';

export { loadAiContract, validateAiContract, getDefaultAiContract, AI_CONTRACT_FILE, AI_CONTRACT_SCHEMA_VERSION } from './ai/aiContract.js';
export type { AiContract, LoadedAiContract, AiContractSource } from './ai/aiContract.js';

export { getCliSchemas, getCliSchema, isCliSchemaCommand, CLI_SCHEMA_COMMANDS } from './schema/cliSchemas.js';
export type { CliSchemaCommand, JsonSchema } from './schema/cliSchemas.js';
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

export { captureMemoryEvent, captureMemoryEventSafe, computeMemoryEventFingerprint } from './memory/index.js';
export type { MemoryEvent, MemoryEventInput, MemoryIndex, MemoryEventKind, MemoryOutcome, MemoryRiskSummary } from './memory/types.js';
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
  writePatternReviewQueue,
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
  PromotedPatternsArtifact
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

export { createExecutionRun, createExecutionIntent } from './execution/createExecutionRun.js';
export { initializeSession, readSession, updateSession, pinSessionArtifact, clearSession, resumeSession, attachSessionRunState, sessionArtifactPath, SESSION_ARTIFACT_RELATIVE_PATH } from './session/sessionStore.js';
export { appendExecutionStep, completeExecutionRun, recordExecutionFailure } from './execution/updateExecutionRun.js';
export { writeExecutionRun, readExecutionRun, listExecutionRuns, getLatestMutableRun, executionRunPath } from './execution/writeExecutionRun.js';

export type { ExecutionIntent, ExecutionRun, ExecutionStep, ExecutionEvidence, ExecutionOutcome, ExecutionCheckpoint, ExecutionStepKind, ExecutionStepStatus, ExecutionRequestedBy } from './execution/runContract.js';

export { buildOrchestratorContract, writeOrchestratorArtifact } from './orchestrator/index.js';
export type {
  BuildOrchestratorContractInput,
  LaneContract,
  OrchestratorArtifactWriteResult,
  OrchestratorContract,
  PlannerLaneInput,
  SharedFileHandling,
  SharedFilePolicy
} from './orchestrator/index.js';
