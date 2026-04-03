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
  classifyProofFailureDomains,
  readProofParallelWorkSummary,
  defaultBootstrapCliResolutionCommands,
  type BootstrapCliResolutionCommand,
  type FailureDomainSummary,
  type FleetAdoptionWorkQueue,
  type FleetCodexExecutionPlan,
  type FleetAdoptionReadinessSummary,
  type FleetExecutionOutcomeInput,
  type FleetExecutionReceipt,
  type FleetUpdatedAdoptionState,
  type RepoAdoptionReadiness,
  buildMemoryPressureStatusArtifact,
  loadConfig,
  listOrchestrationExecutionRuns,
  readSession
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
  proofPolicy?: ProofPolicy;
};

type ProofPolicy = 'report' | 'enforce';

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
  memory_pressure: {
    artifact_path: string;
    score: number;
    band: string;
    hysteresis_thresholds: {
      warm: number;
      pressure: number;
      critical: number;
      hysteresis: number;
    };
    usage: {
      usedBytes: number;
      fileCount: number;
      eventCount: number;
    };
    recommended_actions: string[];
    action_plan: MemoryPressurePlanSummary;
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
  failureDomains: FailureDomainSummary['failureDomains'];
  primaryFailureDomain: FailureDomainSummary['primaryFailureDomain'];
  domainBlockers: FailureDomainSummary['domainBlockers'];
  domainNextActions: FailureDomainSummary['domainNextActions'];
  continuity: {
    active_session_ref: string | null;
    pinned_evidence_refs: string[];
    latest_run_id: string | null;
    latest_receipt_refs: string[];
    stale_or_missing_state: string[];
  };
  interpretation: InterpretationLayer;
};

type SessionLike = {
  selectedRunId: string | null;
  lastUpdatedTime: string;
  pinnedArtifacts: Array<{ artifact: string }>;
  evidenceEnvelope: { artifacts: Array<{ present: boolean }> };
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

type MemoryPressureBand = 'normal' | 'warm' | 'pressure' | 'critical';
type MemoryPressurePlanStepAction = 'dedupe' | 'compact' | 'summarize' | 'evict';

type MemoryPressurePlanSummary = {
  artifact_path: string;
  current_band: MemoryPressureBand;
  highest_priority_recommended_actions: string[];
  counts_by_action_type: Record<MemoryPressurePlanStepAction, number>;
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

const summarizeMemoryPressurePlan = (repoRoot: string, band: MemoryPressureBand): MemoryPressurePlanSummary => {
  const artifactPath = '.playbook/memory-pressure-plan.json';
  const zeroCounts: Record<MemoryPressurePlanStepAction, number> = { dedupe: 0, compact: 0, summarize: 0, evict: 0 };

  if (band === 'normal') {
    return {
      artifact_path: artifactPath,
      current_band: band,
      highest_priority_recommended_actions: [],
      counts_by_action_type: zeroCounts
    };
  }

  const absolutePath = path.join(repoRoot, artifactPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      artifact_path: artifactPath,
      current_band: band,
      highest_priority_recommended_actions: [],
      counts_by_action_type: zeroCounts
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as {
      recommendedByBand?: Partial<Record<Exclude<MemoryPressureBand, 'normal'>, Array<{ action?: MemoryPressurePlanStepAction }>>>;
    };
    const steps = parsed.recommendedByBand?.[band as Exclude<MemoryPressureBand, 'normal'>] ?? [];
    const counts = steps.reduce<Record<MemoryPressurePlanStepAction, number>>(
      (summary, step) => {
        if (!step.action) return summary;
        summary[step.action] += 1;
        return summary;
      },
      { ...zeroCounts }
    );

    return {
      artifact_path: artifactPath,
      current_band: band,
      highest_priority_recommended_actions: steps.slice(0, 2).flatMap((step) => (step.action ? [step.action] : [])),
      counts_by_action_type: counts
    };
  } catch {
    return {
      artifact_path: artifactPath,
      current_band: band,
      highest_priority_recommended_actions: [],
      counts_by_action_type: zeroCounts
    };
  }
};

const readMemoryPressureStatus = async (repoRoot: string): Promise<StatusResult['memory_pressure']> => {
  const { config } = await Promise.resolve(loadConfig(repoRoot));
  const pressure = buildMemoryPressureStatusArtifact({
    repoRoot,
    policy: config.memory.pressurePolicy
  });
  return {
    artifact_path: '.playbook/memory-pressure.json',
    score: pressure.score.normalized,
    band: pressure.band,
    hysteresis_thresholds: {
      warm: pressure.policy.watermarks.warm,
      pressure: pressure.policy.watermarks.pressure,
      critical: pressure.policy.watermarks.critical,
      hysteresis: pressure.policy.hysteresis
    },
    usage: pressure.usage,
    recommended_actions: pressure.recommendedActions,
    action_plan: summarizeMemoryPressurePlan(repoRoot, pressure.band)
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

  const adoption = buildRepoAdoptionReadiness({ repoRoot: analyze.repoPath, connected: true });
  const lifecycleReady = adoption.lifecycle_stage === 'ready' && adoption.blockers.length === 0;
  const hasBlockingEnvironmentFailure = doctor.status === 'error' && !lifecycleReady;
  const repoOk = verify.ok && !hasBlockingEnvironmentFailure;

  const result: StatusResult = {
    schemaVersion: '1.0',
    command: 'status',
    ok: repoOk,
    environment: { ok: !hasBlockingEnvironmentFailure },
    analysis: { warnings, errors },
    verification: { ok: verify.ok },
    summary: { warnings, errors },
    memory_pressure: await readMemoryPressureStatus(analyze.repoPath),
    adoption,
    interpretation: buildRepoStatusInterpretation({
      ok: repoOk,
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

const toTimeMs = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const readContinuitySummary = (cwd: string): StatusProofResult['continuity'] => {
  const session = readSession(cwd) as SessionLike | null;
  const runs = listOrchestrationExecutionRuns(cwd);
  const latestRun = [...runs].sort((left, right) => {
    const timeDelta = toTimeMs(right.updated_at) - toTimeMs(left.updated_at);
    return timeDelta !== 0 ? timeDelta : right.run_id.localeCompare(left.run_id);
  })[0];
  const latestReceiptRefs = latestRun
    ? Array.from(new Set((Object.values(latestRun.lanes) as Array<{ receipt_refs: string[] }>).flatMap((lane) => lane.receipt_refs))).sort((left, right) => left.localeCompare(right))
    : [];

  const staleOrMissingState: string[] = [];
  if (!session) {
    staleOrMissingState.push('session_missing');
  } else {
    if (session.selectedRunId && !runs.some((run: { run_id: string }) => run.run_id === session.selectedRunId)) {
      staleOrMissingState.push('selected_run_missing');
    }
    if (session.selectedRunId && latestRun && latestRun.run_id !== session.selectedRunId) {
      staleOrMissingState.push('selected_run_not_latest');
    }
    if (latestRun && toTimeMs(latestRun.updated_at) > toTimeMs(session.lastUpdatedTime)) {
      staleOrMissingState.push('session_older_than_latest_run');
    }
    if (session.evidenceEnvelope.artifacts.some((artifact: { present: boolean }) => !artifact.present)) {
      staleOrMissingState.push('session_evidence_missing_artifacts');
    }
  }
  if (latestRun && latestReceiptRefs.length === 0) {
    staleOrMissingState.push('latest_run_missing_receipts');
  }

  return {
    active_session_ref: session ? '.playbook/session.json' : null,
    pinned_evidence_refs: session ? session.pinnedArtifacts.map((entry: { artifact: string }) => entry.artifact).sort((left, right) => left.localeCompare(right)) : [],
    latest_run_id: latestRun?.run_id ?? null,
    latest_receipt_refs: latestReceiptRefs,
    stale_or_missing_state: staleOrMissingState
  };
};

const buildProofStatusResult = (cwd: string): StatusProofResult => {
  const proof = runBootstrapProof(cwd, { cliResolutionCommands: bootstrapCliResolutionCommands() });
  const parallelWork = readProofParallelWorkSummary(cwd);
  const failureDomainSummary = classifyProofFailureDomains(proof, parallelWork);
  const continuity = readContinuitySummary(cwd);
  return {
    schemaVersion: '1.0',
    command: 'status',
    mode: 'proof',
    proof,
    parallel_work: parallelWork,
    failureDomains: failureDomainSummary.failureDomains,
    primaryFailureDomain: failureDomainSummary.primaryFailureDomain,
    domainBlockers: failureDomainSummary.domainBlockers,
    domainNextActions: failureDomainSummary.domainNextActions,
    continuity,
    interpretation: buildProofInterpretation(proof)
  };
};

const hasRenderableProofContract = (result: StatusProofResult): boolean =>
  typeof result.proof.current_state === 'string' &&
  result.proof.current_state.trim().length > 0 &&
  typeof result.parallel_work.status === 'string' &&
  result.parallel_work.status.trim().length > 0;

const resolveProofExitCode = (result: StatusProofResult, proofPolicy: ProofPolicy): ExitCode => {
  if (proofPolicy === 'enforce') {
    return result.proof.ok ? ExitCode.Success : ExitCode.Failure;
  }
  return hasRenderableProofContract(result) ? ExitCode.Success : ExitCode.Failure;
};

const resolveProofPolicy = (options: StatusOptions): ProofPolicy => options.proofPolicy ?? 'report';

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
      repoIndexSummary ? `framework=${repoIndexSummary.framework}` : '',
      `memory=${result.memory_pressure.band}@${result.memory_pressure.score.toFixed(2)}`
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
        `Cross-repo eligible: ${result.adoption.cross_repo_eligible ? 'yes' : 'no'}`,
        `Memory usage: ${result.memory_pressure.usage.usedBytes}B / ${result.memory_pressure.usage.fileCount} file(s) / ${result.memory_pressure.usage.eventCount} event(s)`,
        `Memory action: ${result.memory_pressure.recommended_actions[0] ?? 'none'}`,
        `Memory plan: band=${result.memory_pressure.action_plan.current_band} top=${result.memory_pressure.action_plan.highest_priority_recommended_actions.join(',') || 'none'} counts=${Object.entries(result.memory_pressure.action_plan.counts_by_action_type).map(([action, count]) => `${action}:${count}`).join(',')}`
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
      const proofResult = buildProofStatusResult(cwd);
      if (options.format === 'json') {
        console.log(JSON.stringify(proofResult, null, 2));
      } else {
        console.log(renderBriefOutput({
          title: 'Status proof',
          decision: proofResult.parallel_work.decision,
          status: proofResult.parallel_work.status,
          affectedSurfaces: proofResult.parallel_work.affected_surfaces,
          blockers: proofResult.domainBlockers.slice(0, 2).map((entry: { domain: string; summary: string }) => `${entry.domain}: ${entry.summary}`),
          nextAction: proofResult.domainNextActions[0]?.action ?? proofResult.parallel_work.next_action,
          extraSections: [{
            label: 'Counts',
            items: [
              `pending=${proofResult.parallel_work.counts.pending}`,
              `blocked=${proofResult.parallel_work.counts.blocked}`,
              `plan_ready=${proofResult.parallel_work.counts.plan_ready}`,
              `guard_conflicted=${proofResult.parallel_work.counts.guard_conflicted}`,
              `merge_ready=${proofResult.parallel_work.counts.merge_ready}`
            ]
          }, {
            label: 'Scope',
            items: [
              `present=${proofResult.parallel_work.scope.present}`,
              `missing=${proofResult.parallel_work.scope.missing}`,
              `violated=${proofResult.parallel_work.scope.violated}`,
              `clean=${proofResult.parallel_work.scope.clean}`,
              `budget=${proofResult.parallel_work.scope.budget_status}`,
              `violated_files=${proofResult.parallel_work.scope.violated_files.join(',') || 'none'}`
            ]
          }, {
            label: 'Failure ownership',
            items: [
              `primary=${proofResult.primaryFailureDomain ?? 'none'}`,
              `domains=${proofResult.failureDomains.join(',') || 'none'}`
            ]
          }, {
            label: 'Continuity',
            items: [
              `session=${proofResult.continuity.active_session_ref ?? 'none'}`,
              `pinned_refs=${proofResult.continuity.pinned_evidence_refs.length}`,
              `latest_run=${proofResult.continuity.latest_run_id ?? 'none'}`,
              `latest_receipts=${proofResult.continuity.latest_receipt_refs.length}`,
              `stale=${proofResult.continuity.stale_or_missing_state.join(',') || 'none'}`
            ]
          }]
        }));
      }
      const proofPolicy = resolveProofPolicy(options);
      return resolveProofExitCode(proofResult, proofPolicy);
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
