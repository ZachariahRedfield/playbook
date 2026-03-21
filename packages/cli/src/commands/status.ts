import { collectAnalyzeReport, ensureRepoIndex } from './analyze.js';
import { collectDoctorReport } from './doctor.js';
import { collectVerifyReport } from './verify.js';
import { ExitCode } from '../lib/cliContract.js';
import { loadAnalyzeRules } from '../lib/loadAnalyzeRules.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';
import {
  buildFleetAdoptionReadinessSummary,
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  buildFleetExecutionReceipt,
  buildFleetUpdatedAdoptionState,
  deriveNextAdoptionQueueFromUpdatedState,
  buildRepoAdoptionReadiness,
  runBootstrapProof,
  defaultBootstrapCliResolutionCommands,
  type BootstrapCliResolutionCommand,
  type FleetAdoptionWorkQueue,
  type FleetCodexExecutionPlan,
  type FleetAdoptionReadinessSummary,
  type FleetExecutionOutcomeInput,
  type FleetExecutionReceipt,
  type FleetUpdatedAdoptionState,
  type RepoAdoptionReadiness
} from '@zachariahredfield/playbook-engine';
import fs from 'node:fs';
import path from 'node:path';
import type { AnalyzeReport } from './analyze.js';
import type { VerifyReport } from './verify.js';
import { previewWorkflowArtifact, stageWorkflowArtifact } from '../lib/workflowPromotion.js';
import type { WorkflowPromotion } from '../lib/workflowPromotion.js';
import {
  buildExecutionPlanInterpretation,
  buildFleetInterpretation,
  buildProofInterpretation,
  buildQueueInterpretation,
  buildReceiptInterpretation,
  buildRepoStatusInterpretation,
  buildUpdatedStateInterpretation,
  type InterpretationLayer
} from '../lib/interpretation.js';
import { renderBriefReport } from '../lib/briefText.js';

type StatusOptions = {
  ci: boolean;
  format: 'text' | 'json';
  quiet: boolean;
  scope?: 'repo' | 'fleet' | 'queue' | 'execute' | 'receipt' | 'updated' | 'proof';
};

type StatusResult = {
  schemaVersion: '1.0';
  command: 'status';
  ok: boolean;
  environment: { ok: boolean };
  analysis: { warnings: number; errors: number };
  verification: { ok: boolean };
  summary: {
    warnings: number;
    errors: number;
  };
  adoption: RepoAdoptionReadiness;
  interpretation: InterpretationLayer;
};

type StatusFleetResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'fleet';
  fleet: FleetAdoptionReadinessSummary;
  interpretation: InterpretationLayer;
};

type StatusQueueResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'queue';
  queue: FleetAdoptionWorkQueue;
  interpretation: InterpretationLayer;
};



type StatusExecutionResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'execute';
  execution_plan: FleetCodexExecutionPlan;
  interpretation: InterpretationLayer;
};

type StatusReceiptResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'receipt';
  receipt: FleetExecutionReceipt;
  interpretation: InterpretationLayer;
};


type StatusUpdatedStateResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'updated';
  updated_state: FleetUpdatedAdoptionState;
  next_queue: FleetAdoptionWorkQueue;
  promotion: WorkflowPromotion;
  interpretation: InterpretationLayer;
};


type StatusProofResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'proof';
  proof: ReturnType<typeof runBootstrapProof>;
  interpretation: InterpretationLayer;
};

type ObserverRegistry = {
  repos: Array<{ id: string; name: string; root: string }>;
};

type RepoIndexSummary = {
  framework: string;
  modules: string[];
  docs: string[];
  rules: string[];
};

type TopIssue = {
  id: string;
  description: string;
};


const EXECUTION_OUTCOME_INPUT_RELATIVE_PATH = path.join('.playbook', 'execution-outcome-input.json');
const UPDATED_STATE_RELATIVE_PATH = path.join('.playbook', 'execution-updated-state.json');
const UPDATED_STATE_STAGING_RELATIVE_PATH = path.join('.playbook', 'staged', 'workflow-status-updated', 'execution-updated-state.json');

const defaultOutcomeInput = (): FleetExecutionOutcomeInput => ({
  schemaVersion: '1.0',
  kind: 'fleet-adoption-execution-outcome-input',
  generated_at: new Date(0).toISOString(),
  session_id: 'unrecorded-session',
  prompt_outcomes: []
});

const readExecutionOutcomeInput = (cwd: string): FleetExecutionOutcomeInput => {
  const targetPath = path.join(cwd, EXECUTION_OUTCOME_INPUT_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    return defaultOutcomeInput();
  }

  return JSON.parse(fs.readFileSync(targetPath, 'utf8')) as FleetExecutionOutcomeInput;
};

const readRepoIndexSummary = (cwd: string): RepoIndexSummary | null => {
  const repoIndexPath = path.join(cwd, '.playbook', 'repo-index.json');
  if (!fs.existsSync(repoIndexPath)) {
    return null;
  }

  const raw = fs.readFileSync(repoIndexPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<RepoIndexSummary>;

  if (typeof parsed.framework !== 'string') {
    return null;
  }

  return {
    framework: parsed.framework,
    modules: Array.isArray(parsed.modules) ? parsed.modules.filter((value): value is string => typeof value === 'string') : [],
    docs: Array.isArray(parsed.docs) ? parsed.docs.filter((value): value is string => typeof value === 'string') : [],
    rules: Array.isArray(parsed.rules) ? parsed.rules.filter((value): value is string => typeof value === 'string') : []
  };
};

const resolveTopIssue = async (
  cwd: string,
  verify: VerifyReport,
  analyze: AnalyzeReport
): Promise<TopIssue | null> => {
  const failure = verify.failures[0];
  if (failure) {
    const matchingRule = (await loadVerifyRules(cwd)).find((rule) => rule.check({ failure }));
    if (matchingRule) {
      return { id: matchingRule.id, description: matchingRule.description };
    }
    return { id: failure.id, description: failure.message };
  }

  const warningRecommendation = analyze.recommendations.find((recommendation: { severity: string }) => recommendation.severity === 'WARN');
  if (!warningRecommendation) {
    return null;
  }

  const matchingRule = (await loadAnalyzeRules()).find((rule) => rule.check({ recommendation: warningRecommendation }));
  if (matchingRule) {
    return { id: matchingRule.id, description: matchingRule.description };
  }

  return { id: warningRecommendation.id, description: warningRecommendation.title };
};

const toStatusResult = async (cwd: string): Promise<{ result: StatusResult; exitCode: ExitCode; topIssue: TopIssue | null; repoRoot: string }> => {
  const doctor = await collectDoctorReport(cwd);
  const analyze = await collectAnalyzeReport(cwd);
  const verify = await collectVerifyReport(cwd);
  await ensureRepoIndex(analyze.repoPath);

  const warnings = analyze.recommendations.filter((rec: { severity: string }) => rec.severity === 'WARN').length;
  const errors = 0;

  const environmentOk = doctor.status !== 'error';

  const adoption = buildRepoAdoptionReadiness({ repoRoot: analyze.repoPath, connected: true });

  const result: StatusResult = {
    schemaVersion: '1.0',
    command: 'status',
    ok: doctor.status !== 'error' && verify.ok,
    environment: { ok: environmentOk },
    analysis: { warnings, errors },
    verification: { ok: verify.ok },
    summary: { warnings, errors },
    adoption,
    interpretation: buildRepoStatusInterpretation({
      ok: doctor.status !== 'error' && verify.ok,
      adoption,
      topIssueDescription: null,
      topIssueId: null
    })
  };

  const exitCode = verify.ok ? ExitCode.Success : ExitCode.PolicyFailure;

  const topIssue = await resolveTopIssue(cwd, verify, analyze);
  result.interpretation = buildRepoStatusInterpretation({
    ok: result.ok,
    adoption: result.adoption,
    topIssueDescription: topIssue?.description ?? null,
    topIssueId: topIssue?.id ?? null
  });

  return { result, exitCode, topIssue, repoRoot: analyze.repoPath };
};

const toFleetStatusResult = (cwd: string): StatusFleetResult => {
  const registryPath = path.join(cwd, '.playbook', 'observer', 'repos.json');
  const registry = fs.existsSync(registryPath)
    ? (JSON.parse(fs.readFileSync(registryPath, 'utf8')) as ObserverRegistry)
    : { repos: [{ id: 'current-repo', name: path.basename(cwd), root: cwd }] };

  const repos = Array.isArray(registry.repos) ? registry.repos : [];
  const fleet = buildFleetAdoptionReadinessSummary(
    repos.map((repo) => ({
      repo_id: repo.id,
      repo_name: repo.name,
      readiness: buildRepoAdoptionReadiness({ repoRoot: repo.root, connected: true })
    }))
  );

  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'fleet',
    fleet,
    interpretation: buildFleetInterpretation(fleet)
  };
};

const toQueueStatusResult = (cwd: string): StatusQueueResult => {
  const fleet = toFleetStatusResult(cwd).fleet;
  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'queue',
    queue: buildFleetAdoptionWorkQueue(fleet),
    interpretation: buildQueueInterpretation(buildFleetAdoptionWorkQueue(fleet))
  };
};


const toExecutionStatusResult = (cwd: string): StatusExecutionResult => {
  const queue = toQueueStatusResult(cwd).queue;
  const executionPlan = buildFleetCodexExecutionPlan(queue);
  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'execute',
    execution_plan: executionPlan,
    interpretation: buildExecutionPlanInterpretation(executionPlan)
  };
};


const validateUpdatedStateArtifact = (updatedState: FleetUpdatedAdoptionState, nextQueue: FleetAdoptionWorkQueue): string[] => {
  const errors: string[] = [];
  if (updatedState.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0');
  if (updatedState.kind !== 'fleet-adoption-updated-state') errors.push('kind must be fleet-adoption-updated-state');
  if (!Array.isArray(updatedState.repos)) errors.push('repos must be an array');
  if (!updatedState.summary || typeof updatedState.summary !== 'object') errors.push('summary must be present');
  if (nextQueue.queue_source !== 'updated_state') errors.push('next queue must be derived from updated_state');
  if (Array.isArray(updatedState.repos) && updatedState.summary?.repos_total !== updatedState.repos.length) {
    errors.push('summary.repos_total must match repos length');
  }
  return errors;
};


const previewUpdatedStatePromotion = (cwd: string, updatedState: FleetUpdatedAdoptionState, nextQueue: FleetAdoptionWorkQueue): WorkflowPromotion =>
  previewWorkflowArtifact({
    cwd,
    workflowKind: 'status-updated',
    candidateRelativePath: UPDATED_STATE_STAGING_RELATIVE_PATH,
    committedRelativePath: UPDATED_STATE_RELATIVE_PATH,
    artifact: updatedState,
    validate: () => validateUpdatedStateArtifact(updatedState, nextQueue),
    generatedAt: updatedState.generated_at,
    successSummary: 'Staged updated-state candidate validated and ready for promotion into committed adoption state.',
    blockedSummary: 'Staged updated-state candidate blocked; committed adoption state preserved.'
  });

const stageAndPromoteUpdatedStateArtifact = (cwd: string, updatedState: FleetUpdatedAdoptionState, nextQueue: FleetAdoptionWorkQueue): WorkflowPromotion =>
  stageWorkflowArtifact({
    cwd,
    workflowKind: 'status-updated',
    candidateRelativePath: UPDATED_STATE_STAGING_RELATIVE_PATH,
    committedRelativePath: UPDATED_STATE_RELATIVE_PATH,
    artifact: updatedState,
    validate: () => validateUpdatedStateArtifact(updatedState, nextQueue),
    generatedAt: updatedState.generated_at,
    successSummary: 'Staged updated-state candidate validated and promoted into committed adoption state.',
    blockedSummary: 'Staged updated-state candidate blocked; committed adoption state preserved.'
  });

const computeReceipt = (cwd: string): { fleet: FleetAdoptionReadinessSummary; queue: FleetAdoptionWorkQueue; executionPlan: FleetCodexExecutionPlan; receipt: FleetExecutionReceipt } => {
  const fleet = toFleetStatusResult(cwd).fleet;
  const queue = buildFleetAdoptionWorkQueue(fleet);
  const executionPlan = buildFleetCodexExecutionPlan(queue);
  const provisionalReceipt = buildFleetExecutionReceipt(executionPlan, queue, fleet, readExecutionOutcomeInput(cwd));
  const updatedState = buildFleetUpdatedAdoptionState(executionPlan, queue, fleet, provisionalReceipt);
  const nextQueue = deriveNextAdoptionQueueFromUpdatedState(updatedState);
  const workflowPromotion = previewUpdatedStatePromotion(cwd, updatedState, nextQueue);
  const receipt = buildFleetExecutionReceipt(executionPlan, queue, fleet, readExecutionOutcomeInput(cwd), { workflowPromotion });
  return { fleet, queue, executionPlan, receipt };
};

const toReceiptStatusResult = (cwd: string): StatusReceiptResult => {
  const { receipt } = computeReceipt(cwd);
  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'receipt',
    receipt,
    interpretation: buildReceiptInterpretation(receipt)
  };
};


const currentBootstrapCliResolutionCommand = (): BootstrapCliResolutionCommand | null => {
  const scriptPath = process.argv[1];
  if (typeof scriptPath !== 'string' || scriptPath.trim().length === 0) {
    return null;
  }

  return {
    label: `current Playbook CLI (${path.basename(scriptPath)}) --version`,
    command: process.execPath,
    args: [scriptPath, '--version']
  };
};

const bootstrapCliResolutionCommands = (): BootstrapCliResolutionCommand[] => {
  const current = currentBootstrapCliResolutionCommand();
  return current ? [current, ...defaultBootstrapCliResolutionCommands()] : defaultBootstrapCliResolutionCommands();
};

const toProofStatusResult = (cwd: string): { result: StatusProofResult; exitCode: ExitCode } => {
  const proof = runBootstrapProof(cwd, { cliResolutionCommands: bootstrapCliResolutionCommands() });
  return {
    result: {
      schemaVersion: '1.0',
      command: 'status',
      mode: 'proof',
      proof,
      interpretation: buildProofInterpretation(proof)
    },
    exitCode: proof.ok ? ExitCode.Success : ExitCode.Failure
  };
};

const toUpdatedStateStatusResult = (cwd: string): { result: StatusUpdatedStateResult; exitCode: ExitCode } => {
  const { fleet, queue, executionPlan, receipt } = computeReceipt(cwd);
  const updatedState = buildFleetUpdatedAdoptionState(executionPlan, queue, fleet, receipt);
  const nextQueue = deriveNextAdoptionQueueFromUpdatedState(updatedState);
  const promotion = stageAndPromoteUpdatedStateArtifact(cwd, updatedState, nextQueue);
  return {
    exitCode: promotion.promoted ? ExitCode.Success : ExitCode.Failure,
    result: {
      schemaVersion: '1.0',
      command: 'status',
      mode: 'updated',
      updated_state: updatedState,
      next_queue: nextQueue,
      promotion,
      interpretation: buildUpdatedStateInterpretation(updatedState, nextQueue, promotion.promotion_status)
    }
  };
};

const printHuman = (
  result: StatusResult,
  ci: boolean,
  repoIndexSummary: RepoIndexSummary | null,
  topIssue: TopIssue | null
): void => {
  if (ci) {
    console.log(result.ok ? 'OK' : 'FAIL');
    console.log(`warnings=${result.summary.warnings}`);
    console.log(`errors=${result.summary.errors}`);
    return;
  }

  console.log(
    renderBriefReport({
      title: 'Status',
      decision: result.ok ? 'healthy' : 'attention required',
      affectedSurfaces: [
        repoIndexSummary ? `framework ${repoIndexSummary.framework}` : null,
        repoIndexSummary && repoIndexSummary.modules.length > 0 ? `${repoIndexSummary.modules.length} module(s)` : null,
        `lifecycle ${result.adoption.lifecycle_stage}`
      ],
      blockers: [
        result.adoption.blockers[0] ? `${result.adoption.blockers[0].code}: ${result.adoption.blockers[0].message}` : null,
        topIssue ? `${topIssue.id}: ${topIssue.description}` : null
      ],
      nextAction: result.interpretation.progressive_disclosure.default_view.next_step.command ?? result.interpretation.progressive_disclosure.default_view.next_step.label,
      sections: [
        {
          heading: 'Why',
          items: [
            result.interpretation.progressive_disclosure.default_view.why,
            `Warnings: ${result.summary.warnings}; errors: ${result.summary.errors}`,
            `Verification: ${result.verification.ok ? 'ok' : 'failed'}`
          ]
        }
      ]
    })
  );
};

export const runStatus = async (cwd: string, options: StatusOptions): Promise<number> => {
  try {
    if (options.scope === 'queue') {
      const queueResult = toQueueStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(queueResult, null, 2));
      } else {
        console.log(renderBriefReport({
          title: 'Status queue',
          decision: queueResult.interpretation.progressive_disclosure.default_view.state,
          affectedSurfaces: [`${queueResult.queue.total_repos} repo(s) in queue`, `top lane ${queueResult.queue.grouped_actions[0]?.parallel_group ?? 'n/a'}`],
          blockers: queueResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 2),
          nextAction: queueResult.interpretation.progressive_disclosure.default_view.next_step.command ?? queueResult.interpretation.progressive_disclosure.default_view.next_step.label,
          sections: [{ heading: 'Why', items: [queueResult.interpretation.progressive_disclosure.default_view.why, `Wave 1 actions: ${queueResult.queue.waves[0]?.action_count ?? 0}`, `Wave 2 actions: ${queueResult.queue.waves[1]?.action_count ?? 0}`] }]
        }));
      }
      return ExitCode.Success;
    }

    if (options.scope === 'fleet') {
      const fleetResult = toFleetStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(fleetResult, null, 2));
      } else {
        console.log(renderBriefReport({
          title: 'Status fleet',
          decision: fleetResult.interpretation.progressive_disclosure.default_view.state,
          affectedSurfaces: [`${fleetResult.fleet.total_repos} repo(s) observed`, `top action ${fleetResult.fleet.recommended_actions[0]?.command ?? 'n/a'}`],
          blockers: fleetResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 2),
          nextAction: fleetResult.interpretation.progressive_disclosure.default_view.next_step.command ?? fleetResult.interpretation.progressive_disclosure.default_view.next_step.label,
          sections: [{ heading: 'Why', items: [fleetResult.interpretation.progressive_disclosure.default_view.why, `Ready repos: ${fleetResult.fleet.by_lifecycle_stage.ready}`, `Cross-repo eligible: ${fleetResult.fleet.cross_repo_eligible_count}`] }]
        }));
      }
      return ExitCode.Success;
    }

    if (options.scope === 'execute') {
      const executionResult = toExecutionStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(executionResult, null, 2));
      } else {
        const wave1 = executionResult.execution_plan.waves.find((wave: { wave_id: string; repos: string[] }) => wave.wave_id === 'wave_1');
        const wave2 = executionResult.execution_plan.waves.find((wave: { wave_id: string; repos: string[] }) => wave.wave_id === 'wave_2');
        console.log(renderBriefReport({
          title: 'Status execute',
          decision: executionResult.interpretation.progressive_disclosure.default_view.state,
          affectedSurfaces: [`plan ${executionResult.execution_plan.kind}`, `${executionResult.execution_plan.worker_lanes.length} worker lane(s)`],
          blockers: executionResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 2),
          nextAction: executionResult.interpretation.progressive_disclosure.default_view.next_step.command ?? executionResult.interpretation.progressive_disclosure.default_view.next_step.label,
          sections: [{ heading: 'Why', items: [executionResult.interpretation.progressive_disclosure.default_view.why, `Wave 1 repos: ${wave1?.repos.length ?? 0}`, `Wave 2 repos: ${wave2?.repos.length ?? 0}`] }]
        }));
      }
      return ExitCode.Success;
    }

    if (options.scope === 'receipt') {
      const receiptResult = toReceiptStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(receiptResult, null, 2));
      } else {
        console.log(renderBriefReport({
          title: 'Status receipt',
          decision: receiptResult.interpretation.progressive_disclosure.default_view.state,
          affectedSurfaces: [`receipt ${receiptResult.receipt.kind}`, `${receiptResult.receipt.verification_summary.prompts_total} prompt outcome(s)`],
          blockers: receiptResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 2),
          nextAction: receiptResult.interpretation.progressive_disclosure.default_view.next_step.command ?? receiptResult.interpretation.progressive_disclosure.default_view.next_step.label,
          sections: [{ heading: 'Why', items: [receiptResult.interpretation.progressive_disclosure.default_view.why, `Succeeded: ${receiptResult.receipt.verification_summary.succeeded_count}`, `Failed/drifted: ${receiptResult.receipt.verification_summary.failed_count + receiptResult.receipt.verification_summary.mismatch_count}`] }]
        }));
      }
      return ExitCode.Success;
    }

    if (options.scope === 'proof') {
      const { result: proofResult, exitCode } = toProofStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(proofResult, null, 2));
      } else {
        console.log(renderBriefReport({
          title: 'Status proof',
          decision: proofResult.proof.summary.current_state,
          affectedSurfaces: [`failing stage ${proofResult.proof.diagnostics.failing_stage ?? 'none'}`],
          blockers: [proofResult.proof.diagnostics.failing_category ? `failing category: ${proofResult.proof.diagnostics.failing_category}` : null],
          nextAction: proofResult.proof.summary.what_next,
          sections: [{ heading: 'Why', items: [proofResult.proof.summary.why] }]
        }));
      }
      return exitCode;
    }

    if (options.scope === 'updated') {
      const { result: updatedResult, exitCode } = toUpdatedStateStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(updatedResult, null, 2));
      } else {
        console.log(renderBriefReport({
          title: 'Status updated',
          decision: updatedResult.interpretation.progressive_disclosure.default_view.state,
          affectedSurfaces: [`${updatedResult.updated_state.summary.repos_total} reconciled repo(s)`, `${updatedResult.next_queue.work_items.length} next-queue item(s)`],
          blockers: [updatedResult.promotion.promoted ? null : `promotion blocked: ${updatedResult.promotion.blocked_reason ?? 'validation failed'}`],
          nextAction: updatedResult.interpretation.progressive_disclosure.default_view.next_step.command ?? updatedResult.interpretation.progressive_disclosure.default_view.next_step.label,
          sections: [{ heading: 'Why', items: [updatedResult.interpretation.progressive_disclosure.default_view.why, `Needs retry: ${updatedResult.updated_state.summary.repos_needing_retry.length}`, `Needs review: ${updatedResult.updated_state.summary.repos_needing_review.length}`] }]
        }));
      }
      return exitCode;
    }

    const { result, exitCode, topIssue, repoRoot } = await toStatusResult(cwd);

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return exitCode;
    }

    if (!(options.quiet && result.ok)) {
      const repoIndexSummary = readRepoIndexSummary(repoRoot);
      printHuman(result, options.ci, repoIndexSummary, topIssue);
    }

    return exitCode;
  } catch (error) {
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'status', ok: false, error: String(error) }, null, 2));
    } else {
      console.error('playbook status failed with an internal error.');
      console.error(String(error));
    }
    return ExitCode.Failure;
  }
};
