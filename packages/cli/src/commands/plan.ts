import { generatePlanContract, routeTask } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { buildPlanRemediation, deriveVerifyFailureFacts } from '../lib/remediationContract.js';

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
  options: { format: 'text' | 'json'; ci: boolean; quiet: boolean; outFile?: string }
): Promise<number> => {
  const routeDecision = routeTask(cwd, 'generate remediation execution plan', {
    taskKind: 'graph_query_report',
    hasApprovedPlan: true,
    safetyConstraints: { allowRepositoryMutation: false, requiresApprovedPlan: false }
  });

  if (routeDecision.route === 'unsupported') {
    throw new Error(`Cannot generate plan: ${routeDecision.why}`);
  }

  const plan = generatePlanContract(cwd);
  const failureFacts = deriveVerifyFailureFacts(plan.verify);
  const failureCount = failureFacts.failureCount;
  const remediation = buildPlanRemediation({ failureCount, stepCount: plan.tasks.length });

  if (process.env.PLAYBOOK_DEBUG_REMEDIATION === '1') {
    console.error(
      JSON.stringify(
        {
          command: 'plan',
          remediationDerivation: {
            failureCount,
            stepCount: plan.tasks.length,
            remediationStatus: remediation.status,
            verifyFailureSources: failureFacts.sources
          },
          verifyPayload: plan.verify
        },
        null,
        2
      )
    );
  }

  if (options.format === 'json') {
    const payload = {
      schemaVersion: '1.0',
      command: 'plan',
      ok: true,
      exitCode: ExitCode.Success,
      verify: plan.verify,
      remediation,
      tasks: plan.tasks
    };

    emitJsonOutput({ cwd, command: 'plan', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderTextPlan(plan.tasks);
  }

  return ExitCode.Success;
};
