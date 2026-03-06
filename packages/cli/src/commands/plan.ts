import { generatePlanContract } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { buildPlanRemediation } from '../lib/remediationContract.js';

const renderTextPlan = (tasks: Array<{ ruleId: string; action: string }>): void => {
  console.log('Plan');
  console.log('────────');
  console.log('');
  console.log(`Tasks: ${tasks.length}`);
  console.log('');

  if (tasks.length === 0) {
    console.log('(none)');
    return;
  }

  for (const task of tasks) {
    const sentenceAction = task.action.charAt(0).toUpperCase() + task.action.slice(1);
    console.log(`${task.ruleId} ${sentenceAction}`);
  }
};

export const runPlan = async (
  cwd: string,
  options: { format: 'text' | 'json'; ci: boolean; quiet: boolean }
): Promise<number> => {
  const plan = generatePlanContract(cwd);
  const structuredFindingCount =
    (Array.isArray(plan.verify.failures) ? plan.verify.failures.length : 0) +
    (Array.isArray(plan.verify.warnings) ? plan.verify.warnings.length : 0);
  const findingCount = structuredFindingCount > 0 ? structuredFindingCount : plan.verify.summary.failures + plan.verify.summary.warnings;
  const remediation = buildPlanRemediation({ findingCount, stepCount: plan.tasks.length });

  if (options.format === 'json') {
    console.log(
      JSON.stringify(
        {
          schemaVersion: '1.0',
          command: 'plan',
          ok: true,
          exitCode: ExitCode.Success,
          verify: plan.verify,
          remediation,
          tasks: plan.tasks
        },
        null,
        2
      )
    );
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderTextPlan(plan.tasks);
  }

  return ExitCode.Success;
};
