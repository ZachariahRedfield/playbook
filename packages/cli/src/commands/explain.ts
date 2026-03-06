import { ExitCode } from '../lib/cliContract.js';
import { loadAnalyzeRules } from '../lib/loadAnalyzeRules.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';

type ExplainRule = {
  kind: 'verify' | 'analyze';
  id: string;
  description: string;
  explanation?: string;
  remediation?: string[];
};

type ExplainResult = {
  schemaVersion: '1.0';
  command: 'explain';
  rule: ExplainRule;
};

const findRule = async (cwd: string, ruleId: string): Promise<ExplainRule | undefined> => {
  const verifyRule = (await loadVerifyRules(cwd)).find((rule) => rule.id === ruleId);
  if (verifyRule) {
    return {
      kind: 'verify',
      id: verifyRule.id,
      description: verifyRule.description,
      explanation: verifyRule.explanation,
      remediation: verifyRule.remediation
    };
  }

  const analyzeRule = (await loadAnalyzeRules()).find((rule) => rule.id === ruleId);
  if (analyzeRule) {
    return {
      kind: 'analyze',
      id: analyzeRule.id,
      description: analyzeRule.description,
      explanation: analyzeRule.explanation,
      remediation: analyzeRule.remediation
    };
  }

  return undefined;
};

const firstPositionalArg = (args: string[]): string | undefined => args.find((arg) => !arg.startsWith('-'));

const printText = (rule: ExplainRule): void => {
  console.log(`Rule: ${rule.id}`);
  console.log('');
  console.log('Description');
  console.log(rule.description);
  console.log('');
  console.log('Why this exists');
  console.log(rule.explanation ?? 'No explanation provided for this rule.');
  console.log('');
  console.log('How to fix');
  if (rule.remediation && rule.remediation.length > 0) {
    for (const step of rule.remediation) {
      console.log(`- ${step}`);
    }
    return;
  }

  console.log('- No remediation steps provided for this rule.');
};

export const runExplain = async (
  cwd: string,
  commandArgs: string[],
  options: { format: 'text' | 'json'; quiet: boolean }
): Promise<number> => {
  const ruleId = firstPositionalArg(commandArgs);
  if (!ruleId) {
    console.error('playbook explain: missing required <ruleId> argument');
    return ExitCode.Failure;
  }

  const rule = await findRule(cwd, ruleId);
  if (!rule) {
    console.error(`playbook explain: rule not found: ${ruleId}`);
    return ExitCode.Failure;
  }

  const result: ExplainResult = {
    schemaVersion: '1.0',
    command: 'explain',
    rule
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    printText(result.rule);
  }

  return ExitCode.Success;
};
