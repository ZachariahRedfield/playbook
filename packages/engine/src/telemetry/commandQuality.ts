import path from 'node:path';
import {
  type CommandExecutionQualityArtifact,
  type CommandExecutionQualityRecord,
  type CommandExecutionQualitySummary,
  type CommandSuccessStatus
} from '@zachariahredfield/playbook-core';
import { readJsonIfExists, writeDeterministicJsonAtomic } from '../learning/io.js';

export const COMMAND_EXECUTION_QUALITY_SCHEMA_VERSION = '1.0' as const;
export const COMMAND_EXECUTION_QUALITY_RELATIVE_PATH = '.playbook/telemetry/command-quality.json' as const;

export type CommandExecutionQualityInput = Omit<CommandExecutionQualityRecord, 'recorded_at'> & {
  recorded_at?: string;
};

const sortStrings = (values: string[]): string[] => [...new Set(values.filter((value) => value.trim().length > 0))].sort((a, b) => a.localeCompare(b));
const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeStatus = (value: string): CommandSuccessStatus => {
  if (value === 'success' || value === 'failure' || value === 'partial') return value;
  return 'failure';
};

const normalizeRecord = (record: CommandExecutionQualityInput): CommandExecutionQualityRecord => ({
  command_name: record.command_name.trim(),
  run_id: record.run_id.trim(),
  recorded_at: record.recorded_at ?? new Date().toISOString(),
  inputs_summary: record.inputs_summary.trim(),
  artifacts_read: sortStrings(record.artifacts_read),
  artifacts_written: sortStrings(record.artifacts_written),
  success_status: normalizeStatus(record.success_status),
  duration_ms: Math.max(0, Math.round(record.duration_ms)),
  warnings_count: Math.max(0, Math.trunc(record.warnings_count)),
  open_questions_count: Math.max(0, Math.trunc(record.open_questions_count)),
  confidence_score: round4(clamp01(record.confidence_score)),
  downstream_artifacts_produced: sortStrings(record.downstream_artifacts_produced)
});

const compareRecords = (left: CommandExecutionQualityRecord, right: CommandExecutionQualityRecord): number =>
  left.recorded_at.localeCompare(right.recorded_at)
  || left.command_name.localeCompare(right.command_name)
  || left.run_id.localeCompare(right.run_id);

export const summarizeCommandExecutionQuality = (records: CommandExecutionQualityRecord[]): CommandExecutionQualitySummary => {
  const totalRuns = records.length;
  const successRuns = records.filter((record) => record.success_status === 'success').length;
  const failureRuns = records.filter((record) => record.success_status === 'failure').length;
  const partialRuns = records.filter((record) => record.success_status === 'partial').length;
  const totalDuration = records.reduce((sum, record) => sum + record.duration_ms, 0);
  const totalConfidence = records.reduce((sum, record) => sum + record.confidence_score, 0);
  const totalWarnings = records.reduce((sum, record) => sum + record.warnings_count, 0);
  const totalOpenQuestions = records.reduce((sum, record) => sum + record.open_questions_count, 0);

  return {
    total_runs: totalRuns,
    success_runs: successRuns,
    failure_runs: failureRuns,
    partial_runs: partialRuns,
    average_duration_ms: totalRuns === 0 ? 0 : Math.round(totalDuration / totalRuns),
    average_confidence_score: totalRuns === 0 ? 0 : round4(totalConfidence / totalRuns),
    total_warnings: totalWarnings,
    total_open_questions: totalOpenQuestions
  };
};

export const normalizeCommandExecutionQualityArtifact = (
  artifact: Partial<CommandExecutionQualityArtifact> | undefined
): CommandExecutionQualityArtifact => {
  const records = Array.isArray(artifact?.records)
    ? artifact.records
      .map((record) => normalizeRecord({
        command_name: typeof record.command_name === 'string' ? record.command_name : 'unknown',
        run_id: typeof record.run_id === 'string' ? record.run_id : 'unknown',
        recorded_at: typeof record.recorded_at === 'string' ? record.recorded_at : undefined,
        inputs_summary: typeof record.inputs_summary === 'string' ? record.inputs_summary : '',
        artifacts_read: Array.isArray(record.artifacts_read) ? record.artifacts_read.filter((entry): entry is string => typeof entry === 'string') : [],
        artifacts_written: Array.isArray(record.artifacts_written) ? record.artifacts_written.filter((entry): entry is string => typeof entry === 'string') : [],
        success_status: typeof record.success_status === 'string' ? record.success_status : 'failure',
        duration_ms: typeof record.duration_ms === 'number' ? record.duration_ms : 0,
        warnings_count: typeof record.warnings_count === 'number' ? record.warnings_count : 0,
        open_questions_count: typeof record.open_questions_count === 'number' ? record.open_questions_count : 0,
        confidence_score: typeof record.confidence_score === 'number' ? record.confidence_score : 0,
        downstream_artifacts_produced: Array.isArray(record.downstream_artifacts_produced)
          ? record.downstream_artifacts_produced.filter((entry): entry is string => typeof entry === 'string')
          : []
      }))
      .sort(compareRecords)
    : [];

  return {
    schemaVersion: COMMAND_EXECUTION_QUALITY_SCHEMA_VERSION,
    kind: 'command-execution-quality',
    generatedAt: typeof artifact?.generatedAt === 'string' ? artifact.generatedAt : new Date(0).toISOString(),
    records,
    summary: summarizeCommandExecutionQuality(records)
  };
};

export const readCommandExecutionQualityArtifact = (repoRoot: string): CommandExecutionQualityArtifact => {
  const artifactPath = path.join(repoRoot, COMMAND_EXECUTION_QUALITY_RELATIVE_PATH);
  const existing = readJsonIfExists<CommandExecutionQualityArtifact>(artifactPath);
  return normalizeCommandExecutionQualityArtifact(existing);
};

export const appendCommandExecutionQualityRecord = (
  repoRoot: string,
  input: CommandExecutionQualityInput
): CommandExecutionQualityArtifact => {
  const artifactPath = path.join(repoRoot, COMMAND_EXECUTION_QUALITY_RELATIVE_PATH);
  const current = readCommandExecutionQualityArtifact(repoRoot);
  const record = normalizeRecord(input);
  const records = [...current.records, record].sort(compareRecords);

  const next: CommandExecutionQualityArtifact = {
    schemaVersion: COMMAND_EXECUTION_QUALITY_SCHEMA_VERSION,
    kind: 'command-execution-quality',
    generatedAt: record.recorded_at,
    records,
    summary: summarizeCommandExecutionQuality(records)
  };

  writeDeterministicJsonAtomic(artifactPath, next);
  return next;
};
