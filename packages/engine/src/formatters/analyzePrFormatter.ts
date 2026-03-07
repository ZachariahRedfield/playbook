import type { AnalyzePullRequestResult } from '../pr/analyzePr.js';
import { formatAnalyzePrGithubComment } from './githubCommentFormatter.js';
import { formatAnalyzePrGithubReview } from './githubReviewFormatter.js';

export type AnalyzePrOutputFormat = 'text' | 'json' | 'github-comment' | 'github-review';

export const formatAnalyzePrText = (analysis: AnalyzePullRequestResult): string => {
  const lines: string[] = [];

  lines.push('Playbook Pull Request Analysis');
  lines.push('');
  lines.push(`Base ref: ${analysis.baseRef}`);
  lines.push(`Changed files: ${analysis.summary.changedFileCount}`);
  lines.push(`Affected modules: ${analysis.summary.affectedModuleCount}`);
  lines.push(`Risk: ${analysis.risk.level}`);
  lines.push('');

  lines.push('Changed files');
  lines.push(...(analysis.changedFiles.length === 0 ? ['  - none'] : analysis.changedFiles.map((file) => `  - ${file}`)));
  lines.push('');

  lines.push('Affected modules');
  lines.push(...(analysis.affectedModules.length === 0 ? ['  - none'] : analysis.affectedModules.map((moduleName) => `  - ${moduleName}`)));
  lines.push('');

  lines.push('Review guidance');
  lines.push(...analysis.reviewGuidance.map((entry) => `  - ${entry}`));

  return lines.join('\n');
};

export const formatAnalyzePrJson = (analysis: AnalyzePullRequestResult): string => JSON.stringify(analysis, null, 2);

export const formatAnalyzePrOutput = (analysis: AnalyzePullRequestResult, format: AnalyzePrOutputFormat): string => {
  switch (format) {
    case 'json':
      return formatAnalyzePrJson(analysis);
    case 'github-comment':
      return formatAnalyzePrGithubComment(analysis);
    case 'github-review':
      return formatAnalyzePrGithubReview(analysis);
    case 'text':
    default:
      return formatAnalyzePrText(analysis);
  }
};

export { formatAnalyzePrGithubComment, formatAnalyzePrGithubReview };
