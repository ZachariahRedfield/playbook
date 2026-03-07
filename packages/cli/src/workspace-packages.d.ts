declare module "@zachariahredfield/playbook-core" {
  export const analyze: (...args: any[]) => Promise<any>;
  export const formatAnalyzeCi: (...args: any[]) => Promise<any>;
  export const formatAnalyzeHuman: (...args: any[]) => Promise<any>;
  export const formatAnalyzeJson: (...args: any[]) => Promise<any>;
  export const verify: (...args: any[]) => Promise<any>;
  export const formatHuman: (...args: any[]) => Promise<any>;
  export const formatJson: (...args: any[]) => Promise<any>;
}

declare module "@zachariahredfield/playbook-node" {
  export const createNodeContext: (...args: any[]) => Promise<any>;
}

declare module "@zachariahredfield/playbook-engine" {
  export const loadConfig: (...args: any[]) => Promise<any>;
  export const generateRepositoryHealth: (...args: any[]) => any;
  export type ArtifactHygieneReport = any;
  export const analyzePullRequest: (...args: any[]) => any;
  export const generateRepositoryIndex: (...args: any[]) => any;
  export const loadAiContract: (...args: any[]) => any;

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
  export type ModuleOwnershipEntry = { name: string; owners: string[]; area: string };
  export type ModuleOwnersQueryResult =
    | { schemaVersion: '1.0'; command: 'query'; type: 'module-owners'; modules: ModuleOwnershipEntry[] }
    | { schemaVersion: '1.0'; command: 'query'; type: 'module-owners'; module: ModuleOwnershipEntry };

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
  export type RepositoryModule = any;
  export const answerRepositoryQuestion: (...args: any[]) => any;
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
  export const getCliSchemas: (...args: any[]) => any;
  export const getCliSchema: (...args: any[]) => any;
  export const isCliSchemaCommand: (...args: any[]) => boolean;
  export const CLI_SCHEMA_COMMANDS: readonly string[];
  export const cleanupSessionSnapshots: (...args: any[]) => any;
  export const formatMergeReportMarkdown: (...args: any[]) => string;
  export const importChatTextSnapshot: (...args: any[]) => any;
  export const mergeSessionSnapshots: (...args: any[]) => any;
  export const validateSessionSnapshot: (...args: any[]) => any;
}
