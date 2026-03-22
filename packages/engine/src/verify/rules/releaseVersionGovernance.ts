import type { ReportFailure } from '../../report/types.js';
import { verifyReleaseGovernance } from '../../release/index.js';

export const verifyReleaseVersionGovernance = (
  repoRoot: string,
  options: { baseRef?: string; baseSha?: string }
): ReportFailure[] => {
  if (!options.baseRef || !options.baseSha) {
    return [];
  }

  return verifyReleaseGovernance(repoRoot, {
    baseRef: options.baseRef,
    baseSha: options.baseSha
  });
};
