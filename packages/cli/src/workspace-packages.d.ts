declare module "@zachariahredfield/playbook-core" {
  export const analyze: (...args: any[]) => any;
  export const formatAnalyzeCi: (...args: any[]) => string;
  export const formatAnalyzeHuman: (...args: any[]) => string;
  export const formatAnalyzeJson: (...args: any[]) => string;
  export const verify: (...args: any[]) => any;
  export const formatHuman: (...args: any[]) => string;
  export const formatJson: (...args: any[]) => string;
}

declare module "@zachariahredfield/playbook-node" {
  export const createNodeContext: (...args: any[]) => any;
}

declare module "@zachariahredfield/playbook-engine" {
  export const loadConfig: (...args: any[]) => any;
  export const generateArchitectureDiagrams: (...args: any[]) => any;
}
