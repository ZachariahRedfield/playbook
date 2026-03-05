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
  export const generateArchitectureDiagrams: (...args: any[]) => Promise<any>;
  export const cleanupSessionSnapshots: (...args: any[]) => any;
  export const formatMergeReportMarkdown: (...args: any[]) => string;
  export const importChatTextSnapshot: (...args: any[]) => any;
  export const mergeSessionSnapshots: (...args: any[]) => any;
  export const validateSessionSnapshot: (...args: any[]) => any;
}
