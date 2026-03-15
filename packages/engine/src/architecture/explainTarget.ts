import { explainTarget as explainTargetFromEngine, type ExplainTargetOptions, type ExplainTargetResult } from '../explain/explainEngine.js';

export { type ExplainTargetOptions, type ExplainTargetResult };

export const explainTarget = (projectRoot: string, target: string, options?: ExplainTargetOptions): ExplainTargetResult =>
  explainTargetFromEngine(projectRoot, target, options);
