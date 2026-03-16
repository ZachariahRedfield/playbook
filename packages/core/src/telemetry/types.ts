export interface LaneOutcomeScore {
  lane_id: string;
  execution_duration: number;
  retry_count: number;
  success_rate: number;
  score: number;
}

export interface RouterAccuracyMetric {
  route_id: string;
  task_family: string;
  predicted_parallel_lanes: number;
  actual_parallel_lanes: number;
  predicted_validation_cost: number;
  actual_validation_cost: number;
  router_fit_score: number;
}

export type CommandSuccessStatus = 'success' | 'failure' | 'partial';

export interface CommandExecutionQualityRecord {
  command_name: string;
  run_id: string;
  recorded_at: string;
  inputs_summary: string;
  artifacts_read: string[];
  artifacts_written: string[];
  success_status: CommandSuccessStatus;
  duration_ms: number;
  warnings_count: number;
  open_questions_count: number;
  confidence_score: number;
  downstream_artifacts_produced: string[];
}

export interface CommandExecutionQualitySummary {
  total_runs: number;
  success_runs: number;
  failure_runs: number;
  partial_runs: number;
  average_duration_ms: number;
  average_confidence_score: number;
  total_warnings: number;
  total_open_questions: number;
}

export interface CommandExecutionQualityArtifact {
  schemaVersion: '1.0';
  kind: 'command-execution-quality';
  generatedAt: string;
  records: CommandExecutionQualityRecord[];
  summary: CommandExecutionQualitySummary;
}
