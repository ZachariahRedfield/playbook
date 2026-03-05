import type { AnalyzeRecommendation, AnalyzeResult, AnalyzeSeverity } from '../analyze/index.js';

const severityRank: Record<AnalyzeSeverity, number> = {
  WARN: 0,
  RECOMMEND: 1,
  INFO: 2
};

const sortRecommendations = (recommendations: AnalyzeRecommendation[]): AnalyzeRecommendation[] =>
  [...recommendations].sort((a, b) => {
    const severityDelta = severityRank[a.severity] - severityRank[b.severity];
    if (severityDelta !== 0) return severityDelta;
    return a.id.localeCompare(b.id) || a.title.localeCompare(b.title);
  });

const nextAction = (recommendations: AnalyzeRecommendation[]): string => {
  const actionable = recommendations.find((item) => item.severity === 'WARN')
    ?? recommendations.find((item) => item.severity === 'RECOMMEND');
  return actionable ? actionable.fix : 'No action required.';
};

const formatRecommendation = (recommendation: AnalyzeRecommendation): string[] => {
  const lines = [
    `[${recommendation.severity}] ${recommendation.title}  (id: ${recommendation.id})`,
    `  Why: ${recommendation.why}`,
    `  Fix: ${recommendation.fix}`
  ];

  if (recommendation.files?.length) {
    lines.push(`  Files: ${recommendation.files.join(', ')}`);
  }

  return lines;
};

export const formatAnalyzeHuman = (report: AnalyzeResult): string => {
  const recommendations = sortRecommendations(report.recommendations);
  const lines: string[] = [
    'Playbook Analyze',
    `Repo: ${report.repoPath}`,
    `Signals: ${report.signals}`,
    '',
    `Recommendations (${recommendations.length})`
  ];

  for (const recommendation of recommendations) {
    lines.push(...formatRecommendation(recommendation));
    lines.push('');
  }

  lines.push(`Next: ${nextAction(recommendations)}`);
  return lines.join('\n').trimEnd();
};

export const formatAnalyzeCi = (report: AnalyzeResult): string => {
  const recommendations = sortRecommendations(report.recommendations);
  const warnCount = recommendations.filter((item) => item.severity === 'WARN').length;
  const recommendCount = recommendations.filter((item) => item.severity === 'RECOMMEND').length;
  const infoCount = recommendations.filter((item) => item.severity === 'INFO').length;
  const status = warnCount > 0 ? 'FAIL' : 'PASS';

  const lines = [
    `playbook analyze: ${status}  (warns=${warnCount} recommends=${recommendCount} info=${infoCount})`
  ];

  for (const recommendation of recommendations.filter((item) => item.severity !== 'INFO')) {
    lines.push(...formatRecommendation(recommendation));
  }

  return lines.join('\n').trimEnd();
};

export const formatAnalyzeJson = (report: AnalyzeResult): string => {
  const recommendations = sortRecommendations(report.recommendations).map((recommendation) => ({
    id: recommendation.id,
    title: recommendation.title,
    severity: recommendation.severity,
    message: recommendation.message,
    why: recommendation.why,
    fix: recommendation.fix,
    files: recommendation.files
  }));

  return JSON.stringify(
    {
      ok: recommendations.every((item) => item.severity !== 'WARN'),
      signals: report.signals,
      recommendations
    },
    null,
    2
  );
};
