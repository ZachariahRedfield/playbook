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

export { generateRepositoryHealth } from './doctor/index.js';
export type { RepositoryHealth, GovernanceStatusItem, ArtifactHygieneReport } from './doctor/index.js';

export { generateRepositoryIndex } from './indexer/repoIndexer.js';
export type { RepositoryIndex, RepositoryModule } from './indexer/repoIndexer.js';

export { queryRepositoryIndex, SUPPORTED_QUERY_FIELDS } from './query/repoQuery.js';
export type { RepositoryQueryField, RepositoryQueryResult } from './query/repoQuery.js';
export { answerRepositoryQuestion } from './ask/askEngine.js';
export type { AskEngineResult } from './ask/askEngine.js';
export { resolveDiffAskContext } from './ask/diffContext.js';
export type { DiffAskContext } from './ask/diffContext.js';
export { analyzePullRequest } from './pr/analyzePr.js';
export type { AnalyzePullRequestResult } from './pr/analyzePr.js';

export { explainTarget } from './explain/explainEngine.js';
export type { ExplainTargetResult, RuleExplanation, ModuleExplanation, ArchitectureExplanation, UnknownExplanation } from './explain/explainEngine.js';

export { loadAiContract, validateAiContract, getDefaultAiContract, AI_CONTRACT_FILE, AI_CONTRACT_SCHEMA_VERSION } from './ai/aiContract.js';
export type { AiContract, LoadedAiContract, AiContractSource } from './ai/aiContract.js';

export { getCliSchemas, getCliSchema, isCliSchemaCommand, CLI_SCHEMA_COMMANDS } from './schema/cliSchemas.js';
export type { CliSchemaCommand, JsonSchema } from './schema/cliSchemas.js';

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

export { runDocsAudit } from './docs/audit.js';
export type { DocsAuditResult, DocsAuditFinding, DocsAuditStatus, DocsAuditLevel } from './docs/audit.js';

export { validateRepoBoundary, validateRemediationPlan, redactSecretsForLogs } from './security/guards.js';
