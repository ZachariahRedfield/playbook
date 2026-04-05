import fs from 'node:fs';
import path from 'node:path';
import {
  buildAndWriteHigherOrderSynthesisArtifact,
  buildCommandQualitySummaryArtifact,
  deriveLearningStateSnapshot,
  generateLearningCompactionArtifact,
  normalizeOutcomeTelemetryArtifact,
  normalizeProcessTelemetryArtifact,
  summarizeLaneOutcomeScores,
  summarizeStructuralTelemetry,
  summarizeCycleTelemetry,
  summarizeCycleRegressions,
  type LearningStateSnapshotArtifact,
  type LearningCompactionArtifact,
  type HigherOrderSynthesisArtifact,
  type OutcomeTelemetryArtifact,
  type ProcessTelemetryArtifact,
  type TaskExecutionProfileArtifact,
  type CycleHistoryArtifact,
  type CycleStateArtifact,
  writeLearningCompactionArtifact
} from '@zachariahredfield/playbook-engine';
import type { CommandExecutionQualityArtifact } from '@zachariahredfield/playbook-core';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';
import { emitCommandFailure, hasHelpFlag, printCommandHelp } from '../../lib/commandSurface.js';
import { createCommandQualityTracker } from '../../lib/commandQuality.js';

type TelemetryCommandOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  help?: boolean;
};

type CycleTelemetryOutput = ReturnType<typeof summarizeCycleTelemetry> & {
  regression_detected: boolean;
  regression_reasons: string[];
  comparison_window: {
    window_size: number;
    minimum_cycles_required: number;
    recent_cycles: number;
    prior_cycles: number;
    sufficient_history: boolean;
  };
  recent_summary: {
    cycles_total: number;
    cycles_success: number;
    cycles_failed: number;
    success_rate: number;
    average_duration_ms: number;
    dominant_failed_step: string | null;
    dominant_failed_step_share: number;
  };
  prior_summary: {
    cycles_total: number;
    cycles_success: number;
    cycles_failed: number;
    success_rate: number;
    average_duration_ms: number;
    dominant_failed_step: string | null;
    dominant_failed_step_share: number;
  };
};

type LearningClustersReadModel = {
  cluster_count: number;
  clusters: Array<{
    cluster_type: string;
    repeated_signal_summary: string;
    confidence: number;
    next_review_action: string;
  }>;
  graph_informed: {
    affected_modules: string[];
    structural_spread: {
      module_count: number;
      affected_module_count: number;
      affected_module_ratio: number;
      dependency_edge_count: number;
      concentration_index: number;
      concentration_label: 'none' | 'concentrated' | 'distributed';
    };
    next_review_action: string;
  };
  higher_order_synthesis: {
    proposal_count: number;
    review_required: boolean;
    top_proposals: Array<{
      synthesis_proposal_id: string;
      contributing_cluster_count: number;
      confidence: number;
      proposed_generalized_abstraction: string;
      next_action_text: string;
    }>;
  };
};

const OUTCOME_TELEMETRY_PATH = ['.playbook', 'outcome-telemetry.json'] as const;
const PROCESS_TELEMETRY_PATH = ['.playbook', 'process-telemetry.json'] as const;
const TASK_EXECUTION_PROFILE_PATH = ['.playbook', 'task-execution-profile.json'] as const;
const COMMAND_QUALITY_PATH = ['.playbook', 'telemetry', 'command-quality.json'] as const;
const CYCLE_HISTORY_PATH = ['.playbook', 'cycle-history.json'] as const;
const CYCLE_STATE_PATH = ['.playbook', 'cycle-state.json'] as const;
const LEARNING_CLUSTERS_PATH = ['.playbook', 'learning-clusters.json'] as const;
const REPO_GRAPH_PATH = ['.playbook', 'repo-graph.json'] as const;
const HIGHER_ORDER_SYNTHESIS_PATH = ['.playbook', 'higher-order-synthesis.json'] as const;

type LearningClustersArtifactRead = {
  clusters?: Array<{
    dimension?: string;
    repeatedSignalSummary?: string;
    confidence?: number;
    nextActionText?: string;
  }>;
};

type RepoGraphArtifactRead = {
  nodes?: Array<{
    id?: string;
    kind?: string;
    name?: string;
  }>;
  edges?: Array<{
    from?: string;
    to?: string;
    kind?: string;
  }>;
};

type HigherOrderSynthesisArtifactRead = Pick<HigherOrderSynthesisArtifact, 'synthesisProposals'>;

const readJsonArtifact = <T>(cwd: string, segments: readonly string[]): T | undefined => {
  const artifactPath = path.join(cwd, ...segments);
  if (!fs.existsSync(artifactPath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as T;
};


const tryReadJsonArtifact = readJsonArtifact;

const renderTextOutcome = (artifact: OutcomeTelemetryArtifact): void => {
  console.log('Outcome telemetry');
  console.log('─────────────────');
  console.log(`Generated at: ${artifact.generatedAt}`);
  console.log(`Records: ${artifact.summary.total_records}`);
  console.log(`Plan churn (sum): ${artifact.summary.sum_plan_churn}`);
  console.log(`Apply retries (sum): ${artifact.summary.sum_apply_retries}`);
  console.log(`Dependency drift (sum): ${artifact.summary.sum_dependency_drift}`);
  console.log(`Contract breakage (sum): ${artifact.summary.sum_contract_breakage}`);
  console.log(`Docs mismatch (count): ${artifact.summary.docs_mismatch_count}`);
  const laneScoreSummary = summarizeLaneOutcomeScores(artifact.lane_scores ?? []);
  console.log(`Lane scores (records): ${laneScoreSummary.total_lanes}`);
  console.log(`Lane scores (avg): ${laneScoreSummary.average_score}`);
};

const renderTextProcess = (artifact: ProcessTelemetryArtifact): void => {
  console.log('Process telemetry');
  console.log('─────────────────');
  console.log(`Generated at: ${artifact.generatedAt}`);
  console.log(`Records: ${artifact.summary.total_records}`);
  console.log(`Total task duration (ms): ${artifact.summary.total_task_duration_ms}`);
  console.log(`Average task duration (ms): ${artifact.summary.average_task_duration_ms}`);
  console.log(`Total retry count: ${artifact.summary.total_retry_count}`);
  console.log(`First-pass success count: ${artifact.summary.first_pass_success_count}`);
  console.log(`Average merge conflict risk: ${artifact.summary.average_merge_conflict_risk}`);
  console.log(`Router accuracy records: ${artifact.summary.router_accuracy_records}`);
  console.log(`Average router fit score: ${artifact.summary.average_router_fit_score}`);
  console.log(`Average lane delta: ${artifact.summary.average_lane_delta}`);
  console.log(`Average validation delta: ${artifact.summary.average_validation_delta}`);
};


const renderTextLearningState = (artifact: LearningStateSnapshotArtifact): void => {
  console.log('Learning-state snapshot');
  console.log('───────────────────────');
  console.log(`Generated at: ${artifact.generatedAt}`);
  console.log(`Sample size: ${artifact.metrics.sample_size}`);
  console.log(`First-pass yield: ${artifact.metrics.first_pass_yield}`);
  console.log(`Validation load ratio: ${artifact.metrics.validation_load_ratio}`);
  console.log(`Smallest sufficient route score: ${artifact.metrics.smallest_sufficient_route_score}`);
  console.log(`Router fit score: ${artifact.metrics.router_fit_score}`);
  console.log(`Reasoning scope efficiency: ${artifact.metrics.reasoning_scope_efficiency}`);
  console.log(`Parallel safety realized: ${artifact.metrics.parallel_safety_realized}`);
  console.log(`Validation cost pressure: ${artifact.metrics.validation_cost_pressure}`);
  console.log(`Portability confidence: ${artifact.metrics.portability_confidence}`);
  console.log(`Overall confidence: ${artifact.confidenceSummary.overall_confidence}`);
};

const deriveLearningClustersReadModel = (cwd: string): LearningClustersReadModel => {
  const artifact = readJsonArtifact<LearningClustersArtifactRead>(cwd, LEARNING_CLUSTERS_PATH);
  const repoGraph = tryReadJsonArtifact<RepoGraphArtifactRead>(cwd, REPO_GRAPH_PATH);
  const higherOrderSynthesis = tryReadJsonArtifact<HigherOrderSynthesisArtifactRead>(cwd, HIGHER_ORDER_SYNTHESIS_PATH);
  const clusters = artifact?.clusters ?? [];
  const moduleNodes = (repoGraph?.nodes ?? []).filter((node) => node.kind === 'module' && typeof node.id === 'string');
  const moduleIds = new Set(moduleNodes.map((node) => node.id as string));
  const moduleNameById = new Map(
    moduleNodes.map((node) => [node.id as string, node.name ?? String(node.id).replace(/^module:/, '')])
  );
  const dependencyEdges = (repoGraph?.edges ?? []).filter(
    (edge) =>
      edge.kind === 'depends_on' &&
      typeof edge.from === 'string' &&
      typeof edge.to === 'string' &&
      moduleIds.has(edge.from) &&
      moduleIds.has(edge.to)
  );
  const degreeByModule = new Map<string, number>();
  for (const moduleId of moduleIds) {
    degreeByModule.set(moduleId, 0);
  }
  for (const edge of dependencyEdges) {
    degreeByModule.set(edge.from as string, (degreeByModule.get(edge.from as string) ?? 0) + 1);
    degreeByModule.set(edge.to as string, (degreeByModule.get(edge.to as string) ?? 0) + 1);
  }
  const modulesByDegree = Array.from(degreeByModule.entries())
    .map(([moduleId, degree]) => ({ moduleId, degree, name: moduleNameById.get(moduleId) ?? moduleId.replace(/^module:/, '') }))
    .sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name));
  const affectedModules = modulesByDegree.filter((entry) => entry.degree > 0).slice(0, 5).map((entry) => entry.name);
  const totalDegree = modulesByDegree.reduce((sum, entry) => sum + entry.degree, 0);
  const maxDegree = modulesByDegree[0]?.degree ?? 0;
  const concentrationIndex = totalDegree === 0 ? 0 : Number((maxDegree / totalDegree).toFixed(4));
  const moduleCount = moduleNodes.length;
  const affectedModuleCount = affectedModules.length;
  const affectedModuleRatio = moduleCount === 0 ? 0 : Number((affectedModuleCount / moduleCount).toFixed(4));
  const concentrationLabel: 'none' | 'concentrated' | 'distributed' =
    affectedModuleCount === 0 ? 'none' : concentrationIndex >= 0.6 ? 'concentrated' : 'distributed';
  const topAffectedModule = affectedModules[0];
  const graphReviewAction =
    affectedModuleCount === 0
      ? 'No graph-informed module concentration detected; refresh repository index before the next review window.'
      : concentrationLabel === 'concentrated'
        ? `Prioritize review around ${topAffectedModule} before broadening to adjacent modules.`
        : 'Review affected modules in parallel and preserve proposal-only follow-up gates.';

  return {
    cluster_count: clusters.length,
    clusters: clusters.map((cluster) => ({
      cluster_type: cluster.dimension ?? 'unknown',
      repeated_signal_summary: cluster.repeatedSignalSummary ?? 'No repeated signal summary available.',
      confidence: typeof cluster.confidence === 'number' ? cluster.confidence : 0,
      next_review_action: cluster.nextActionText ?? 'Review supporting evidence before proposing candidate-only follow-up.'
    })),
    graph_informed: {
      affected_modules: affectedModules,
      structural_spread: {
        module_count: moduleCount,
        affected_module_count: affectedModuleCount,
        affected_module_ratio: affectedModuleRatio,
        dependency_edge_count: dependencyEdges.length,
        concentration_index: concentrationIndex,
        concentration_label: concentrationLabel
      },
      next_review_action: graphReviewAction
    },
    higher_order_synthesis: {
      proposal_count: higherOrderSynthesis?.synthesisProposals?.length ?? 0,
      review_required: true,
      top_proposals: (higherOrderSynthesis?.synthesisProposals ?? []).slice(0, 3).map((proposal: {
        synthesisProposalId: string;
        contributingClusterIds: string[];
        confidence: number;
        proposedGeneralizedAbstraction: string;
        nextActionText: string;
      }) => ({
        synthesis_proposal_id: proposal.synthesisProposalId,
        contributing_cluster_count: proposal.contributingClusterIds.length,
        confidence: proposal.confidence,
        proposed_generalized_abstraction: proposal.proposedGeneralizedAbstraction,
        next_action_text: proposal.nextActionText
      }))
    }
  };
};

const renderTextLearningClusters = (readModel: LearningClustersReadModel): void => {
  console.log(`Learning clusters: ${readModel.cluster_count}`);
  if (readModel.cluster_count === 0) {
    console.log('Cluster highlights: none');
  } else {
    const preview = readModel.clusters.slice(0, 3);
    for (const cluster of preview) {
      console.log(`- ${cluster.cluster_type} (confidence ${cluster.confidence}): ${cluster.repeated_signal_summary}`);
      console.log(`  Next review: ${cluster.next_review_action}`);
    }
    if (readModel.cluster_count > preview.length) {
      console.log(`- ... ${readModel.cluster_count - preview.length} additional cluster(s) omitted from text preview`);
    }
  }

  console.log(
    `Graph-informed affected modules: ${
      readModel.graph_informed.affected_modules.length > 0 ? readModel.graph_informed.affected_modules.join(', ') : 'none'
    }`
  );
  console.log(
    `Structural spread: ${readModel.graph_informed.structural_spread.concentration_label} (affected=${readModel.graph_informed.structural_spread.affected_module_count}/${readModel.graph_informed.structural_spread.module_count}, concentration=${readModel.graph_informed.structural_spread.concentration_index})`
  );
  console.log(`Next review action: ${readModel.graph_informed.next_review_action}`);
  console.log(`Higher-order synthesis proposals: ${readModel.higher_order_synthesis.proposal_count}`);
  if (readModel.higher_order_synthesis.top_proposals.length > 0) {
    const top = readModel.higher_order_synthesis.top_proposals[0];
    console.log(`Top synthesis: ${top.synthesis_proposal_id} (clusters=${top.contributing_cluster_count}, confidence=${top.confidence})`);
    console.log(`Synthesis next action: ${top.next_action_text}`);
  }
};

const renderTextLearningCompaction = (artifact: LearningCompactionArtifact): void => {
  console.log('Learning compaction');
  console.log('──────────────────');
  console.log(`Generated at: ${artifact.generatedAt}`);
  console.log(`Summary id: ${artifact.summary.summary_id}`);
  console.log(`Source run ids: ${artifact.summary.source_run_ids.length}`);
  console.log(`Time window: ${artifact.summary.time_window.start} -> ${artifact.summary.time_window.end}`);
  console.log(`Route patterns: ${artifact.summary.route_patterns.length}`);
  console.log(`Lane patterns: ${artifact.summary.lane_patterns.length}`);
  console.log(`Validation patterns: ${artifact.summary.validation_patterns.length}`);
  console.log(`Recurring failures: ${artifact.summary.recurring_failures.length}`);
  console.log(`Recurring successes: ${artifact.summary.recurring_successes.length}`);
  console.log(`Confidence: ${artifact.summary.confidence}`);
};


const renderTextCommandQualitySummary = (artifact: ReturnType<typeof buildCommandQualitySummaryArtifact>): void => {
  console.log('Command-quality summary');
  console.log('───────────────────────');
  console.log(`Generated at: ${artifact.generatedAt}`);
  console.log('command | runs | success_rate | avg_duration_ms | avg_confidence | warnings_rate | open_questions_rate');
  for (const command of artifact.commands) {
    console.log(`${command.command_name} | ${command.total_runs} | ${command.success_rate} | ${command.average_duration_ms} | ${command.average_confidence_score} | ${command.warnings_rate} | ${command.open_questions_rate}`);
  }
};

export const runTelemetry = async (
  cwd: string,
  args: string[],
  options: TelemetryCommandOptions
): Promise<number> => {
  const tracker = createCommandQualityTracker(cwd, 'telemetry');
  const subcommand = args.find((arg) => !arg.startsWith('-'));

  if (options.help || !subcommand || hasHelpFlag(args)) {
    printCommandHelp({
      usage: 'playbook telemetry <subcommand> [options]',
      description: 'Inspect deterministic telemetry artifacts and cross-run learning summaries.',
      options: ['outcomes                  Inspect .playbook/outcome-telemetry.json', 'process                   Inspect .playbook/process-telemetry.json', 'learning-state            Show compacted deterministic learning snapshot', 'learning                  Compact cross-run learning signals and write artifact', 'summary                   Show combined deterministic telemetry summary', 'cycle                     Show cycle runtime summary from governed cycle artifacts', '  --detect-regressions      Add deterministic cycle regression warnings from governed cycle evidence', 'commands                  Show command-quality summary for core execution commands', '--json                    Alias for --format=json', '--format <text|json>      Output format', '--quiet                   Suppress success output in text mode', '--help                    Show help'],
      artifacts: ['.playbook/outcome-telemetry.json (read)', '.playbook/process-telemetry.json (read)', '.playbook/task-execution-profile.json (optional read)', '.playbook/repo-graph.json (optional read for learning-state graph context)', '.playbook/higher-order-synthesis.json (optional read for learning-state synthesis view)', '.playbook/telemetry/command-quality.json (read for commands)', '.playbook/cycle-history.json (read for cycle)', '.playbook/cycle-state.json (optional read for cycle)', '.playbook/cycle-history.json (read for cycle regression detection)', '.playbook/learning-compaction.json (write for learning)', '.playbook/higher-order-synthesis.json (write for learning)']
    });
    const exitCode = options.help || hasHelpFlag(args) ? ExitCode.Success : ExitCode.Failure;
    tracker.finish({ inputsSummary: `subcommand=${subcommand ?? 'none'}`, successStatus: exitCode === ExitCode.Success ? 'success' : 'failure', warningsCount: exitCode === ExitCode.Success ? 0 : 1 });
    return exitCode;
  }

  if (subcommand === 'outcomes') {
    const rawOutcomeArtifact = readJsonArtifact<OutcomeTelemetryArtifact>(cwd, OUTCOME_TELEMETRY_PATH);
    if (!rawOutcomeArtifact) {
      const exitCode = emitCommandFailure('telemetry', options, {
        summary: 'Telemetry failed: missing prerequisite outcome telemetry artifact.',
        findingId: 'telemetry.outcomes.missing-artifact',
        message: 'Missing required artifact: .playbook/outcome-telemetry.json.',
        nextActions: ['Run workflows that emit outcome telemetry and retry `playbook telemetry outcomes`.']
      });
      tracker.finish({ inputsSummary: 'subcommand=outcomes', artifactsRead: ['.playbook/outcome-telemetry.json'], successStatus: 'failure', warningsCount: 1 });
      return exitCode;
    }

    const outcomeArtifact = normalizeOutcomeTelemetryArtifact(rawOutcomeArtifact);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: outcomeArtifact });
      tracker.finish({ inputsSummary: 'subcommand=outcomes', artifactsRead: ['.playbook/outcome-telemetry.json'], successStatus: 'success' });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderTextOutcome(outcomeArtifact);
    }

    tracker.finish({ inputsSummary: 'subcommand=outcomes', artifactsRead: ['.playbook/outcome-telemetry.json'], successStatus: 'success' });
    return ExitCode.Success;
  }

  if (subcommand === 'process') {
    const rawProcessArtifact = readJsonArtifact<ProcessTelemetryArtifact>(cwd, PROCESS_TELEMETRY_PATH);
    if (!rawProcessArtifact) {
      const exitCode = emitCommandFailure('telemetry', options, {
        summary: 'Telemetry failed: missing prerequisite process telemetry artifact.',
        findingId: 'telemetry.process.missing-artifact',
        message: 'Missing required artifact: .playbook/process-telemetry.json.',
        nextActions: ['Run workflows that emit process telemetry and retry `playbook telemetry process`.']
      });
      tracker.finish({ inputsSummary: 'subcommand=process', artifactsRead: ['.playbook/process-telemetry.json'], successStatus: 'failure', warningsCount: 1 });
      return exitCode;
    }

    const processArtifact = normalizeProcessTelemetryArtifact(rawProcessArtifact);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: processArtifact });
      tracker.finish({ inputsSummary: 'subcommand=process', artifactsRead: ['.playbook/process-telemetry.json'], successStatus: 'success' });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderTextProcess(processArtifact);
    }

    tracker.finish({ inputsSummary: 'subcommand=process', artifactsRead: ['.playbook/process-telemetry.json'], successStatus: 'success' });
    return ExitCode.Success;
  }

  if (subcommand === 'learning-state') {
    const outcomeArtifact = tryReadJsonArtifact<OutcomeTelemetryArtifact>(cwd, OUTCOME_TELEMETRY_PATH);
    const processArtifact = tryReadJsonArtifact<ProcessTelemetryArtifact>(cwd, PROCESS_TELEMETRY_PATH);
    const taskExecutionProfile = tryReadJsonArtifact<TaskExecutionProfileArtifact>(cwd, TASK_EXECUTION_PROFILE_PATH);
    const learningState = deriveLearningStateSnapshot({
      outcomeTelemetry: outcomeArtifact,
      processTelemetry: processArtifact,
      taskExecutionProfile
    });
    const learningClusters = deriveLearningClustersReadModel(cwd);

    if (options.format === 'json') {
      emitJsonOutput({
        cwd,
        command: 'telemetry',
        payload: {
          ...learningState,
          learning_clusters: learningClusters
        }
      });
      tracker.finish({
        inputsSummary: 'subcommand=learning-state',
        artifactsRead: ['.playbook/outcome-telemetry.json', '.playbook/process-telemetry.json', '.playbook/task-execution-profile.json', '.playbook/repo-graph.json', '.playbook/higher-order-synthesis.json'],
        successStatus: 'success',
        openQuestionsCount: learningState.confidenceSummary.open_questions.length
      });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderTextLearningState(learningState);
      renderTextLearningClusters(learningClusters);
      if (learningState.confidenceSummary.open_questions.length > 0) {
        console.log('Open questions:');
        for (const question of learningState.confidenceSummary.open_questions) {
          console.log(`- ${question}`);
        }
      }
    }

    tracker.finish({
      inputsSummary: 'subcommand=learning-state',
      artifactsRead: ['.playbook/outcome-telemetry.json', '.playbook/process-telemetry.json', '.playbook/task-execution-profile.json', '.playbook/repo-graph.json', '.playbook/higher-order-synthesis.json'],
      successStatus: 'success',
      openQuestionsCount: learningState.confidenceSummary.open_questions.length
    });
    return ExitCode.Success;
  }

  if (subcommand === 'summary') {
    const outcomeArtifact = readJsonArtifact<OutcomeTelemetryArtifact>(cwd, OUTCOME_TELEMETRY_PATH);
    const processArtifact = readJsonArtifact<ProcessTelemetryArtifact>(cwd, PROCESS_TELEMETRY_PATH);
    if (!outcomeArtifact || !processArtifact) {
      const exitCode = emitCommandFailure('telemetry', options, {
        summary: 'Telemetry summary failed: missing prerequisite telemetry artifacts.',
        findingId: 'telemetry.summary.missing-artifact',
        message: `Missing required artifacts: ${!outcomeArtifact ? '.playbook/outcome-telemetry.json' : ''}${!outcomeArtifact && !processArtifact ? ', ' : ''}${!processArtifact ? '.playbook/process-telemetry.json' : ''}.`,
        nextActions: ['Run workflows that emit telemetry artifacts and retry `playbook telemetry summary`.']
      });
      tracker.finish({ inputsSummary: 'subcommand=summary', artifactsRead: ['.playbook/outcome-telemetry.json', '.playbook/process-telemetry.json'], successStatus: 'failure', warningsCount: 1 });
      return exitCode;
    }

    const summary = summarizeStructuralTelemetry(outcomeArtifact, processArtifact);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: summary });
      tracker.finish({ inputsSummary: 'subcommand=summary', artifactsRead: ['.playbook/outcome-telemetry.json', '.playbook/process-telemetry.json'], successStatus: 'success' });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log('Telemetry summary');
      console.log('─────────────────');
      console.log(`Generated at: ${summary.generatedAt}`);
      console.log(`Outcome records: ${summary.outcomes.total_records}`);
      console.log(`Process records: ${summary.process.total_records}`);
      console.log(`Router fit score (avg): ${summary.process.average_router_fit_score}`);
      console.log(`Router lane delta (avg): ${summary.process.average_lane_delta}`);
      if ('lane_scores' in summary) {
        console.log(`Lane score records: ${summary.lane_scores.total_records}`);
        console.log(`Lane score average: ${summary.lane_scores.average_score}`);
      }
    }

    tracker.finish({ inputsSummary: 'subcommand=summary', artifactsRead: ['.playbook/outcome-telemetry.json', '.playbook/process-telemetry.json'], successStatus: 'success' });
    return ExitCode.Success;
  }


  if (subcommand === 'cycle') {
    const detectRegressions = args.includes('--detect-regressions');
    const cycleHistory = readJsonArtifact<CycleHistoryArtifact>(cwd, CYCLE_HISTORY_PATH);
    const cycleState = readJsonArtifact<CycleStateArtifact>(cwd, CYCLE_STATE_PATH);

    const summary = summarizeCycleTelemetry({
      cycleHistory,
      cycleState
    });
    const regression = summarizeCycleRegressions({ cycleHistory });
    const cycleOutput: CycleTelemetryOutput = {
      ...summary,
      regression_detected: regression.regression_detected,
      regression_reasons: regression.regression_reasons,
      comparison_window: regression.comparison_window,
      recent_summary: regression.recent_summary,
      prior_summary: regression.prior_summary
    };

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: cycleOutput });
      tracker.finish({
        inputsSummary: 'subcommand=cycle',
        artifactsRead: ['.playbook/cycle-history.json', '.playbook/cycle-state.json'],
        successStatus: 'success'
      });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log('Cycle telemetry');
      console.log('───────────────');
      console.log(`Cycles total: ${summary.cycles_total}`);
      console.log(`Cycles success: ${summary.cycles_success}`);
      console.log(`Cycles failed: ${summary.cycles_failed}`);
      console.log(`Success rate: ${summary.success_rate}`);
      console.log(`Average duration (ms): ${summary.average_duration_ms}`);
      console.log(`Most common failed step: ${summary.most_common_failed_step ?? 'none'}`);
      if (detectRegressions) {
        if (!cycleOutput.comparison_window.sufficient_history) {
          console.log(`Regression detection: open question (insufficient history; need >=${cycleOutput.comparison_window.minimum_cycles_required}, current=${summary.cycles_total})`);
        } else if (cycleOutput.regression_detected) {
          console.log('Regression detection: warning');
          for (const reason of cycleOutput.regression_reasons) {
            console.log(`- ${reason}`);
          }
        } else {
          console.log('Regression detection: no regression flags in current evidence window');
        }
      }
      console.log('Failure distribution:');
      const failureEntries = Object.entries(summary.failure_distribution);
      if (failureEntries.length === 0) {
        console.log('- none');
      } else {
        for (const [step, count] of failureEntries) {
          console.log(`- ${step}: ${count}`);
        }
      }
      console.log('Recent cycles:');
      if (summary.recent_cycles.length === 0) {
        console.log('- none');
      } else {
        for (const cycle of summary.recent_cycles) {
          const failedSuffix = cycle.failed_step ? `, failed_step=${cycle.failed_step}` : '';
          console.log(`- ${cycle.started_at} ${cycle.cycle_id} (${cycle.result}, duration_ms=${cycle.duration_ms}${failedSuffix})`);
        }
      }
      if (summary.latest_cycle_state) {
        const failedSuffix = summary.latest_cycle_state.failed_step ? `, failed_step=${summary.latest_cycle_state.failed_step}` : '';
        console.log(`Latest cycle-state: ${summary.latest_cycle_state.cycle_id} (${summary.latest_cycle_state.result}, duration_ms=${summary.latest_cycle_state.duration_ms}${failedSuffix})`);
      }
    }

    tracker.finish({
      inputsSummary: 'subcommand=cycle',
      artifactsRead: ['.playbook/cycle-history.json', '.playbook/cycle-state.json'],
      successStatus: 'success'
    });
    return ExitCode.Success;
  }

  if (subcommand === 'learning') {
    const learningCompaction = generateLearningCompactionArtifact(cwd);
    writeLearningCompactionArtifact(cwd, learningCompaction);
    buildAndWriteHigherOrderSynthesisArtifact(cwd);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: learningCompaction });
      tracker.finish({
        inputsSummary: 'subcommand=learning',
        artifactsWritten: ['.playbook/learning-compaction.json', '.playbook/higher-order-synthesis.json'],
        downstreamArtifactsProduced: ['.playbook/learning-compaction.json', '.playbook/higher-order-synthesis.json'],
        successStatus: 'success',
        openQuestionsCount: learningCompaction.summary.open_questions.length
      });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderTextLearningCompaction(learningCompaction);
      if (learningCompaction.summary.open_questions.length > 0) {
        console.log('Open questions:');
        for (const question of learningCompaction.summary.open_questions) {
          console.log(`- ${question}`);
        }
      }
      console.log('Artifact: .playbook/learning-compaction.json');
      console.log('Artifact: .playbook/higher-order-synthesis.json');
    }

    tracker.finish({
      inputsSummary: 'subcommand=learning',
      artifactsWritten: ['.playbook/learning-compaction.json', '.playbook/higher-order-synthesis.json'],
      downstreamArtifactsProduced: ['.playbook/learning-compaction.json', '.playbook/higher-order-synthesis.json'],
      successStatus: 'success',
      openQuestionsCount: learningCompaction.summary.open_questions.length
    });
    return ExitCode.Success;
  }


  if (subcommand === 'commands') {
    const commandQualityArtifact = readJsonArtifact<CommandExecutionQualityArtifact>(cwd, COMMAND_QUALITY_PATH);
    if (!commandQualityArtifact) {
      const exitCode = emitCommandFailure('telemetry', options, {
        summary: 'Telemetry commands failed: missing command-quality telemetry artifact.',
        findingId: 'telemetry.commands.missing-artifact',
        message: 'Missing required artifact: .playbook/telemetry/command-quality.json.',
        nextActions: ['Run core execution commands and retry `playbook telemetry commands`.']
      });
      tracker.finish({ inputsSummary: 'subcommand=commands', artifactsRead: ['.playbook/telemetry/command-quality.json'], successStatus: 'failure', warningsCount: 1 });
      return exitCode;
    }

    const summary = buildCommandQualitySummaryArtifact(commandQualityArtifact);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: summary });
      tracker.finish({ inputsSummary: 'subcommand=commands', artifactsRead: ['.playbook/telemetry/command-quality.json'], successStatus: 'success' });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderTextCommandQualitySummary(summary);
    }

    tracker.finish({ inputsSummary: 'subcommand=commands', artifactsRead: ['.playbook/telemetry/command-quality.json'], successStatus: 'success' });
    return ExitCode.Success;
  }

  const exitCode = emitCommandFailure('telemetry', options, {
    summary: 'Telemetry failed: unsupported subcommand.',
    findingId: 'telemetry.subcommand.unsupported',
    message: 'Unsupported subcommand. Use outcomes|process|learning-state|learning|summary|cycle|commands.',
    nextActions: ['Run `playbook telemetry --help` for supported command surfaces.']
  });
  tracker.finish({ inputsSummary: `subcommand=${subcommand}`, successStatus: 'failure', warningsCount: 1 });
  return exitCode;
};
