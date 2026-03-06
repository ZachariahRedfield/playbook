import { generatePlanContract } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type PlanRemediation = {
  status: 'ready' | 'not_needed' | 'unavailable';
  totalSteps: number;
  unresolvedFailures: number;
  reason?: string;
};

const buildRemediationSummary = (failureCount: number, totalSteps: number): PlanRemediation => {
  if (failureCount === 0) {
    return {
      status: 'not_needed',
      totalSteps,
      unresolvedFailures: 0,
      reason: 'No verify failures were detected.'
    };
  }

  if (totalSteps === 0) {
    return {
      status: 'unavailable',
      totalSteps,
      unresolvedFailures: failureCount,
      reason: 'Verify failures were detected but no remediation tasks are currently available.'
    };
  }

  return {
    status: 'ready',
    totalSteps,
    unresolvedFailures: Math.max(0, failureCount - totalSteps)
  };
};

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
  const remediation = buildRemediationSummary(plan.verify.summary.failures, plan.tasks.length);

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
