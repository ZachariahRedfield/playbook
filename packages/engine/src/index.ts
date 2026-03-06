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

export { runRuleExecution, generateExecutionPlan, generatePlanContract, applyExecutionPlan, RuleRunner, PlanGenerator, FixExecutor } from './execution/index.js';
