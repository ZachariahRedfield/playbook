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
  defaultExecutionOutcomeInput,
  deriveNextAdoptionQueueFromUpdatedState,
  buildRepoAdoptionReadiness,
  normalizeExecutionOutcomeInput,
  type FleetAdoptionWorkQueue,
  type FleetCodexExecutionPlan,
  type FleetAdoptionReadinessSummary,
  type FleetExecutionOutcomeInput,
  type FleetExecutionReceipt,
  type FleetUpdatedAdoptionState,
  type RepoAdoptionReadiness
} from '@zachariahredfield/playbook-engine';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AnalyzeReport } from './analyze.js';
import type { VerifyReport } from './verify.js';

type StatusOptions = {
  ci: boolean;
  format: 'text' | 'json';
  quiet: boolean;
  scope?: 'repo' | 'fleet' | 'queue' | 'execute' | 'receipt' | 'updated';
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
  promotion: WorkflowPromotionStatus;
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

export const EXECUTION_OUTCOME_INPUT_RELATIVE_PATH = path.join('.playbook', 'execution-outcome-input.json');
const UPDATED_STATE_RELATIVE_PATH = path.join('.playbook', 'execution-updated-state.json');
const UPDATED_STATE_STAGING_RELATIVE_PATH = path.join('.playbook', 'staged', 'workflow-status-updated', 'execution-updated-state.json');

export const readExecutionOutcomeInput = (cwd: string): FleetExecutionOutcomeInput => {
  const targetPath = path.join(cwd, EXECUTION_OUTCOME_INPUT_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    return defaultExecutionOutcomeInput();
  }

  return normalizeExecutionOutcomeInput(JSON.parse(fs.readFileSync(targetPath, 'utf8')) as FleetExecutionOutcomeInput);
};

export const writeExecutionOutcomeInput = (cwd: string, outcomeInput: FleetExecutionOutcomeInput): string => {
  const targetPath = path.join(cwd, EXECUTION_OUTCOME_INPUT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(normalizeExecutionOutcomeInput(outcomeInput), null, 2)}\n`);
  return targetPath;
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

export const toFleetStatusResult = (cwd: string): StatusFleetResult => {
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

export const toQueueStatusResult = (cwd: string): StatusQueueResult => {
  const fleet = toFleetStatusResult(cwd).fleet;
  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'queue',
    queue: buildFleetAdoptionWorkQueue(fleet)
  };
};

export const toExecutionStatusResult = (cwd: string): StatusExecutionResult => {
  const queue = toQueueStatusResult(cwd).queue;
  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'execute',
    execution_plan: buildFleetCodexExecutionPlan(queue)
  };
};

export const computeReceipt = (cwd: string): { fleet: FleetAdoptionReadinessSummary; queue: FleetAdoptionWorkQueue; executionPlan: FleetCodexExecutionPlan; receipt: FleetExecutionReceipt } => {
  const fleet = toFleetStatusResult(cwd).fleet;
  const queue = buildFleetAdoptionWorkQueue(fleet);
  const executionPlan = buildFleetCodexExecutionPlan(queue);
  const receipt = buildFleetExecutionReceipt(executionPlan, queue, fleet, readExecutionOutcomeInput(cwd));
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
