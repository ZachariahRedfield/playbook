declare module "@zachariahredfield/playbook-core" {
  export const analyze: (...args: any[]) => Promise<any>;
  export const formatAnalyzeCi: (...args: any[]) => Promise<any>;
  export const formatAnalyzeHuman: (...args: any[]) => Promise<any>;
  export const formatAnalyzeJson: (...args: any[]) => Promise<any>;
  export const verify: (...args: any[]) => Promise<any>;
  export const formatHuman: (...args: any[]) => Promise<any>;
  export const formatJson: (...args: any[]) => Promise<any>;
  export const runArchitectureAudit: (...args: any[]) => any;
}

declare module "@zachariahredfield/playbook-node" {
  export const createNodeContext: (...args: any[]) => Promise<any>;
}

declare module "@zachariahredfield/playbook-engine" {
  export const loadConfig: (...args: any[]) => Promise<any>;
  export const generateRepositoryHealth: (...args: any[]) => any;
  export type ArtifactHygieneReport = any;
  export const analyzePullRequest: (...args: any[]) => any;
  export const formatAnalyzePrGithubComment: (...args: any[]) => string;
  export const formatAnalyzePrOutput: (...args: any[]) => string;
  export const generateKnowledgeCandidatesDraft: (...args: any[]) => any;
  export const generateRepositoryIndex: (...args: any[]) => any;
  export const generateRepositoryGraph: (...args: any[]) => any;
  export const buildModuleContextDigests: (...args: any[]) => any;
  export const writeModuleContextDigests: (...args: any[]) => any;
  export const generateCompactionCandidateArtifact: (...args: any[]) => any;
  export const readModuleContextDigest: (...args: any[]) => any;
  export const readRepositoryGraph: (...args: any[]) => any;
  export const summarizeRepositoryGraph: (...args: any[]) => any;
  export const REPOSITORY_GRAPH_RELATIVE_PATH: '.playbook/repo-graph.json';
  export const MODULE_CONTEXT_DIR_RELATIVE_PATH: '.playbook/context/modules';
  export const loadAiContract: (...args: any[]) => any;
  export const buildContractRegistry: (...args: any[]) => any;

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

  export const createExecutionIntent: (...args: any[]) => any;
  export const createExecutionRun: (...args: any[]) => any;
  export const appendExecutionStep: (...args: any[]) => any;
  export const completeExecutionRun: (...args: any[]) => any;
  export const listExecutionRuns: (...args: any[]) => any[];
  export const readExecutionRun: (...args: any[]) => any;
  export const getLatestMutableRun: (...args: any[]) => any;
}
