import type { AnalyzePullRequestResult } from '../pr/analyzePr.js';

export type GithubReviewAnnotation = {
  path: string;
  line: number;
  body: string;
};

const severityPrefix: Record<'info' | 'warning' | 'error', string> = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error'
};

export const formatAnalyzePrGithubReview = (analysis: AnalyzePullRequestResult): string => {
  const annotations: GithubReviewAnnotation[] = analysis.findings
    .filter((finding): finding is AnalyzePullRequestResult['findings'][number] & { file: string; line: number } =>
      Boolean(finding.file && typeof finding.line === 'number' && finding.line > 0)
    )
    .map((finding) => {
      const ruleRef = finding.ruleId ? ` ${finding.ruleId}` : '';
      const recommendation = finding.recommendation ? `\n\nRecommendation: ${finding.recommendation}` : '';
      return {
        path: finding.file,
        line: finding.line,
        body: `Playbook ${severityPrefix[finding.severity]}:${ruleRef} ${finding.message}${recommendation}`.trim()
      };
    });

  return JSON.stringify(annotations, null, 2);
};
