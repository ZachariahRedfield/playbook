import { createHash } from 'node:crypto';
import type { Detector, PatternCandidate } from './types.js';

const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 12);

export const workflowRecursionDetector: Detector = {
  detector: 'workflow-recursion',
  detect: ({ docsAudit }) => {
    const recursionFindings = docsAudit.findings.filter((finding) => finding.ruleId === 'docs.workflow.loop');
    const warningCount = recursionFindings.length;

    const idSeed = JSON.stringify({ detector: 'workflow-recursion', warningCount, ok: docsAudit.ok, status: docsAudit.status });

    const candidate: PatternCandidate = {
      id: `pattern.workflow-recursion.${shortHash(idSeed)}`,
      detector: 'workflow-recursion',
      title: 'Canonical remediation loop recurrence',
      summary:
        warningCount === 0
          ? 'Docs audit did not report remediation-loop drift, indicating consistent verify -> plan -> apply -> verify workflow recursion.'
          : `Docs audit reported ${warningCount} remediation-loop drift finding(s), showing workflow recursion pressure in docs surfaces.`,
      confidence: warningCount === 0 ? 0.9 : 0.62,
      evidence: [
        {
          artifact: '.playbook/docs-audit.json',
          pointer: 'findings[ruleId=docs.workflow.loop]',
          summary: `workflow_loop_findings=${warningCount}; status=${docsAudit.status}`
        }
      ],
      related: [...new Set(recursionFindings.map((finding) => finding.path))].sort((a, b) => a.localeCompare(b))
    };

    return [candidate];
  }
};
