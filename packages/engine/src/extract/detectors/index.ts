import { contractSymmetryDetector } from './contractSymmetryDetector.js';
import { layeringDetector } from './layeringDetector.js';
import { modularityDetector } from './modularityDetector.js';
import { queryBeforeMutationDetector } from './queryBeforeMutationDetector.js';
import { workflowRecursionDetector } from './workflowRecursionDetector.js';

export { contractSymmetryDetector, layeringDetector, modularityDetector, queryBeforeMutationDetector, workflowRecursionDetector };
export type { Detector, ExtractionArtifacts, PatternCandidate, PatternEvidence } from './types.js';

export const DEFAULT_PATTERN_CANDIDATE_DETECTORS = [
  layeringDetector,
  modularityDetector,
  workflowRecursionDetector,
  contractSymmetryDetector,
  queryBeforeMutationDetector
] as const;
