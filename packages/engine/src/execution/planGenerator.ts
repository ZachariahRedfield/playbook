import { createHash } from 'node:crypto';
import type { PlanTask, RuleFailure } from './types.js';

export type Plan = {
  tasks: PlanTask[];
};

const compareFindings = (left: RuleFailure, right: RuleFailure): number => {
  const idDiff = left.id.localeCompare(right.id);
  if (idDiff !== 0) {
    return idDiff;
  }

  const leftEvidence = left.evidence ?? '';
  const rightEvidence = right.evidence ?? '';
  const evidenceDiff = leftEvidence.localeCompare(rightEvidence);
  if (evidenceDiff !== 0) {
    return evidenceDiff;
  }

  return left.message.localeCompare(right.message);
};

const stableTaskSeed = (finding: RuleFailure): string =>
  `${finding.id}|${finding.evidence ?? ''}|${finding.fix ?? finding.message}|${Boolean(finding.fix)}`;

const stableTaskId = (seed: string, occurrence: number): string => {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 10);
  return `task-${digest}-${occurrence}`;
};

export class PlanGenerator {
  generate(findings: RuleFailure[]): Plan {
    const sortedFindings = [...findings].sort(compareFindings);
    const seen = new Map<string, number>();

    return {
      tasks: sortedFindings.map((finding) => {
        const action = finding.fix ?? finding.message;
        const autoFix = Boolean(finding.fix);
        const seed = stableTaskSeed(finding);
        const occurrence = (seen.get(seed) ?? 0) + 1;
        seen.set(seed, occurrence);

        return {
          id: stableTaskId(seed, occurrence),
          ruleId: finding.id,
          file: finding.evidence ?? null,
          action,
          autoFix
        };
      })
    };
  }
}
