import type { FleetAdoptionReadinessSummary } from './fleetReadiness.js';
import type { FleetCodexExecutionPlan } from './executionPlan.js';
import type { FleetExecutionReceipt, FleetExecutionOutcomeInput, ExecutionObservedStatus, LifecycleTransition, ExecutionPromptOutcomeInput } from './executionReceipt.js';
import { buildFleetExecutionReceipt } from './executionReceipt.js';
import type { FleetAdoptionWorkQueue, AdoptionWorkItem } from './workQueue.js';
import type { FleetUpdatedAdoptionState } from './executionUpdatedState.js';
import { buildFleetUpdatedAdoptionState } from './executionUpdatedState.js';
import { deriveNextAdoptionQueueFromUpdatedState } from './updatedStateQueue.js';
import type { ReadinessLifecycleStage } from './readiness.js';

export type ExecutionResult = {
  repo_id: string;
  prompt_id: string;
  status: 'success' | 'failed' | 'not_run';
  observed_transition?: {
    from: ReadinessLifecycleStage;
    to: ReadinessLifecycleStage;
  };
  error?: string;
};

export type FleetExecutionIngestionResult = {
  receipt: FleetExecutionReceipt;
  updated_state: FleetUpdatedAdoptionState;
  next_queue: FleetAdoptionWorkQueue;
  outcome_input: FleetExecutionOutcomeInput;
};

const sortStrings = (values: Iterable<string>): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const stableResultOrder = (left: ExecutionResult, right: ExecutionResult): number =>
  left.repo_id.localeCompare(right.repo_id) ||
  left.prompt_id.localeCompare(right.prompt_id) ||
  left.status.localeCompare(right.status) ||
  (left.observed_transition?.from ?? '').localeCompare(right.observed_transition?.from ?? '') ||
  (left.observed_transition?.to ?? '').localeCompare(right.observed_transition?.to ?? '') ||
  (left.error ?? '').localeCompare(right.error ?? '');

const laneIdFromPromptId = (promptId: string): string => {
  const [, laneSegment] = promptId.split(':');
  return laneSegment ?? 'unknown_lane';
};

const NEXT_STAGE_BY_GROUP: Record<string, ReadinessLifecycleStage> = {
  'connect lane': 'playbook_not_detected',
  'init lane': 'playbook_detected_index_pending',
  'index lane': 'indexed_plan_pending',
  'verify/plan lane': 'planned_apply_pending',
  'apply lane': 'ready',
  'retry lane': 'ready',
  'replan lane': 'planned_apply_pending'
};

const promptTransitionMap = (plan: FleetCodexExecutionPlan, queue: FleetAdoptionWorkQueue): Map<string, LifecycleTransition> => {
  const queueItemByPrompt = new Map<string, AdoptionWorkItem>();
  for (const item of queue.work_items) {
    const promptId = `${item.wave}:${item.parallel_group.replace(/\s+/g, '_')}:${item.repo_id}`;
    queueItemByPrompt.set(promptId, item);
  }

  return new Map(plan.codex_prompts.map((prompt) => {
    const item = queueItemByPrompt.get(prompt.prompt_id);
    if (!item) {
      throw new Error(`missing queue item for prompt ${prompt.prompt_id}`);
    }
    const transition: LifecycleTransition = {
      from: item.lifecycle_stage,
      to: NEXT_STAGE_BY_GROUP[item.parallel_group] ?? item.lifecycle_stage
    };
    return [prompt.prompt_id, transition];
  }));
};

const toObservedTransition = (result: ExecutionResult, intended: LifecycleTransition): LifecycleTransition => {
  if (result.observed_transition) {
    return result.observed_transition;
  }
  if (result.status === 'success') {
    return { from: intended.from, to: intended.to };
  }
  return { from: intended.from, to: intended.from };
};

const toOutcomeStatus = (status: ExecutionResult['status']): ExecutionObservedStatus => {
  if (status === 'success') return 'succeeded';
  if (status === 'failed') return 'failed';
  return 'not_run';
};

export const defaultExecutionOutcomeInput = (): FleetExecutionOutcomeInput => ({
  schemaVersion: '1.0',
  kind: 'fleet-adoption-execution-outcome-input',
  generated_at: new Date(0).toISOString(),
  session_id: 'unrecorded-session',
  prompt_outcomes: []
});

export const normalizeExecutionOutcomeInput = (input: FleetExecutionOutcomeInput): FleetExecutionOutcomeInput => ({
  ...input,
  prompt_outcomes: [...input.prompt_outcomes].sort((left, right) =>
    left.repo_id.localeCompare(right.repo_id) ||
    left.prompt_id.localeCompare(right.prompt_id) ||
    left.lane_id.localeCompare(right.lane_id) ||
    left.status.localeCompare(right.status) ||
    JSON.stringify(left.observed_transition ?? {}).localeCompare(JSON.stringify(right.observed_transition ?? {})) ||
    (left.notes ?? '').localeCompare(right.notes ?? '')
  )
});

export const mapExecutionResultsToOutcomeInput = (
  results: ExecutionResult[],
  plan: FleetCodexExecutionPlan,
  queue: FleetAdoptionWorkQueue,
  options?: { generatedAt?: string; sessionId?: string }
): FleetExecutionOutcomeInput => {
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const transitionByPrompt = promptTransitionMap(plan, queue);
  const deduped = new Map<string, ExecutionResult>();
  for (const result of [...results].sort(stableResultOrder)) {
    deduped.set(result.prompt_id, result);
  }

  const promptOutcomes: ExecutionPromptOutcomeInput[] = [...deduped.values()].map((result) => {
    const intended = transitionByPrompt.get(result.prompt_id);
    if (!intended) {
      throw new Error(`unknown prompt_id in execution results: ${result.prompt_id}`);
    }
    const observedTransition = toObservedTransition(result, intended);
    return {
      prompt_id: result.prompt_id,
      repo_id: result.repo_id,
      lane_id: laneIdFromPromptId(result.prompt_id),
      status: toOutcomeStatus(result.status),
      verification_passed: result.status === 'success' && observedTransition.to === intended.to,
      notes: result.error?.trim() ? result.error.trim() : `Execution result ingested with status ${result.status}.`,
      observed_transition: observedTransition,
      blockers: result.status === 'failed' && result.error?.trim()
        ? [{ blocker_code: 'execution_failed', message: result.error.trim(), evidence: 'ingested execution result error' }]
        : undefined
    };
  });

  return normalizeExecutionOutcomeInput({
    schemaVersion: '1.0',
    kind: 'fleet-adoption-execution-outcome-input',
    generated_at: generatedAt,
    session_id: options?.sessionId ?? 'execution-result-ingest',
    prompt_outcomes: promptOutcomes
  });
};

export const ingestExecutionResults = (
  results: ExecutionResult[],
  context: {
    plan: FleetCodexExecutionPlan;
    queue: FleetAdoptionWorkQueue;
    fleet: FleetAdoptionReadinessSummary;
  },
  options?: { generatedAt?: string; sessionId?: string }
): FleetExecutionIngestionResult => {
  const outcomeInput = mapExecutionResultsToOutcomeInput(results, context.plan, context.queue, options);
  const receipt = buildFleetExecutionReceipt(context.plan, context.queue, context.fleet, outcomeInput, { generatedAt: options?.generatedAt });
  const updated_state = buildFleetUpdatedAdoptionState(context.plan, context.queue, context.fleet, receipt, { generatedAt: options?.generatedAt });
  const next_queue = deriveNextAdoptionQueueFromUpdatedState(updated_state, { generatedAt: options?.generatedAt });
  return {
    outcome_input: outcomeInput,
    receipt,
    updated_state,
    next_queue
  };
};
