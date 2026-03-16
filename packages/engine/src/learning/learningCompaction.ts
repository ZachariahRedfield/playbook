import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  CompactedLearningSummary,
  LearningLanePattern,
  LearningRecurringSignal,
  LearningRoutePattern,
  LearningValidationPattern
} from '@zachariahredfield/playbook-core';
import { type ProcessTelemetryArtifact, type OutcomeTelemetryArtifact, normalizeOutcomeTelemetryArtifact, normalizeProcessTelemetryArtifact } from '../telemetry/outcomeTelemetry.js';
import { type RepositoryEvent, readRepositoryEvents, type RepositoryEventIndex, REPOSITORY_EVENTS_SCHEMA_VERSION } from '../memory/events.js';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';

export const LEARNING_COMPACTION_SCHEMA_VERSION = '1.0' as const;
export const LEARNING_COMPACTION_RELATIVE_PATH = '.playbook/learning-compaction.json' as const;

type ArtifactAvailability = {
  available: boolean;
  artifactPath: string;
  recordCount: number;
};

export type LearningCompactionArtifact = {
  schemaVersion: typeof LEARNING_COMPACTION_SCHEMA_VERSION;
  kind: 'learning-compaction';
  generatedAt: string;
  sourceArtifacts: {
    processTelemetry: ArtifactAvailability;
    outcomeTelemetry: ArtifactAvailability;
    memoryEvents: ArtifactAvailability;
    memoryIndex: ArtifactAvailability;
  };
  summary: CompactedLearningSummary;
};

const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));


const stableSort = <T>(values: T[], compare: (left: T, right: T) => number): T[] =>
  [...values].sort(compare);

const summarizeRoutePatterns = (records: ProcessTelemetryArtifact['records']): LearningRoutePattern[] => {
  const aggregate = new Map<string, { routeId: string; taskFamily: string; count: number; retry: number; firstPass: number }>();

  for (const record of records) {
    const routeId = record.route_id ?? 'unknown-route';
    const key = `${record.task_family}::${routeId}`;
    const entry = aggregate.get(key) ?? { routeId, taskFamily: record.task_family, count: 0, retry: 0, firstPass: 0 };
    entry.count += 1;
    entry.retry += record.retry_count;
    entry.firstPass += record.first_pass_success ? 1 : 0;
    aggregate.set(key, entry);
  }

  return stableSort(
    [...aggregate.values()].map((entry) => ({
      route_id: entry.routeId,
      task_family: entry.taskFamily,
      observation_count: entry.count,
      avg_retry_count: round4(entry.count === 0 ? 0 : entry.retry / entry.count),
      first_pass_rate: round4(entry.count === 0 ? 0 : entry.firstPass / entry.count)
    })),
    (left, right) =>
      right.observation_count - left.observation_count ||
      left.task_family.localeCompare(right.task_family) ||
      left.route_id.localeCompare(right.route_id)
  );
};

const summarizeLanePatterns = (processRecords: ProcessTelemetryArtifact['records'], events: RepositoryEvent[]): LearningLanePattern[] => {
  const aggregate = new Map<string, { success: number; failure: number }>();

  for (const record of processRecords) {
    const laneShape = `parallel:${record.parallel_lane_count ?? 1}`;
    const entry = aggregate.get(laneShape) ?? { success: 0, failure: 0 };
    if (record.first_pass_success) {
      entry.success += 1;
    } else {
      entry.failure += 1;
    }
    aggregate.set(laneShape, entry);
  }

  for (const event of events) {
    if (event.event_type !== 'execution_outcome' && event.event_type !== 'lane_outcome') {
      continue;
    }

    const laneShape = `outcome:${event.outcome}`;
    const entry = aggregate.get(laneShape) ?? { success: 0, failure: 0 };
    if (event.outcome === 'success') {
      entry.success += 1;
    } else {
      entry.failure += 1;
    }
    aggregate.set(laneShape, entry);
  }

  return stableSort(
    [...aggregate.entries()].map(([laneShape, entry]) => {
      const total = entry.success + entry.failure;
      return {
        lane_shape: laneShape,
        success_count: entry.success,
        failure_count: entry.failure,
        success_rate: round4(total === 0 ? 0 : entry.success / total)
      };
    }),
    (left, right) =>
      right.success_count + right.failure_count - (left.success_count + left.failure_count) ||
      left.lane_shape.localeCompare(right.lane_shape)
  );
};

const summarizeValidationPatterns = (records: ProcessTelemetryArtifact['records']): LearningValidationPattern[] => {
  const aggregate = new Map<string, { count: number; bottleneck: number; duration: number; withDuration: number }>();

  for (const record of records) {
    const validations = record.required_validations_selected && record.required_validations_selected.length > 0
      ? record.required_validations_selected
      : record.validators_run;

    for (const validation of validations) {
      const entry = aggregate.get(validation) ?? { count: 0, bottleneck: 0, duration: 0, withDuration: 0 };
      entry.count += 1;
      if (record.over_validation_signal || record.under_validation_signal) {
        entry.bottleneck += 1;
      }
      if (typeof record.validation_duration_ms === 'number') {
        entry.duration += record.validation_duration_ms;
        entry.withDuration += 1;
      }
      aggregate.set(validation, entry);
    }
  }

  return stableSort(
    [...aggregate.entries()].map(([validation, entry]) => ({
      validation_key: validation,
      observation_count: entry.count,
      bottleneck_rate: round4(entry.count === 0 ? 0 : entry.bottleneck / entry.count),
      avg_duration_ms: Math.round(entry.withDuration === 0 ? 0 : entry.duration / entry.withDuration)
    })),
    (left, right) =>
      right.observation_count - left.observation_count ||
      right.bottleneck_rate - left.bottleneck_rate ||
      left.validation_key.localeCompare(right.validation_key)
  );
};

const summarizeRecurringFailures = (processRecords: ProcessTelemetryArtifact['records'], outcomeRecords: OutcomeTelemetryArtifact['records']): LearningRecurringSignal[] => {
  const taskFailureCounts = new Map<string, number>();
  for (const record of processRecords) {
    if (record.retry_count > 1 || !record.first_pass_success) {
      taskFailureCounts.set(record.task_family, (taskFailureCounts.get(record.task_family) ?? 0) + 1);
    }
  }

  const contractBreakages = outcomeRecords.filter((record) => record.contract_breakage > 0).length;
  const docsMismatch = outcomeRecords.filter((record) => record.docs_mismatch).length;

  const failures: LearningRecurringSignal[] = [
    ...[...taskFailureCounts.entries()].map(([taskFamily, count]) => ({
      signal_id: `failure.retry-heavy.${taskFamily}`,
      family: 'retry-heavy-task-family',
      evidence_count: count,
      confidence: round4(clamp01(count / Math.max(1, processRecords.length)))
    })),
    {
      signal_id: 'failure.validation.contract-breakage',
      family: 'validation-bottleneck',
      evidence_count: contractBreakages,
      confidence: round4(clamp01(contractBreakages / Math.max(1, outcomeRecords.length)))
    },
    {
      signal_id: 'failure.validation.docs-mismatch',
      family: 'validation-bottleneck',
      evidence_count: docsMismatch,
      confidence: round4(clamp01(docsMismatch / Math.max(1, outcomeRecords.length)))
    }
  ];

  return failures
    .filter((entry) => entry.evidence_count > 0)
    .sort((left, right) => right.evidence_count - left.evidence_count || left.signal_id.localeCompare(right.signal_id));
};

const summarizeRecurringSuccesses = (processRecords: ProcessTelemetryArtifact['records']): LearningRecurringSignal[] => {
  const byLaneShape = new Map<string, { total: number; success: number }>();
  const routerFitHigh = processRecords.filter((record) => (record.router_fit_score ?? 0) >= 0.75).length;

  for (const record of processRecords) {
    const key = `parallel:${record.parallel_lane_count ?? 1}`;
    const entry = byLaneShape.get(key) ?? { total: 0, success: 0 };
    entry.total += 1;
    if (record.first_pass_success) {
      entry.success += 1;
    }
    byLaneShape.set(key, entry);
  }

  const successes: LearningRecurringSignal[] = [
    ...[...byLaneShape.entries()]
      .filter(([, value]) => value.success > 0)
      .map(([laneShape, value]) => ({
        signal_id: `success.lane-shape.${laneShape}`,
        family: 'successful-lane-shape',
        evidence_count: value.success,
        confidence: round4(clamp01(value.success / Math.max(1, value.total)))
      })),
    {
      signal_id: 'success.router-fit.high',
      family: 'router-fit-pattern',
      evidence_count: routerFitHigh,
      confidence: round4(clamp01(routerFitHigh / Math.max(1, processRecords.length)))
    }
  ];

  return successes
    .filter((entry) => entry.evidence_count > 0)
    .sort((left, right) => right.evidence_count - left.evidence_count || left.signal_id.localeCompare(right.signal_id));
};

const computeOpenQuestions = (input: {
  processAvailable: boolean;
  outcomeAvailable: boolean;
  memoryEventsAvailable: boolean;
  sourceRunIds: string[];
  routePatterns: LearningRoutePattern[];
}): string[] => {
  const questions = new Set<string>();
  if (!input.processAvailable) {
    questions.add('Process telemetry missing: retry-heavy and route-fit pattern confidence is limited.');
  }
  if (!input.outcomeAvailable) {
    questions.add('Outcome telemetry missing: validation bottleneck recurrence cannot be cross-checked against outcomes.');
  }
  if (!input.memoryEventsAvailable) {
    questions.add('Memory events missing: lane transition and execution outcome compaction is under-specified.');
  }
  if (input.sourceRunIds.length < 2) {
    questions.add('Low cross-run evidence: collect at least two run_ids before promotion decisions.');
  }
  if (input.routePatterns.length < 2) {
    questions.add('Limited router-fit diversity: only one dominant task-family/route pattern observed.');
  }

  return [...questions].sort((left, right) => left.localeCompare(right));
};

const buildSummaryId = (sourceRunIds: string[], windowStart: string, windowEnd: string): string => {
  const digest = createHash('sha256')
    .update(JSON.stringify({ sourceRunIds, windowStart, windowEnd }), 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `learning-summary-${digest}`;
};

const readMemoryIndex = (repoRoot: string): RepositoryEventIndex | undefined => {
  const indexPath = path.join(repoRoot, '.playbook', 'memory', 'index.json');
  const parsed = readJsonIfExists<RepositoryEventIndex>(indexPath);
  if (!parsed || parsed.schemaVersion !== REPOSITORY_EVENTS_SCHEMA_VERSION) {
    return undefined;
  }
  return parsed;
};

export const generateLearningCompactionArtifact = (repoRoot: string): LearningCompactionArtifact => {
  const processPath = path.join(repoRoot, '.playbook', 'process-telemetry.json');
  const outcomePath = path.join(repoRoot, '.playbook', 'outcome-telemetry.json');
  const memoryEventsDir = path.join(repoRoot, '.playbook', 'memory', 'events');
  const memoryIndexPath = path.join(repoRoot, '.playbook', 'memory', 'index.json');

  const processRaw = readJsonIfExists<ProcessTelemetryArtifact>(processPath);
  const outcomeRaw = readJsonIfExists<OutcomeTelemetryArtifact>(outcomePath);
  const process = processRaw ? normalizeProcessTelemetryArtifact(processRaw) : undefined;
  const outcome = outcomeRaw ? normalizeOutcomeTelemetryArtifact(outcomeRaw) : undefined;
  const events = readRepositoryEvents(repoRoot, { order: 'asc' });
  const memoryIndex = readMemoryIndex(repoRoot);

  const processRecords = process?.records ?? [];
  const outcomeRecords = outcome?.records ?? [];
  const routePatterns = summarizeRoutePatterns(processRecords);
  const lanePatterns = summarizeLanePatterns(processRecords, events);
  const validationPatterns = summarizeValidationPatterns(processRecords);
  const recurringFailures = summarizeRecurringFailures(processRecords, outcomeRecords);
  const recurringSuccesses = summarizeRecurringSuccesses(processRecords);

  const allTimestamps = [
    ...processRecords.map((record) => record.recordedAt),
    ...outcomeRecords.map((record) => record.recordedAt),
    ...events.map((event) => event.timestamp)
  ].sort((left, right) => left.localeCompare(right));

  const sourceRunIds = [...new Set(events.map((event) => event.run_id).filter((value): value is string => Boolean(value)))].sort((left, right) =>
    left.localeCompare(right)
  );

  const timeWindow = {
    start: allTimestamps[0] ?? new Date(0).toISOString(),
    end: allTimestamps[allTimestamps.length - 1] ?? new Date(0).toISOString()
  };

  const confidence = round4(
    clamp01(
      (processRecords.length > 0 ? 0.35 : 0) +
        (outcomeRecords.length > 0 ? 0.2 : 0) +
        (events.length > 0 ? 0.2 : 0) +
        clamp01(sourceRunIds.length / 5) * 0.15 +
        clamp01((recurringFailures.length + recurringSuccesses.length) / 10) * 0.1
    )
  );

  const openQuestions = computeOpenQuestions({
    processAvailable: Boolean(process),
    outcomeAvailable: Boolean(outcome),
    memoryEventsAvailable: events.length > 0,
    sourceRunIds,
    routePatterns
  });

  const summary: CompactedLearningSummary = {
    summary_id: buildSummaryId(sourceRunIds, timeWindow.start, timeWindow.end),
    source_run_ids: sourceRunIds,
    time_window: timeWindow,
    route_patterns: routePatterns,
    lane_patterns: lanePatterns,
    validation_patterns: validationPatterns,
    recurring_failures: recurringFailures,
    recurring_successes: recurringSuccesses,
    confidence,
    open_questions: openQuestions
  };

  const generatedAt = [process?.generatedAt, outcome?.generatedAt, memoryIndex?.generatedAt]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? new Date(0).toISOString();

  return {
    schemaVersion: LEARNING_COMPACTION_SCHEMA_VERSION,
    kind: 'learning-compaction',
    generatedAt,
    sourceArtifacts: {
      processTelemetry: {
        available: Boolean(process),
        artifactPath: '.playbook/process-telemetry.json',
        recordCount: processRecords.length
      },
      outcomeTelemetry: {
        available: Boolean(outcome),
        artifactPath: '.playbook/outcome-telemetry.json',
        recordCount: outcomeRecords.length
      },
      memoryEvents: {
        available: fs.existsSync(memoryEventsDir),
        artifactPath: '.playbook/memory/events',
        recordCount: events.length
      },
      memoryIndex: {
        available: Boolean(memoryIndex),
        artifactPath: '.playbook/memory/index.json',
        recordCount: memoryIndex?.total_events ?? 0
      }
    },
    summary
  };
};

export const writeLearningCompactionArtifact = (repoRoot: string, artifact: LearningCompactionArtifact): string => {
  const artifactPath = path.join(repoRoot, LEARNING_COMPACTION_RELATIVE_PATH);
  writeDeterministicJsonAtomic(artifactPath, artifact);
  return artifactPath;
};
