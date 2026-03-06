import type { AnalyzeReport } from '../commands/analyze.js';
import { noSignalsRule } from '../rules/analyze/noSignalsRule.js';
import { runInitRule } from '../rules/analyze/runInitRule.js';
import { runVerifyRule } from '../rules/analyze/runVerifyRule.js';

export type AnalyzeRecommendation = AnalyzeReport['recommendations'][number];

export type AnalyzeRule = {
  id: string;
  description: string;
  check: (ctx: { recommendation: AnalyzeRecommendation }) => boolean;
  explanation?: string;
  remediation?: string[];
};

export const coreAnalyzeRules: AnalyzeRule[] = [noSignalsRule, runInitRule, runVerifyRule];

export const loadAnalyzeRules = async (): Promise<AnalyzeRule[]> => coreAnalyzeRules;
