import fs from 'node:fs';
import path from 'node:path';
import {
  deriveLearningStateSnapshot,
  normalizeOutcomeTelemetryArtifact,
  normalizeProcessTelemetryArtifact,
  summarizeLaneOutcomeScores,
  summarizeStructuralTelemetry,
  type LearningStateSnapshotArtifact,
  type OutcomeTelemetryArtifact,
  type ProcessTelemetryArtifact,
  type TaskExecutionProfileArtifact
} from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';

type TelemetryCommandOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const OUTCOME_TELEMETRY_PATH = ['.playbook', 'outcome-telemetry.json'] as const;
const PROCESS_TELEMETRY_PATH = ['.playbook', 'process-telemetry.json'] as const;
const TASK_EXECUTION_PROFILE_PATH = ['.playbook', 'task-execution-profile.json'] as const;

const readJsonArtifact = <T>(cwd: string, segments: readonly string[], artifactLabel: string): T => {
  const artifactPath = path.join(cwd, ...segments);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`playbook telemetry: missing ${artifactLabel} artifact at ${segments.join('/')}.`);
  }

  return JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as T;
};


const tryReadJsonArtifact = <T>(cwd: string, segments: readonly string[]): T | undefined => {
  const artifactPath = path.join(cwd, ...segments);
  if (!fs.existsSync(artifactPath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as T;
};

const printTelemetryHelp = (): void => {
  console.log(`Usage: playbook telemetry <subcommand> [--json]\n\nSubcommands:\n  outcomes                     Inspect .playbook/outcome-telemetry.json\n  process                      Inspect .playbook/process-telemetry.json\n  learning-state               Show compacted deterministic learning snapshot\n  summary                      Show combined deterministic telemetry summary`);
};

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

export const runTelemetry = async (
  cwd: string,
  args: string[],
  options: TelemetryCommandOptions
): Promise<number> => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));

  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    printTelemetryHelp();
    return subcommand ? ExitCode.Success : ExitCode.Failure;
  }

  if (subcommand === 'outcomes') {
    const outcomeArtifact = normalizeOutcomeTelemetryArtifact(
      readJsonArtifact<OutcomeTelemetryArtifact>(cwd, OUTCOME_TELEMETRY_PATH, 'outcome telemetry')
    );

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: outcomeArtifact });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderTextOutcome(outcomeArtifact);
    }

    return ExitCode.Success;
  }

  if (subcommand === 'process') {
    const processArtifact = normalizeProcessTelemetryArtifact(
      readJsonArtifact<ProcessTelemetryArtifact>(cwd, PROCESS_TELEMETRY_PATH, 'process telemetry')
    );

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: processArtifact });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderTextProcess(processArtifact);
    }

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

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: learningState });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderTextLearningState(learningState);
      if (learningState.confidenceSummary.open_questions.length > 0) {
        console.log('Open questions:');
        for (const question of learningState.confidenceSummary.open_questions) {
          console.log(`- ${question}`);
        }
      }
    }

    return ExitCode.Success;
  }

  if (subcommand === 'summary') {
    const outcomeArtifact = readJsonArtifact<OutcomeTelemetryArtifact>(cwd, OUTCOME_TELEMETRY_PATH, 'outcome telemetry');
    const processArtifact = readJsonArtifact<ProcessTelemetryArtifact>(cwd, PROCESS_TELEMETRY_PATH, 'process telemetry');
    const summary = summarizeStructuralTelemetry(outcomeArtifact, processArtifact);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'telemetry', payload: summary });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log('Telemetry summary');
      console.log('─────────────────');
      console.log(`Generated at: ${summary.generatedAt}`);
      console.log(`Outcome records: ${summary.outcomes.total_records}`);
      console.log(`Process records: ${summary.process.total_records}`);
      if ('lane_scores' in summary) {
        console.log(`Lane score records: ${summary.lane_scores.total_records}`);
        console.log(`Lane score average: ${summary.lane_scores.average_score}`);
      }
    }

    return ExitCode.Success;
  }

  const message = 'playbook telemetry: unsupported subcommand. Use "playbook telemetry outcomes|process|learning-state|summary".';
  if (options.format === 'json') {
    console.log(JSON.stringify({ schemaVersion: '1.0', command: 'telemetry', error: message }, null, 2));
  } else {
    console.error(message);
  }
  return ExitCode.Failure;
};
