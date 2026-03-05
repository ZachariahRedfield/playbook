import type { PlaybookConfig } from '../config/schema.js';
import type { ReportFailure } from '../report/types.js';

export interface PlaybookRule {
  id: string;
  run(context: {
    repoRoot: string;
    changedFiles: string[];
    config: PlaybookConfig;
  }): ReportFailure[];
}

export interface StackDetector {
  id: string;
  label: string;
  detect(repo: RepoContext): DetectionResult | null;
}

export interface RepoContext {
  repoRoot: string;
  packageJsonPath: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface DetectionResult {
  confidence: number;
  evidence: string[];
}

export interface PlaybookPlugin {
  name: string;
  rules?: PlaybookRule[];
  detectors?: StackDetector[];
}
