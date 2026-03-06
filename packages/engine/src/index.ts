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
export type { RepositoryHealth, GovernanceStatusItem } from './doctor/index.js';

export { generateRepositoryIndex } from './indexer/repoIndexer.js';
export type { RepositoryIndex } from './indexer/repoIndexer.js';

export { queryRepositoryIndex, SUPPORTED_QUERY_FIELDS } from './query/repoQuery.js';
export type { RepositoryQueryField, RepositoryQueryResult } from './query/repoQuery.js';
export { answerRepositoryQuestion } from './ask/askEngine.js';
export type { AskEngineResult } from './ask/askEngine.js';

export { explainTarget } from './explain/explainEngine.js';
export type { ExplainTargetResult, RuleExplanation, ModuleExplanation, ArchitectureExplanation, UnknownExplanation } from './explain/explainEngine.js';

export { getCliSchemas, getCliSchema, isCliSchemaCommand, CLI_SCHEMA_COMMANDS } from './schema/cliSchemas.js';
export type { CliSchemaCommand, JsonSchema } from './schema/cliSchemas.js';
