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
};

type StatusFleetResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'fleet';
  fleet: FleetAdoptionReadinessSummary;
};

type StatusQueueResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'queue';
  queue: FleetAdoptionWorkQueue;
};


type StatusExecutionResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'execute';
  execution_plan: FleetCodexExecutionPlan;
};

type StatusReceiptResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'receipt';
  receipt: FleetExecutionReceipt;
};


type StatusUpdatedStateResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'updated';
  updated_state: FleetUpdatedAdoptionState;
  next_queue: FleetAdoptionWorkQueue;
  promotion: WorkflowPromotion;
};


type StatusProofResult = {
  schemaVersion: '1.0';
  command: 'status';
  mode: 'proof';
  proof: ReturnType<typeof runBootstrapProof>;
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

  const result: StatusResult = {
    schemaVersion: '1.0',
    command: 'status',
    ok: doctor.status !== 'error' && verify.ok,
    environment: { ok: environmentOk },
    analysis: { warnings, errors },
    verification: { ok: verify.ok },
    summary: { warnings, errors },
    adoption: buildRepoAdoptionReadiness({ repoRoot: analyze.repoPath, connected: true })
  };

  const exitCode = verify.ok ? ExitCode.Success : ExitCode.PolicyFailure;

  return { result, exitCode, topIssue: await resolveTopIssue(cwd, verify, analyze), repoRoot: analyze.repoPath };
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
    fleet
  };
};

const toQueueStatusResult = (cwd: string): StatusQueueResult => {
  const fleet = toFleetStatusResult(cwd).fleet;
  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'queue',
    queue: buildFleetAdoptionWorkQueue(fleet)
  };
};


const toExecutionStatusResult = (cwd: string): StatusExecutionResult => {
  const queue = toQueueStatusResult(cwd).queue;
  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'execute',
    execution_plan: buildFleetCodexExecutionPlan(queue)
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
    receipt
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
      proof
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
      promotion
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

  console.log('Environment');
  console.log(result.environment.ok ? '  ✔ ok' : '  ✖ failed');

  if (repoIndexSummary) {
    console.log('');
    console.log('Project summary');
    console.log('────────────────');
    console.log('');
    console.log(`Framework: ${repoIndexSummary.framework}`);
    console.log(`Modules: ${repoIndexSummary.modules.length > 0 ? repoIndexSummary.modules.join(', ') : '-'}`);
    console.log(`Docs: ${repoIndexSummary.docs.length > 0 ? repoIndexSummary.docs.join(', ') : '-'}`);
    console.log(`Playbook rules: ${repoIndexSummary.rules.length}`);
  }

  console.log('');
  console.log('Repository Analysis');
  console.log(`  Warnings: ${result.analysis.warnings}`);
  console.log(`  Errors: ${result.analysis.errors}`);
  console.log('');
  console.log('Policy Verification');
  console.log(result.verification.ok ? '  ✔ ok' : '  ✖ failed');
  console.log('');
  console.log('Summary');
  console.log(`  Overall: ${result.ok ? 'healthy' : 'issues detected'}`);
  console.log(`  Warnings: ${result.summary.warnings}`);
  console.log(`  Errors: ${result.summary.errors}`);

  console.log('');
  console.log('Adoption readiness');
  console.log(`  Connection: ${result.adoption.connection_status}`);
  console.log(`  Playbook detected: ${result.adoption.playbook_detected ? 'yes' : 'no'}`);
  console.log(`  Lifecycle stage: ${result.adoption.lifecycle_stage}`);
  console.log(`  Fallback proof ready: ${result.adoption.fallback_proof_ready ? 'yes' : 'no'}`);
  console.log(`  Cross-repo eligible: ${result.adoption.cross_repo_eligible ? 'yes' : 'no'}`);
  if (result.adoption.blockers.length > 0) {
    console.log(`  Blockers: ${result.adoption.blockers.map((blocker: { code: string }) => blocker.code).join(', ')}`);
    console.log(`  Next command: ${result.adoption.recommended_next_steps[0] ?? 'n/a'}`);
  }

  if (topIssue) {
    console.log('');
    console.log('Top issue');
    console.log('─────────');
    console.log(`${topIssue.id} – ${topIssue.description}`);
    console.log('');
    console.log('Run:');
    console.log(`pnpm playbook explain ${topIssue.id}`);
  }
};

export const runStatus = async (cwd: string, options: StatusOptions): Promise<number> => {
  try {
    if (options.scope === 'queue') {
      const queueResult = toQueueStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(queueResult, null, 2));
      } else {
        console.log(`Queue repos: ${queueResult.queue.total_repos}`);
        console.log(`Wave 1 actions: ${queueResult.queue.waves[0]?.action_count ?? 0}`);
        console.log(`Wave 2 actions: ${queueResult.queue.waves[1]?.action_count ?? 0}`);
        console.log(`Top lane: ${queueResult.queue.grouped_actions[0]?.parallel_group ?? 'n/a'}`);
      }
      return ExitCode.Success;
    }

    if (options.scope === 'fleet') {
      const fleetResult = toFleetStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(fleetResult, null, 2));
      } else {
        console.log(`Fleet repos: ${fleetResult.fleet.total_repos}`);
        console.log(`By stage: ${JSON.stringify(fleetResult.fleet.by_lifecycle_stage)}`);
        console.log(`Top action: ${fleetResult.fleet.recommended_actions[0]?.command ?? 'n/a'}`);
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
        console.log(`Execution plan kind: ${executionResult.execution_plan.kind}`);
        console.log(`Wave 1 repos: ${wave1?.repos.length ?? 0}`);
        console.log(`Wave 2 repos: ${wave2?.repos.length ?? 0}`);
        console.log(`Worker lanes: ${executionResult.execution_plan.worker_lanes.length}`);
        console.log(`Top prompt: ${executionResult.execution_plan.codex_prompts[0]?.prompt_id ?? 'n/a'}`);
      }
      return ExitCode.Success;
    }

    if (options.scope === 'receipt') {
      const receiptResult = toReceiptStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(receiptResult, null, 2));
      } else {
        console.log(`Execution receipt kind: ${receiptResult.receipt.kind}`);
        console.log(`Prompts total: ${receiptResult.receipt.verification_summary.prompts_total}`);
        console.log(`Succeeded: ${receiptResult.receipt.verification_summary.succeeded_count}`);
        console.log(`Failed: ${receiptResult.receipt.verification_summary.failed_count}`);
        console.log(`Partial: ${receiptResult.receipt.verification_summary.partial_count}`);
        console.log(`Drift: ${receiptResult.receipt.verification_summary.mismatch_count}`);
      }
      return ExitCode.Success;
    }

    if (options.scope === 'proof') {
      const { result: proofResult, exitCode } = toProofStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(proofResult, null, 2));
      } else {
        console.log('Current state');
        console.log(proofResult.proof.summary.current_state);
        console.log('');
        console.log('Why');
        console.log(proofResult.proof.summary.why);
        console.log('');
        console.log('What next');
        console.log(proofResult.proof.summary.what_next);
        console.log('');
        console.log(`Failing stage: ${proofResult.proof.diagnostics.failing_stage ?? 'none'}`);
        console.log(`Failing category: ${proofResult.proof.diagnostics.failing_category ?? 'none'}`);
      }
      return exitCode;
    }

    if (options.scope === 'updated') {
      const { result: updatedResult, exitCode } = toUpdatedStateStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(updatedResult, null, 2));
      } else {
        console.log(`Updated state kind: ${updatedResult.updated_state.kind}`);
        console.log(`Repos total: ${updatedResult.updated_state.summary.repos_total}`);
        console.log(`Observed outcomes: ${JSON.stringify(updatedResult.updated_state.summary.by_reconciliation_status)}`);
        console.log(`Action counts: ${JSON.stringify(updatedResult.updated_state.summary.action_counts)}`);
        console.log(`Needs retry: ${updatedResult.updated_state.summary.repos_needing_retry.length}`);
        console.log(`Needs replan: ${updatedResult.updated_state.summary.repos_needing_replan.length}`);
        console.log(`Needs review: ${updatedResult.updated_state.summary.repos_needing_review.length}`);
        console.log(`Next queue items: ${updatedResult.next_queue.work_items.length}`);
        console.log(`Promotion: ${updatedResult.promotion.promoted ? 'promoted' : `blocked (${updatedResult.promotion.blocked_reason ?? 'validation failed'})`}`);
        console.log(`Staged artifact: ${updatedResult.promotion.staged_artifact_path}`);
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
