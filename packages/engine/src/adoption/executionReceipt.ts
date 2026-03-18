import { createHash } from 'node:crypto';
import type { FleetAdoptionReadinessSummary } from './fleetReadiness.js';
import type { FleetCodexExecutionPlan, CodexExecutionPrompt, ExecutionPlanWaveId } from './executionPlan.js';
import type { FleetAdoptionWorkQueue, AdoptionWorkItem } from './workQueue.js';
import type { ReadinessLifecycleStage } from './readiness.js';

export type ExecutionObservedStatus = 'succeeded' | 'failed' | 'partial' | 'not_run';
export type ExecutionComparisonStatus = 'success' | 'failed' | 'partial_success' | 'mismatch' | 'not_run';
export type ArtifactDeltaChangeType = 'created' | 'updated' | 'unchanged' | 'missing' | 'invalid';

export type ExecutionArtifactEvidence = {
  artifact_kind: 'repo-index' | 'repo-graph' | 'plan' | 'policy-apply-result';
  artifact_path: string;
  change_type: ArtifactDeltaChangeType;
  evidence: string;
};

export type ExecutionBlocker = {
  blocker_code: string;
  scope: 'fleet' | 'wave' | 'prompt' | 'repo';
  repo_id?: string;
  prompt_id?: string;
  wave_id?: ExecutionPlanWaveId;
  message: string;
  evidence: string;
};

export type ExecutionPromptOutcomeInput = {
  prompt_id: string;
  repo_id: string;
  lane_id: string;
  status: ExecutionObservedStatus;
  verification_passed?: boolean | null;
  notes?: string;
  observed_transition?: LifecycleTransition;
  blockers?: Array<{ blocker_code: string; message: string; evidence?: string }>;
  artifact_deltas?: ExecutionArtifactEvidence[];
};

export type FleetExecutionOutcomeInput = {
  schemaVersion: '1.0';
  kind: 'fleet-adoption-execution-outcome-input';
  generated_at: string;
  session_id: string;
  prompt_outcomes: ExecutionPromptOutcomeInput[];
};

export type LifecycleTransition = {
  from: ReadinessLifecycleStage;
  to: ReadinessLifecycleStage;
};

export type ExecutionPromptResult = {
  prompt_id: string;
  repo_id: string;
  lane_id: string;
  wave_id: ExecutionPlanWaveId;
  intended_transition: LifecycleTransition;
  observed_transition: LifecycleTransition;
  status: ExecutionComparisonStatus;
  verification_passed: boolean;
  notes: string;
  evidence: string[];
};

export type ExecutionWaveResult = {
  wave_id: ExecutionPlanWaveId;
  status: 'succeeded' | 'failed' | 'partial' | 'not_run';
  completed_prompts: string[];
  failed_prompts: string[];
  partial_prompts: string[];
  repos_needing_retry: string[];
  planned_vs_actual_drift: string[];
};

export type ExecutionRepoResult = {
  repo_id: string;
  planned_transition: LifecycleTransition | null;
  observed_transition: LifecycleTransition;
  status: ExecutionComparisonStatus;
  prompts: string[];
  blockers: string[];
  retry_recommended: boolean;
};

export type ExecutionVerificationSummary = {
  prompts_total: number;
  verification_passed_count: number;
  succeeded_count: number;
  failed_count: number;
  partial_count: number;
  mismatch_count: number;
  not_run_count: number;
  repos_needing_retry: string[];
  planned_vs_actual_drift: Array<{ prompt_id: string; repo_id: string; expected: ReadinessLifecycleStage; observed: ReadinessLifecycleStage }>;
};

export type FleetExecutionReceipt = {
  schemaVersion: '1.0';
  kind: 'fleet-adoption-execution-receipt';
  generated_at: string;
  execution_plan_digest: string;
  session_id: string;
  wave_results: ExecutionWaveResult[];
  prompt_results: ExecutionPromptResult[];
  repo_results: ExecutionRepoResult[];
  artifact_deltas: ExecutionArtifactEvidence[];
  blockers: ExecutionBlocker[];
  verification_summary: ExecutionVerificationSummary;
};

const stablePlanDigest = (plan: FleetCodexExecutionPlan): string => createHash('sha256').update(JSON.stringify({ ...plan, generated_at: '__stable__' })).digest('hex');

const NEXT_STAGE_BY_GROUP: Record<string, ReadinessLifecycleStage> = {
  'connect lane': 'playbook_not_detected',
  'init lane': 'playbook_detected_index_pending',
  'index lane': 'indexed_plan_pending',
  'verify/plan lane': 'planned_apply_pending',
  'apply lane': 'ready'
};

const ARTIFACT_PATHS: Record<ExecutionArtifactEvidence['artifact_kind'], string> = {
  'repo-index': '.playbook/repo-index.json',
  'repo-graph': '.playbook/repo-graph.json',
  plan: '.playbook/plan.json',
  'policy-apply-result': '.playbook/policy-apply-result.json'
};

const artifactEvidenceForStage = (from: ReadinessLifecycleStage, to: ReadinessLifecycleStage): ExecutionArtifactEvidence[] => {
  const deltas: ExecutionArtifactEvidence[] = [];
  if (to === 'indexed_plan_pending' || to === 'planned_apply_pending' || to === 'ready') {
    deltas.push({ artifact_kind: 'repo-index', artifact_path: ARTIFACT_PATHS['repo-index'], change_type: from === to ? 'unchanged' : 'created', evidence: 'Observed lifecycle stage requires a valid repo-index artifact.' });
  }
  if (to === 'planned_apply_pending' || to === 'ready') {
    deltas.push({ artifact_kind: 'plan', artifact_path: ARTIFACT_PATHS.plan, change_type: from === to ? 'unchanged' : 'created', evidence: 'Observed lifecycle stage requires a valid plan artifact.' });
  }
  if (to === 'ready') {
    deltas.push({ artifact_kind: 'policy-apply-result', artifact_path: ARTIFACT_PATHS['policy-apply-result'], change_type: from === to ? 'unchanged' : 'created', evidence: 'Observed lifecycle stage requires a valid policy-apply-result artifact.' });
  }
  return deltas;
};

const transitionForItem = (item: AdoptionWorkItem): LifecycleTransition => ({
  from: item.lifecycle_stage,
  to: NEXT_STAGE_BY_GROUP[item.parallel_group] ?? item.lifecycle_stage
});

const observedTransitionForPrompt = (
  prompt: CodexExecutionPrompt,
  queue: FleetAdoptionWorkQueue,
  fleet: FleetAdoptionReadinessSummary,
  input?: ExecutionPromptOutcomeInput
): LifecycleTransition => {
  if (input?.observed_transition) {
    return input.observed_transition;
  }
  const item = queue.work_items.find((entry) => entry.repo_id === prompt.repo_id && entry.parallel_group.replace(/\s+/g, '_') === prompt.prompt_id.split(':')[1]);
  const from = item?.lifecycle_stage ?? 'not_connected';
  const repo = fleet.repos_by_priority.find((entry) => entry.repo_id === prompt.repo_id);
  return { from, to: repo?.lifecycle_stage ?? from };
};

const comparePromptOutcome = (
  declaredStatus: ExecutionObservedStatus,
  verificationPassed: boolean,
  intended: LifecycleTransition,
  observed: LifecycleTransition
): ExecutionComparisonStatus => {
  if (declaredStatus === 'not_run') return 'not_run';
  if (declaredStatus === 'failed') return 'failed';
  const reachedTarget = intended.to === observed.to;
  const movedForward = intended.from !== observed.to;
  if (reachedTarget && declaredStatus === 'succeeded' && verificationPassed) return 'success';
  if (!reachedTarget && declaredStatus === 'succeeded') return 'mismatch';
  if (declaredStatus === 'partial' || movedForward) return 'partial_success';
  return 'failed';
};

const summarizeWaveStatus = (results: ExecutionPromptResult[]): ExecutionWaveResult['status'] => {
  if (results.length === 0 || results.every((result) => result.status === 'not_run')) return 'not_run';
  if (results.every((result) => result.status === 'success')) return 'succeeded';
  if (results.every((result) => result.status === 'failed' || result.status === 'not_run')) return 'failed';
  return 'partial';
};

const sortStrings = (values: Iterable<string>): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const buildFleetExecutionReceipt = (
  plan: FleetCodexExecutionPlan,
  queue: FleetAdoptionWorkQueue,
  fleet: FleetAdoptionReadinessSummary,
  outcomeInput: FleetExecutionOutcomeInput,
  options?: { generatedAt?: string }
): FleetExecutionReceipt => {
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const inputByPrompt = new Map(outcomeInput.prompt_outcomes.map((entry) => [entry.prompt_id, entry]));
  const queueItemByPrompt = new Map<string, AdoptionWorkItem>();
  for (const item of queue.work_items) {
    const promptId = `${item.wave}:${item.parallel_group.replace(/\s+/g, '_')}:${item.repo_id}`;
    queueItemByPrompt.set(promptId, item);
  }

  const promptResults: ExecutionPromptResult[] = plan.codex_prompts.map((prompt) => {
    const item = queueItemByPrompt.get(prompt.prompt_id);
    if (!item) throw new Error(`missing queue item for prompt ${prompt.prompt_id}`);
    const input = inputByPrompt.get(prompt.prompt_id);
    const intended = transitionForItem(item);
    const observed = observedTransitionForPrompt(prompt, queue, fleet, input);
    const verificationPassed = Boolean(input?.verification_passed) && intended.to === observed.to;
    const status = comparePromptOutcome(input?.status ?? 'not_run', verificationPassed, intended, observed);
    const evidence = [
      `Planned lifecycle transition ${intended.from} -> ${intended.to}.`,
      `Observed lifecycle transition ${observed.from} -> ${observed.to}.`,
      ...(input?.artifact_deltas?.map((artifact) => `${artifact.artifact_kind}:${artifact.change_type}`) ?? artifactEvidenceForStage(observed.from, observed.to).map((artifact) => `${artifact.artifact_kind}:${artifact.change_type}`))
    ];
    return {
      prompt_id: prompt.prompt_id,
      repo_id: prompt.repo_id,
      lane_id: prompt.lane_id,
      wave_id: prompt.wave,
      intended_transition: intended,
      observed_transition: observed,
      status,
      verification_passed: verificationPassed,
      notes: input?.notes ?? (status === 'not_run' ? 'No execution outcome was ingested for this prompt.' : 'Execution outcome ingested.'),
      evidence
    };
  });

  const blockers: ExecutionBlocker[] = plan.codex_prompts.flatMap((prompt) => {
    const input = inputByPrompt.get(prompt.prompt_id);
    return (input?.blockers ?? []).map((blocker) => ({
      blocker_code: blocker.blocker_code,
      scope: 'prompt' as const,
      repo_id: prompt.repo_id,
      prompt_id: prompt.prompt_id,
      wave_id: prompt.wave,
      message: blocker.message,
      evidence: blocker.evidence ?? 'Operator-supplied execution blocker.'
    }));
  });

  const artifactDeltas = sortStrings(
    plan.codex_prompts.flatMap((prompt) => {
      const input = inputByPrompt.get(prompt.prompt_id);
      const deltas = input?.artifact_deltas ?? artifactEvidenceForStage(
        observedTransitionForPrompt(prompt, queue, fleet, input).from,
        observedTransitionForPrompt(prompt, queue, fleet, input).to
      );
      return deltas.map((delta) => JSON.stringify(delta));
    })
  ).map((entry) => JSON.parse(entry) as ExecutionArtifactEvidence);

  const waveResults: ExecutionWaveResult[] = plan.waves.map((wave) => {
    const results = promptResults.filter((result) => result.wave_id === wave.wave_id);
    const drift = results.filter((result) => result.status === 'mismatch').map((result) => `${result.prompt_id}:${result.intended_transition.to}->${result.observed_transition.to}`);
    return {
      wave_id: wave.wave_id,
      status: summarizeWaveStatus(results),
      completed_prompts: results.filter((result) => result.status === 'success').map((result) => result.prompt_id),
      failed_prompts: results.filter((result) => result.status === 'failed' || result.status === 'mismatch').map((result) => result.prompt_id),
      partial_prompts: results.filter((result) => result.status === 'partial_success').map((result) => result.prompt_id),
      repos_needing_retry: sortStrings(results.filter((result) => ['failed', 'mismatch', 'partial_success'].includes(result.status)).map((result) => result.repo_id)),
      planned_vs_actual_drift: drift
    };
  });

  const repoResults: ExecutionRepoResult[] = fleet.repos_by_priority.map((repo) => {
    const results = promptResults.filter((result) => result.repo_id === repo.repo_id);
    const top = results.sort((left, right) => left.prompt_id.localeCompare(right.prompt_id)).at(-1) ?? null;
    const status: ExecutionComparisonStatus = results.some((result) => result.status === 'mismatch')
      ? 'mismatch'
      : results.some((result) => result.status === 'failed')
        ? 'failed'
        : results.some((result) => result.status === 'partial_success')
          ? 'partial_success'
          : results.every((result) => result.status === 'not_run')
            ? 'not_run'
            : 'success';
    return {
      repo_id: repo.repo_id,
      planned_transition: top?.intended_transition ?? null,
      observed_transition: top?.observed_transition ?? { from: repo.lifecycle_stage, to: repo.lifecycle_stage },
      status,
      prompts: sortStrings(results.map((result) => result.prompt_id)),
      blockers: sortStrings(blockers.filter((blocker) => blocker.repo_id === repo.repo_id).map((blocker) => blocker.blocker_code)),
      retry_recommended: ['failed', 'mismatch', 'partial_success'].includes(status)
    };
  });

  const drift = promptResults
    .filter((result) => result.status === 'mismatch')
    .map((result) => ({ prompt_id: result.prompt_id, repo_id: result.repo_id, expected: result.intended_transition.to, observed: result.observed_transition.to }));

  return {
    schemaVersion: '1.0',
    kind: 'fleet-adoption-execution-receipt',
    generated_at: generatedAt,
    execution_plan_digest: stablePlanDigest(plan),
    session_id: outcomeInput.session_id,
    wave_results: waveResults,
    prompt_results: promptResults,
    repo_results: repoResults,
    artifact_deltas: artifactDeltas,
    blockers,
    verification_summary: {
      prompts_total: promptResults.length,
      verification_passed_count: promptResults.filter((result) => result.verification_passed).length,
      succeeded_count: promptResults.filter((result) => result.status === 'success').length,
      failed_count: promptResults.filter((result) => result.status === 'failed').length,
      partial_count: promptResults.filter((result) => result.status === 'partial_success').length,
      mismatch_count: promptResults.filter((result) => result.status === 'mismatch').length,
      not_run_count: promptResults.filter((result) => result.status === 'not_run').length,
      repos_needing_retry: sortStrings(repoResults.filter((result) => result.retry_recommended).map((result) => result.repo_id)),
      planned_vs_actual_drift: drift
    }
  };
};
