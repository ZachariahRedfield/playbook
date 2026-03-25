import { collectAnalyzeReport, ensureRepoIndex } from './analyze.js';
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
  readProofParallelWorkSummary,
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
import { renderBriefOutput } from '../lib/briefOutput.js';

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
  parallel_work: ReturnType<typeof readProofParallelWorkSummary>;
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

const isArtifactValid = (artifact: RepoAdoptionReadiness['governed_artifacts_present'][keyof RepoAdoptionReadiness['governed_artifacts_present']]): boolean =>
  artifact.present && artifact.valid && !artifact.stale;

const isLifecycleReadyEnvironment = (adoption: RepoAdoptionReadiness): boolean =>
  adoption.lifecycle_stage === 'ready'
  && adoption.blockers.length === 0
  && isArtifactValid(adoption.governed_artifacts_present.plan)
  && isArtifactValid(adoption.governed_artifacts_present.policy_apply_result);

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
  const analyze = await collectAnalyzeReport(cwd);
  const verify = await collectVerifyReport(cwd);
  await ensureRepoIndex(analyze.repoPath);

  const warnings = analyze.recommendations.filter((rec: { severity: string }) => rec.severity === 'WARN').length;
  const errors = 0;

  const adoption = buildRepoAdoptionReadiness({ repoRoot: analyze.repoPath, connected: true });
  const environmentOk = isLifecycleReadyEnvironment(adoption);
  const statusOk = environmentOk && verify.ok;

  const result: StatusResult = {
    schemaVersion: '1.0',
    command: 'status',
    ok: statusOk,
    environment: { ok: environmentOk },
    analysis: { warnings, errors },
    verification: { ok: verify.ok },
    summary: { warnings, errors },
    adoption,
    interpretation: buildRepoStatusInterpretation({
      ok: statusOk,
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
  const parallelWork = readProofParallelWorkSummary(cwd);
  return {
    result: {
      schemaVersion: '1.0',
      command: 'status',
      mode: 'proof',
      proof,
      parallel_work: parallelWork,
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
    console.log(result.ok ? 'playbook status: PASS' : 'playbook status: FAIL');
    return;
  }

  console.log(renderBriefOutput({
    title: 'Status',
    decision: result.ok ? 'healthy' : 'attention_required',
    status: result.interpretation.progressive_disclosure.default_view.state,
    why: result.interpretation.progressive_disclosure.default_view.why,
    affectedSurfaces: [
      `analysis warnings=${result.analysis.warnings}`,
      `verification=${result.verification.ok ? 'ok' : 'failed'}`,
      `lifecycle=${result.adoption.lifecycle_stage}`,
      repoIndexSummary ? `framework=${repoIndexSummary.framework}` : ''
    ].filter(Boolean),
    blockers: [
      ...result.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 3),
      topIssue ? `${topIssue.id}: ${topIssue.description}` : ''
    ].filter(Boolean),
    nextAction: result.interpretation.progressive_disclosure.default_view.next_step.command
      ?? result.interpretation.progressive_disclosure.default_view.next_step.label,
    artifactRefs: ['.playbook/repo-index.json', '.playbook/repo-graph.json', '.playbook/plan.json'],
    extraSections: [{
      label: 'Operator highlights',
      items: [
        `Environment: ${result.environment.ok ? 'ok' : 'failed'}`,
        `Playbook detected: ${result.adoption.playbook_detected ? 'yes' : 'no'}`,
        `Cross-repo eligible: ${result.adoption.cross_repo_eligible ? 'yes' : 'no'}`
      ]
    }]
  }));
};

export const runStatus = async (cwd: string, options: StatusOptions): Promise<number> => {
  try {
    if (options.scope === 'queue') {
      const queueResult = toQueueStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(queueResult, null, 2));
      } else {
        console.log(renderBriefOutput({
          title: 'Status queue',
          decision: queueResult.queue.work_items.length > 0 ? 'queue_ready' : 'queue_empty',
          status: queueResult.interpretation.progressive_disclosure.default_view.state,
          why: queueResult.interpretation.progressive_disclosure.default_view.why,
          affectedSurfaces: [
            `${queueResult.queue.total_repos} repo(s)`,
            `wave_1=${queueResult.queue.waves[0]?.action_count ?? 0}`,
            `top lane=${queueResult.queue.grouped_actions[0]?.parallel_group ?? 'n/a'}`
          ],
          blockers: queueResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 3),
          nextAction: queueResult.interpretation.progressive_disclosure.default_view.next_step.command ?? queueResult.interpretation.progressive_disclosure.default_view.next_step.label
        }));
      }
      return ExitCode.Success;
    }

    if (options.scope === 'fleet') {
      const fleetResult = toFleetStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(fleetResult, null, 2));
      } else {
        console.log(renderBriefOutput({
          title: 'Status fleet',
          decision: fleetResult.fleet.total_repos > 0 ? 'fleet_observed' : 'fleet_empty',
          status: fleetResult.interpretation.progressive_disclosure.default_view.state,
          why: fleetResult.interpretation.progressive_disclosure.default_view.why,
          affectedSurfaces: [
            `${fleetResult.fleet.total_repos} repo(s)`,
            `ready=${fleetResult.fleet.by_lifecycle_stage.ready}`,
            `cross_repo_eligible=${fleetResult.fleet.cross_repo_eligible_count}`
          ],
          blockers: fleetResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 3),
          nextAction: fleetResult.interpretation.progressive_disclosure.default_view.next_step.command ?? fleetResult.interpretation.progressive_disclosure.default_view.next_step.label
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
        console.log(renderBriefOutput({
          title: 'Status execute',
          decision: executionResult.execution_plan.codex_prompts.length > 0 ? 'execution_packaged' : 'execution_idle',
          status: executionResult.interpretation.progressive_disclosure.default_view.state,
          why: executionResult.interpretation.progressive_disclosure.default_view.why,
          affectedSurfaces: [
            `kind=${executionResult.execution_plan.kind}`,
            `wave_1 repos=${wave1?.repos.length ?? 0}`,
            `wave_2 repos=${wave2?.repos.length ?? 0}`,
            `worker lanes=${executionResult.execution_plan.worker_lanes.length}`
          ],
          blockers: executionResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 3),
          nextAction: executionResult.interpretation.progressive_disclosure.default_view.next_step.command ?? executionResult.interpretation.progressive_disclosure.default_view.next_step.label
        }));
      }
      return ExitCode.Success;
    }

    if (options.scope === 'receipt') {
      const receiptResult = toReceiptStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(receiptResult, null, 2));
      } else {
        console.log(renderBriefOutput({
          title: 'Status receipt',
          decision: receiptResult.receipt.verification_summary.failed_count > 0 || receiptResult.receipt.verification_summary.mismatch_count > 0
            ? 'follow_up_required'
            : 'receipt_clean',
          status: receiptResult.interpretation.progressive_disclosure.default_view.state,
          why: receiptResult.interpretation.progressive_disclosure.default_view.why,
          affectedSurfaces: [
            `prompts=${receiptResult.receipt.verification_summary.prompts_total}`,
            `succeeded=${receiptResult.receipt.verification_summary.succeeded_count}`,
            `failed=${receiptResult.receipt.verification_summary.failed_count}`,
            `drift=${receiptResult.receipt.verification_summary.mismatch_count}`
          ],
          blockers: receiptResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 3),
          nextAction: receiptResult.interpretation.progressive_disclosure.default_view.next_step.command ?? receiptResult.interpretation.progressive_disclosure.default_view.next_step.label
        }));
      }
      return ExitCode.Success;
    }

    if (options.scope === 'proof') {
      const { result: proofResult, exitCode } = toProofStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(proofResult, null, 2));
      } else {
        console.log(renderBriefOutput({
          title: 'Status proof',
          decision: proofResult.parallel_work.decision,
          status: proofResult.parallel_work.status,
          affectedSurfaces: proofResult.parallel_work.affected_surfaces,
          blockers: proofResult.parallel_work.blockers,
          nextAction: proofResult.parallel_work.next_action,
          extraSections: [{
            label: 'Counts',
            items: [
              `pending=${proofResult.parallel_work.counts.pending}`,
              `blocked=${proofResult.parallel_work.counts.blocked}`,
              `plan_ready=${proofResult.parallel_work.counts.plan_ready}`,
              `guard_conflicted=${proofResult.parallel_work.counts.guard_conflicted}`,
              `merge_ready=${proofResult.parallel_work.counts.merge_ready}`
            ]
          }]
        }));
      }
      return exitCode;
    }

    if (options.scope === 'updated') {
      const { result: updatedResult, exitCode } = toUpdatedStateStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(updatedResult, null, 2));
      } else {
        console.log(renderBriefOutput({
          title: 'Status updated',
          decision: updatedResult.promotion.promoted ? 'updated_state_promoted' : 'updated_state_blocked',
          status: updatedResult.interpretation.progressive_disclosure.default_view.state,
          why: updatedResult.interpretation.progressive_disclosure.default_view.why,
          affectedSurfaces: [
            `repos=${updatedResult.updated_state.summary.repos_total}`,
            `next queue=${updatedResult.next_queue.work_items.length}`,
            `promotion=${updatedResult.promotion.promoted ? 'promoted' : 'blocked'}`
          ],
          blockers: [
            ...updatedResult.interpretation.progressive_disclosure.secondary_view.blockers.slice(0, 3),
            updatedResult.promotion.promoted ? '' : (updatedResult.promotion.blocked_reason ?? '')
          ].filter(Boolean),
          nextAction: updatedResult.interpretation.progressive_disclosure.default_view.next_step.command ?? updatedResult.interpretation.progressive_disclosure.default_view.next_step.label,
          artifactRefs: [updatedResult.promotion.staged_artifact_path, updatedResult.promotion.committed_target_path].filter(Boolean)
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
