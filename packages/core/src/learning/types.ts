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

export interface PortabilityConfidenceRecalibrationSummary {
  source_pattern_family: string;
  source_repo: string;
  target_repo: string;
  prior_confidence_average: number;
  realized_success_rate: number;
  recalibrated_confidence: number;
  recommended_adjustment: number;
  sample_size: number;
  open_questions: string[];
}

export type PortabilityDecisionStatus = 'proposed' | 'reviewed' | 'accepted' | 'rejected' | 'superseded';

export type PortabilityAdoptionStatus = 'proposed' | 'reviewed' | 'accepted' | 'rejected' | 'adopted' | 'superseded';

export type PortabilityObservedOutcome = 'successful' | 'unsuccessful' | 'inconclusive';

export interface PortabilityOutcomeTelemetryRecord {
  recommendation_id: string;
  pattern_id: string;
  source_repo: string;
  target_repo: string;
  decision_status: PortabilityDecisionStatus;
  decision_reason?: string;
  adoption_status?: PortabilityAdoptionStatus;
  observed_outcome?: PortabilityObservedOutcome;
  outcome_confidence?: number;
  timestamp: string;
}


export type TransferPlanGatingTier = 'CONVERSATIONAL' | 'GOVERNANCE';

export interface TransferPlanRecord {
  transfer_plan_id: string;
  pattern_id: string;
  source_repo: string;
  target_repo: string;
  portability_confidence: number;
  target_readiness: number;
  touched_subsystems: string[];
  required_artifacts: string[];
  required_validations: string[];
  adoption_steps: string[];
  risk_signals: string[];
  blockers: string[];
  open_questions: string[];
  gating_tier: TransferPlanGatingTier;
}

export interface TransferPlanArtifact {
  schemaVersion: '1.0';
  kind: 'transfer-plans';
  generatedAt: string;
  proposalOnly: true;
  nonAutonomous: true;
  sourceArtifacts: {
    patternPortabilityPath: string;
    crossRepoPatternsPath: string;
    portabilityConfidencePath: string;
    routerRecommendationsPath: string;
    learningCompactionPath: string;
  };
  plans: TransferPlanRecord[];
}
