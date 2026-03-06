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
  export const generateRepositoryIndex: (...args: any[]) => any;

  export const queryRepositoryIndex: (...args: any[]) => any;
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
