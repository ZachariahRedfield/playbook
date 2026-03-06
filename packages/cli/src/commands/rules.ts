import { ExitCode } from '../lib/cliContract.js';
import { loadAnalyzeRules } from '../lib/loadAnalyzeRules.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';

type RuleSummary = {
  id: string;
  description: string;
  explanation?: string;
};

type RulesResult = {
  schemaVersion: '1.0';
  command: 'rules';
  verify: RuleSummary[];
  analyze: RuleSummary[];
};

const toRuleSummary = (rule: { id: string; description: string; explanation?: string }, explain: boolean): RuleSummary => ({
  id: rule.id,
  description: rule.description,
  ...(explain && rule.explanation ? { explanation: rule.explanation } : {})
});

const printText = (result: RulesResult, explain: boolean): void => {
  console.log('Verify Rules');
  console.log('────────────');
  for (const rule of result.verify) {
    console.log(`${rule.id}: ${rule.description}`);
    if (explain && rule.explanation) {
      console.log(`  ${rule.explanation}`);
    }
  }

  console.log('');
  console.log('Analyze Rules');
  console.log('────────────');
  for (const rule of result.analyze) {
    console.log(`${rule.id}: ${rule.description}`);
    if (explain && rule.explanation) {
      console.log(`  ${rule.explanation}`);
    }
  }
};

export const runRules = async (
  _cwd: string,
  options: { format: 'text' | 'json'; quiet: boolean; explain: boolean }
): Promise<number> => {
  const result: RulesResult = {
    schemaVersion: '1.0',
    command: 'rules',
    verify: (await loadVerifyRules(_cwd)).map((rule) => toRuleSummary(rule, options.explain)),
    analyze: (await loadAnalyzeRules()).map((rule) => toRuleSummary(rule, options.explain))
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    printText(result, options.explain);
  }

  return ExitCode.Success;
};
