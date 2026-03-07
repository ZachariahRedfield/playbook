import type { AnalyzePullRequestResult } from '../pr/analyzePr.js';

const titleCaseRisk = (level: AnalyzePullRequestResult['risk']['level']): string => level.toUpperCase();

const toBulletList = (items: string[], noneLabel: string): string[] => {
  if (items.length === 0) {
    return [`- ${noneLabel}`];
  }

  return items.map((item) => `- ${item}`);
};

const formatRuleFindings = (analysis: AnalyzePullRequestResult): string[] => {
  const findings: string[] = [];

  for (const ruleId of analysis.rules.related) {
    findings.push(`- ${ruleId}: related`);
  }

  for (const docSource of analysis.docs.recommendedReview) {
    findings.push(`- docs.review: ${docSource}`);
  }

  if (findings.length === 0) {
    return ['- none'];
  }

  return findings;
};

export const formatAnalyzePrGithubComment = (analysis: AnalyzePullRequestResult): string => {
  const lines: string[] = [];

  lines.push('## 🧠 Playbook PR Analysis');
  lines.push('');
  lines.push(`- **Base Ref:** \`${analysis.baseRef}\``);
  lines.push(`- **Risk Level:** ${titleCaseRisk(analysis.risk.level)}`);
  lines.push(`- **Changed Files:** ${analysis.summary.changedFileCount}`);
  lines.push(`- **Affected Modules:** ${analysis.summary.affectedModuleCount}`);
  lines.push('');

  lines.push('### Affected Modules');
  lines.push(...toBulletList(analysis.affectedModules, 'none'));
  lines.push('');

  lines.push('### Governance Findings');
  lines.push(...formatRuleFindings(analysis));
  lines.push('');

  lines.push('### Architecture Impact');
  if (analysis.architecture.boundariesTouched.length === 0) {
    lines.push('- No boundary violations detected');
  } else {
    lines.push(`- Boundaries touched: ${analysis.architecture.boundariesTouched.join(', ')}`);
  }
  lines.push('');

  lines.push('### Reviewer Checklist');
  lines.push('- [ ] Confirm snapshot updates intentional');
  lines.push('- [ ] Validate new command docs');
  lines.push('- [ ] Verify CLI contract stability');
  lines.push('');

  lines.push('### Review Guidance');
  lines.push(...toBulletList(analysis.reviewGuidance, 'No additional guidance'));
  lines.push('');

  lines.push('### Automation Status');
  lines.push('- verify: recommended');
  lines.push('- plan: run when verify reports findings');
  lines.push('- apply: run from generated plan when required');

  return lines.join('\n');
};
