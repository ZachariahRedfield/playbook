import * as engine from '@zachariahredfield/playbook-engine';
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

const resolveRunId = (cwd: string, requestedRunId: string | undefined): string => {
  if (requestedRunId) {
    return requestedRunId;
  }

  const latest = engine.getLatestMutableRun ? engine.getLatestMutableRun(cwd) : null;
  if (latest) {
    return latest.id;
  }

  const intent = engine.createExecutionIntent('execute deterministic remediation workflow', ['verify', 'plan', 'apply', 'verify'], ['ordered-steps'], 'user');
  return engine.createExecutionRun(cwd, intent).id;
};

export const runPlan = async (
  cwd: string,
  options: { format: 'text' | 'json'; ci: boolean; quiet: boolean; outFile?: string; runId?: string }
): Promise<number> => {
  const routeDecision = engine.routeTask(cwd, 'generate remediation execution plan', {
    taskKind: 'graph_query_report',
    hasApprovedPlan: true,
    safetyConstraints: { allowRepositoryMutation: false, requiresApprovedPlan: false }
  });

  if (routeDecision.route === 'unsupported') {
    throw new Error(`Cannot generate plan: ${routeDecision.why}`);
  }

  const plan = engine.generatePlanContract(cwd);
  const failureFacts = deriveVerifyFailureFacts(plan.verify);
  const failureCount = failureFacts.failureCount;
  const remediation = buildPlanRemediation({ failureCount, stepCount: plan.tasks.length });
  const runId = resolveRunId(cwd, options.runId);

  engine.appendExecutionStep(cwd, runId, {
    kind: 'plan',
    status: 'passed',
    inputs: { verifyFailures: failureCount },
    outputs: { taskCount: plan.tasks.length, remediationStatus: remediation.status },
    evidence: [
      ...(options.outFile ? [{ id: 'evidence-plan-artifact', kind: 'artifact' as const, ref: options.outFile }] : [])
    ]
  });

  const runArtifactPath = engine.executionRunPath(cwd, runId);
  engine.attachSessionRunState(cwd, {
    step: 'plan',
    runId,
    goal: 'generate remediation execution plan',
    artifacts: [
      { artifact: runArtifactPath, kind: 'run' },
      ...(options.outFile ? [{ artifact: options.outFile, kind: 'plan' as const }] : [])
    ]
  });

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
