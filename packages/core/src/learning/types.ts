export interface LearningCompactionTimeWindow {
  start: string;
  end: string;
}

export interface LearningRoutePattern {
  route_id: string;
  task_family: string;
  observation_count: number;
  avg_retry_count: number;
  first_pass_rate: number;
}

export interface LearningLanePattern {
  lane_shape: string;
  success_count: number;
  failure_count: number;
  success_rate: number;
}

export interface LearningValidationPattern {
  validation_key: string;
  observation_count: number;
  bottleneck_rate: number;
  avg_duration_ms: number;
}

export interface LearningRecurringSignal {
  signal_id: string;
  family: string;
  evidence_count: number;
  confidence: number;
}

export interface CompactedLearningSummary {
  summary_id: string;
  source_run_ids: string[];
  time_window: LearningCompactionTimeWindow;
  route_patterns: LearningRoutePattern[];
  lane_patterns: LearningLanePattern[];
  validation_patterns: LearningValidationPattern[];
  recurring_failures: LearningRecurringSignal[];
  recurring_successes: LearningRecurringSignal[];
  confidence: number;
  open_questions: string[];
}

export interface PatternPortabilityScore {
  pattern_id: string;
  source_repo: string;
  target_repo: string;
  evidence_runs: number;
  structural_similarity: number;
  dependency_compatibility: number;
  governance_risk: number;
  confidence_score: number;
}
