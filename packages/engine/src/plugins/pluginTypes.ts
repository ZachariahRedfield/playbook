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
  detect(repoRoot: string, pkg: Record<string, string>): boolean;
}

export interface PlaybookPlugin {
  name: string;
  rules?: PlaybookRule[];
  detectors?: StackDetector[];
}
