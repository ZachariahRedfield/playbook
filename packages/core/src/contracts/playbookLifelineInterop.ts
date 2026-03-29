export const PLAYBOOK_LIFELINE_INTEROP_SCHEMA_VERSION = '1.0' as const;
export const PLAYBOOK_LIFELINE_INTEROP_ARTIFACT_KIND = 'playbook-lifeline-interop-runtime' as const;

export const remediationInteropActionKinds = [
  'adjust_upcoming_workout_load',
  'schedule_recovery_block',
  'revise_weekly_goal_plan'
] as const;
export type RemediationInteropActionKind = (typeof remediationInteropActionKinds)[number];
export const fitnessInteropReceiptTypes = [
  'schedule_adjustment_applied',
  'recovery_guardrail_applied',
  'goal_plan_amended'
] as const;
export type FitnessInteropReceiptType = (typeof fitnessInteropReceiptTypes)[number];

export const interopRequestStates = ['pending', 'running', 'failed', 'completed', 'blocked'] as const;
export type InteropRequestState = (typeof interopRequestStates)[number];

export type FitnessActionRoutingMetadata = {
  topic: string;
  must_route_through_playbook_plan: boolean;
  no_direct_lifeline_bypass: boolean;
};

export type InteropCapabilityRegistration = {
  capability_id: string;
  action_kind: RemediationInteropActionKind;
  receipt_type: FitnessInteropReceiptType;
  routing: FitnessActionRoutingMetadata;
  version: string;
  registered_at: string;
  runtime_id: string;
  idempotency_key_prefix: string;
};

export type InteropBlockedReason = {
  reason_code: string;
  reason: string;
  rejected: boolean;
  blocked_at: string;
};

export type InteropRetryState = {
  attempts: number;
  max_attempts: number;
  reconcile_token: string;
  last_attempt_at: string | null;
  next_retry_at: string | null;
};

export type InteropActionRequest = {
  request_id: string;
  remediation_id: string;
  action_kind: RemediationInteropActionKind;
  receipt_type: FitnessInteropReceiptType;
  routing: FitnessActionRoutingMetadata;
  capability_id: string;
  created_at: string;
  updated_at: string;
  request_state: InteropRequestState;
  idempotency_key: string;
  rendezvous_manifest_path: string;
  rendezvous_manifest_sha256: string;
  bounded_inputs: string[];
  blocked_reason: InteropBlockedReason | null;
  retry: InteropRetryState;
};

export type InteropActionStatus = {
  request_id: string;
  request_state: InteropRequestState;
  updated_at: string;
  detail: string;
};

export type InteropExecutionReceipt = {
  receipt_id: string;
  request_id: string;
  runtime_id: string;
  action_kind: RemediationInteropActionKind;
  receipt_type: FitnessInteropReceiptType;
  routing: FitnessActionRoutingMetadata;
  received_at: string;
  completed_at: string;
  outcome: 'completed' | 'failed' | 'blocked';
  output_artifact_path: string | null;
  output_sha256: string | null;
  detail: string;
};

export type InteropHeartbeatSnapshot = {
  runtime_id: string;
  observed_at: string;
  health: 'healthy' | 'degraded' | 'offline';
  active_request_id: string | null;
  pending_requests: number;
  completed_requests: number;
};

export type PlaybookLifelineInteropRuntimeArtifact = {
  schemaVersion: typeof PLAYBOOK_LIFELINE_INTEROP_SCHEMA_VERSION;
  kind: typeof PLAYBOOK_LIFELINE_INTEROP_ARTIFACT_KIND;
  generatedAt: string;
  capabilities: InteropCapabilityRegistration[];
  requests: InteropActionRequest[];
  statuses: InteropActionStatus[];
  receipts: InteropExecutionReceipt[];
  heartbeat: InteropHeartbeatSnapshot | null;
};
