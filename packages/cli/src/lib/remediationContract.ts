export type RemediationStatus = 'ready' | 'not_needed' | 'unavailable';

export type PlanRemediation = {
  status: RemediationStatus;
  totalSteps: number;
  unresolvedFailures: number;
  reason?: string;
};

export type PlanJsonResult = {
  schemaVersion: '1.0';
  command: 'plan';
  ok: boolean;
  exitCode: number;
  verify: {
    ok: boolean;
    summary: {
      failures: number;
      warnings: number;
    };
    failures: unknown[];
    warnings: unknown[];
  };
  remediation: PlanRemediation;
  tasks: unknown[];
};

export type RemediationDerivationInput = {
  findingCount: number;
  stepCount: number;
  unresolvedFindingCount?: number;
  unavailableReason?: string;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const buildPlanRemediation = ({
  findingCount,
  stepCount,
  unresolvedFindingCount,
  unavailableReason
}: RemediationDerivationInput): PlanRemediation => {
  if (findingCount === 0) {
    return {
      status: 'not_needed',
      totalSteps: stepCount,
      unresolvedFailures: 0,
      reason: 'No verify failures were detected.'
    };
  }

  if (stepCount === 0) {
    return {
      status: 'unavailable',
      totalSteps: stepCount,
      unresolvedFailures: unresolvedFindingCount ?? findingCount,
      reason: unavailableReason ?? 'Verify failures were detected but no remediation tasks are currently available.'
    };
  }

  return {
    status: 'ready',
    totalSteps: stepCount,
    unresolvedFailures: unresolvedFindingCount ?? Math.max(0, findingCount - stepCount)
  };
};

export const parsePlanRemediation = (value: unknown): PlanRemediation => {
  if (!isObject(value)) {
    throw new Error('Plan JSON contract is missing remediation object.');
  }

  const status = value.status;
  const totalSteps = value.totalSteps;
  const unresolvedFailures = value.unresolvedFailures;

  if (status !== 'ready' && status !== 'not_needed' && status !== 'unavailable') {
    throw new Error('Plan JSON contract has invalid remediation.status.');
  }

  if (typeof totalSteps !== 'number' || !Number.isInteger(totalSteps) || totalSteps < 0) {
    throw new Error('Plan JSON contract has invalid remediation.totalSteps.');
  }

  if (typeof unresolvedFailures !== 'number' || !Number.isInteger(unresolvedFailures) || unresolvedFailures < 0) {
    throw new Error('Plan JSON contract has invalid remediation.unresolvedFailures.');
  }

  const reason = value.reason;
  if (reason !== undefined && typeof reason !== 'string') {
    throw new Error('Plan JSON contract has invalid remediation.reason.');
  }

  return {
    status,
    totalSteps,
    unresolvedFailures,
    reason
  };
};

export const remediationToApplyPrecondition = (
  remediation: PlanRemediation
): { action: 'proceed' | 'no_op' | 'fail'; message: string } => {
  if (remediation.status === 'ready') {
    return {
      action: 'proceed',
      message: 'Plan remediation is ready. Applying available tasks.'
    };
  }

  if (remediation.status === 'not_needed') {
    return {
      action: 'no_op',
      message: remediation.reason ?? 'No remediation is needed. Apply is a no-op.'
    };
  }

  return {
    action: 'fail',
    message: remediation.reason ?? 'Remediation is unavailable for the current verify failures.'
  };
};
