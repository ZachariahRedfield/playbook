import fs from 'node:fs';
import path from 'node:path';
import type { DocsConsolidationPlanArtifact } from '../docs/consolidationPlan.js';
import type { LaneStateArtifact, LaneStateEntry } from '../orchestration/laneState.js';
import type { WorkerResultEntry, WorkerResultsArtifact } from '../orchestration/workerResults.js';

type PolicyApplyEntry = {
  proposal_id: string;
  decision?: string;
  reason?: string;
  error?: string;
};

type PolicyApplyResultArtifact = {
  summary?: {
    executed?: number;
    skipped_requires_review?: number;
    skipped_blocked?: number;
    failed_execution?: number;
    total?: number;
  };
  skipped_blocked?: PolicyApplyEntry[];
  failed_execution?: PolicyApplyEntry[];
};

type ScopeEvidence = {
  declared_files?: string[];
  actual_files?: string[];
  budget_files?: number;
};

type ExecutionOutcomeInputArtifact = {
  prompt_outcomes?: Array<{
    mutation_scope?: ScopeEvidence;
  }>;
};

export type ProofParallelWorkDecision =
  | 'parallel_guard_conflicted'
  | 'parallel_blocked'
  | 'parallel_plan_ready'
  | 'parallel_pending'
  | 'parallel_merge_ready'
  | 'parallel_clear';

export type ProofParallelWorkArtifactState = {
  available: boolean;
  path: string;
};

export type ProofParallelWorkSummary = {
  decision: ProofParallelWorkDecision;
  status: string;
  affected_surfaces: string[];
  blockers: string[];
  next_action: string;
  counts: {
    pending: number;
    blocked: number;
    plan_ready: number;
    guard_conflicted: number;
    merge_ready: number;
  };
  scope: {
    present: number;
    missing: number;
    violated: number;
    clean: number;
    violated_files: string[];
    budget_status: 'within_budget' | 'over_budget' | 'unknown';
  };
  artifacts: {
    lane_state: ProofParallelWorkArtifactState;
    worker_results: ProofParallelWorkArtifactState;
    docs_consolidation_plan: ProofParallelWorkArtifactState;
    guarded_apply: ProofParallelWorkArtifactState;
    execution_outcome_input: ProofParallelWorkArtifactState;
  };
  details: {
    lane_state: {
      available: boolean;
      blocked_lanes: string[];
      merge_ready_lanes: string[];
      pending_lanes: string[];
      plan_ready_lanes: string[];
    };
    worker_results: {
      available: boolean;
      in_progress_lanes: string[];
      blocked_lanes: string[];
      completed_lanes: string[];
    };
    docs_consolidation_plan: {
      available: boolean;
      executable_targets: number;
      excluded_targets: number;
      target_docs: string[];
      excluded_targets_by_doc: string[];
    };
    guarded_apply: {
      available: boolean;
      executed: number;
      skipped_requires_review: number;
      skipped_blocked: string[];
      failed_execution: string[];
    };
    scope: {
      over_budget_prompts: number;
      prompts_with_scope: number;
      prompts_missing_scope: number;
    };
  };
};

const readJsonIfPresent = <T>(repoRoot: string, relativePath: string): T | undefined => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return undefined;
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
};

const normalizeSummaryStrings = (values: readonly string[]): string[] =>
  values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const laneIsPending = (lane: LaneStateEntry): boolean => lane.status === 'ready' || lane.status === 'running' || lane.status === 'completed';

export const readProofParallelWorkSummary = (repoRoot: string): ProofParallelWorkSummary => {
  const laneStatePath = '.playbook/lane-state.json';
  const workerResultsPath = '.playbook/worker-results.json';
  const docsPlanPath = '.playbook/docs-consolidation-plan.json';
  const guardedApplyPath = '.playbook/policy-apply-result.json';
  const executionOutcomeInputPath = '.playbook/execution-outcome-input.json';

  const laneState = readJsonIfPresent<LaneStateArtifact>(repoRoot, laneStatePath);
  const workerResults = readJsonIfPresent<WorkerResultsArtifact>(repoRoot, workerResultsPath);
  const docsPlan = readJsonIfPresent<DocsConsolidationPlanArtifact>(repoRoot, docsPlanPath);
  const guardedApply = readJsonIfPresent<PolicyApplyResultArtifact>(repoRoot, guardedApplyPath);
  const executionOutcomeInput = readJsonIfPresent<ExecutionOutcomeInputArtifact>(repoRoot, executionOutcomeInputPath);

  const blockedLanes = uniqueSorted([
    ...(laneState?.blocked_lanes ?? []),
    ...((workerResults?.results ?? []).filter((result: WorkerResultEntry) => result.completion_status === 'blocked').map((result) => result.lane_id))
  ]);
  const mergeReadyLanes = uniqueSorted(laneState?.merge_ready_lanes ?? []);
  const planReadyLanes = uniqueSorted(
    (laneState?.lanes ?? [])
      .filter((lane) => lane.protected_doc_consolidation.stage === 'plan_ready')
      .map((lane) => lane.lane_id)
  );
  const pendingLanes = uniqueSorted([
    ...((laneState?.lanes ?? []).filter((lane) => laneIsPending(lane)).map((lane) => lane.lane_id)),
    ...((workerResults?.results ?? []).filter((result: WorkerResultEntry) => result.completion_status === 'in_progress').map((result) => result.lane_id))
  ]).filter((laneId) => !blockedLanes.includes(laneId) && !mergeReadyLanes.includes(laneId));

  const skippedBlocked = uniqueSorted((guardedApply?.skipped_blocked ?? []).map((entry) => entry.proposal_id));
  const failedExecution = uniqueSorted((guardedApply?.failed_execution ?? []).map((entry) => entry.proposal_id));
  const guardConflicted = uniqueSorted([...skippedBlocked, ...failedExecution]);

  const counts = {
    pending: pendingLanes.length,
    blocked: blockedLanes.length,
    plan_ready: planReadyLanes.length,
    guard_conflicted: guardConflicted.length,
    merge_ready: mergeReadyLanes.length
  };

  const docsTargetDocs = uniqueSorted((docsPlan?.tasks ?? []).map((task) => task.file).filter((value): value is string => typeof value === 'string'));
  const docsExcludedTargets = uniqueSorted((docsPlan?.excluded ?? []).map((entry) => entry.target_doc));
  const promptOutcomes = executionOutcomeInput?.prompt_outcomes ?? [];
  const scopeEntries = promptOutcomes.map((prompt) => prompt.mutation_scope);
  const scopePresent = scopeEntries.filter((scope): scope is ScopeEvidence => Boolean(scope)).length;
  const scopeMissing = Math.max(0, promptOutcomes.length - scopePresent);
  const scopeViolations = scopeEntries
    .filter((scope): scope is ScopeEvidence => Boolean(scope))
    .map((scope) => {
      const declared = uniqueSorted((scope.declared_files ?? []).filter((file): file is string => typeof file === 'string' && file.trim().length > 0));
      const actual = uniqueSorted((scope.actual_files ?? []).filter((file): file is string => typeof file === 'string' && file.trim().length > 0));
      const outOfScope = actual.filter((file) => !declared.includes(file));
      const budget = typeof scope.budget_files === 'number' && Number.isFinite(scope.budget_files) ? scope.budget_files : null;
      const overBudget = budget !== null && actual.length > budget;
      return {
        outOfScope,
        overBudget
      };
    });
  const violatedFiles = uniqueSorted(scopeViolations.flatMap((entry) => entry.outOfScope));
  const overBudgetPrompts = scopeViolations.filter((entry) => entry.overBudget).length;
  const scopeViolated = scopeViolations.filter((entry) => entry.outOfScope.length > 0 || entry.overBudget).length;
  const scopeClean = Math.max(0, scopePresent - scopeViolated);
  const budgetStatus: ProofParallelWorkSummary['scope']['budget_status'] =
    scopePresent === 0
      ? 'unknown'
      : overBudgetPrompts > 0
        ? 'over_budget'
        : 'within_budget';

  const affectedSurfaces = uniqueSorted([
    counts.pending > 0 ? `${counts.pending} pending lane(s)` : '',
    counts.blocked > 0 ? `${counts.blocked} blocked lane(s)` : '',
    counts.plan_ready > 0 ? `${counts.plan_ready} docs plan-ready lane(s)` : '',
    counts.guard_conflicted > 0 ? `${counts.guard_conflicted} guarded-apply conflict(s)` : '',
    counts.merge_ready > 0 ? `${counts.merge_ready} merge-ready lane(s)` : '',
    docsTargetDocs.length > 0 ? `docs targets=${docsTargetDocs.length}` : '',
    scopePresent > 0 && scopeViolated > 0 ? `scope violated=${scopeViolated}` : '',
    scopePresent > 0 && scopeViolated === 0 ? `scope clean=${scopeClean}` : '',
    scopeMissing > 0 ? `scope missing=${scopeMissing}` : ''
  ].filter(Boolean));

  const blockers = uniqueSorted(normalizeSummaryStrings([
    ...blockedLanes.slice(0, 3).map((laneId) => `blocked lane: ${laneId}`),
    ...guardConflicted.slice(0, 3).map((proposalId) => `guard conflict: ${proposalId}`),
    ...docsExcludedTargets.slice(0, 3).map((targetDoc) => `docs exclusion: ${targetDoc}`),
    ...violatedFiles.slice(0, 3).map((file) => `scope violation: ${file}`),
    overBudgetPrompts > 0 ? `scope budget exceeded: ${overBudgetPrompts} prompt(s)` : ''
  ]));

  let decision: ProofParallelWorkDecision = 'parallel_clear';
  let status = 'parallel integration clear';
  let nextAction = 'No parallel-work integration action is required.';

  if (counts.guard_conflicted > 0) {
    decision = 'parallel_guard_conflicted';
    status = 'guarded apply conflicted';
    nextAction = 'Inspect .playbook/policy-apply-result.json blocked/failed entries, resolve guard conflicts, then rerun `pnpm playbook apply --json`.';
  } else if (counts.blocked > 0) {
    decision = 'parallel_blocked';
    status = 'parallel lanes blocked';
    nextAction = 'Resolve blocked lanes in .playbook/lane-state.json and submit updated worker results before continuing.';
  } else if (counts.plan_ready > 0) {
    decision = 'parallel_plan_ready';
    status = 'docs consolidation ready to apply';
    nextAction = 'Run `pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json`.';
  } else if (counts.pending > 0) {
    decision = 'parallel_pending';
    status = 'parallel work still pending';
    nextAction = 'Finish pending lane work and submit the remaining worker results.';
  } else if (counts.merge_ready > 0) {
    decision = 'parallel_merge_ready';
    status = 'merge-ready lanes available';
    nextAction = 'Review merge-ready lanes and reconcile them without reopening artifact guts unless a guard blocks promotion.';
  }

  return {
    decision,
    status,
    affected_surfaces: affectedSurfaces,
    blockers,
    next_action: nextAction,
    counts,
    scope: {
      present: scopePresent,
      missing: scopeMissing,
      violated: scopeViolated,
      clean: scopeClean,
      violated_files: violatedFiles,
      budget_status: budgetStatus
    },
    artifacts: {
      lane_state: { available: Boolean(laneState), path: laneStatePath },
      worker_results: { available: Boolean(workerResults), path: workerResultsPath },
      docs_consolidation_plan: { available: Boolean(docsPlan), path: docsPlanPath },
      guarded_apply: { available: Boolean(guardedApply), path: guardedApplyPath },
      execution_outcome_input: { available: Boolean(executionOutcomeInput), path: executionOutcomeInputPath }
    },
    details: {
      lane_state: {
        available: Boolean(laneState),
        blocked_lanes: blockedLanes,
        merge_ready_lanes: mergeReadyLanes,
        pending_lanes: pendingLanes,
        plan_ready_lanes: planReadyLanes
      },
      worker_results: {
        available: Boolean(workerResults),
        in_progress_lanes: uniqueSorted((workerResults?.results ?? []).filter((result: WorkerResultEntry) => result.completion_status === 'in_progress').map((result) => result.lane_id)),
        blocked_lanes: uniqueSorted((workerResults?.results ?? []).filter((result: WorkerResultEntry) => result.completion_status === 'blocked').map((result) => result.lane_id)),
        completed_lanes: uniqueSorted((workerResults?.results ?? []).filter((result: WorkerResultEntry) => result.completion_status === 'completed').map((result) => result.lane_id))
      },
      docs_consolidation_plan: {
        available: Boolean(docsPlan),
        executable_targets: docsPlan?.summary?.executable_targets ?? 0,
        excluded_targets: docsPlan?.summary?.excluded_targets ?? 0,
        target_docs: docsTargetDocs,
        excluded_targets_by_doc: docsExcludedTargets
      },
      guarded_apply: {
        available: Boolean(guardedApply),
        executed: guardedApply?.summary?.executed ?? 0,
        skipped_requires_review: guardedApply?.summary?.skipped_requires_review ?? 0,
        skipped_blocked: skippedBlocked,
        failed_execution: failedExecution
      },
      scope: {
        over_budget_prompts: overBudgetPrompts,
        prompts_with_scope: scopePresent,
        prompts_missing_scope: scopeMissing
      }
    }
  };
};
