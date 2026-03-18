export type WorkflowPromotionValidationStatus = 'passed' | 'blocked';
export type WorkflowPromotionStatus = 'promoted' | 'blocked';

export type WorkflowPromotion = {
  schemaVersion: '1.0';
  kind: 'workflow-promotion';
  workflow_kind: string;
  staged_generation: true;
  candidate_artifact_path: string;
  staged_artifact_path: string;
  committed_target_path: string;
  validation_status: WorkflowPromotionValidationStatus;
  validation_passed: boolean;
  promotion_status: WorkflowPromotionStatus;
  promoted: boolean;
  committed_state_preserved: boolean;
  blocked_reason: string | null;
  error_summary: string | null;
  generated_at: string;
  summary: string;
};
