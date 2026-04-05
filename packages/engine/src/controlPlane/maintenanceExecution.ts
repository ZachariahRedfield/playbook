import fs from 'node:fs';
import path from 'node:path';
import type { MaintenancePlanArtifact, MaintenancePlanRow } from './maintenancePlan.js';

export const MAINTENANCE_APPROVALS_RELATIVE_PATH = '.playbook/maintenance-approvals.json' as const;
export const MAINTENANCE_EXECUTION_RECEIPT_RELATIVE_PATH = '.playbook/maintenance-execution-receipt.json' as const;
export const MAINTENANCE_EXECUTION_STATE_RELATIVE_PATH = '.playbook/maintenance-execution-state.json' as const;

export type MaintenanceApprovalArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-maintenance-approvals';
  generatedAt: string;
  approvals: Array<{
    maintenanceId: string;
    approved: true;
    approvalRef: string;
    approvedBy: string;
    boundedTargetSurface: string;
  }>;
};

type PolicyDecision = 'safe' | 'requires_review' | 'blocked';

export type MaintenanceExecutionOutcome = {
  taskId: string;
  maintenanceId: string;
  maintenanceType: MaintenancePlanRow['maintenanceType'];
  command: string;
  status: 'executed' | 'failed';
  boundedTargetSurface: string;
  approvalRef: string;
  policyRef: string;
  sourceEvidenceRefs: string[];
  exitCode: number;
  message: string;
};

export type MaintenanceExecutionReceipt = {
  schemaVersion: '1.0';
  kind: 'playbook-maintenance-execution-receipt';
  generatedAt: string;
  sourcePlan: string;
  sourceApprovals: string;
  sourcePolicy: string;
  summary: {
    executed: number;
    failed: number;
    total: number;
  };
  outcomes: MaintenanceExecutionOutcome[];
};

export type MaintenanceExecutionState = {
  schemaVersion: '1.0';
  kind: 'playbook-maintenance-execution-state';
  updatedAt: string;
  lastReceiptPath: typeof MAINTENANCE_EXECUTION_RECEIPT_RELATIVE_PATH;
  runs: Array<{
    maintenanceId: string;
    taskId: string;
    status: 'executed' | 'failed';
    executedAt: string;
    approvalRef: string;
    policyRef: string;
  }>;
};

export type MaintenanceExecutionTask = {
  id: string;
  maintenanceId: string;
  maintenanceType: MaintenancePlanRow['maintenanceType'];
  command: string;
  boundedTargetSurface: string;
  sourceEvidenceRefs: string[];
  approvalRef: string;
  policyRef: string;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const allowedTypes = new Set<MaintenancePlanRow['maintenanceType']>([
  'docs-audit-maintenance',
  'release-governance-drift-reconciliation',
  'ignore-cleanup-hygiene-recommendations',
  'approved-low-risk-remediation-patterns'
]);

const maintenanceCommandForType = (type: MaintenancePlanRow['maintenanceType']): string => {
  switch (type) {
    case 'docs-audit-maintenance':
      return 'pnpm playbook docs audit --json';
    case 'release-governance-drift-reconciliation':
      return 'pnpm playbook release plan --json --out .playbook/release-plan.json';
    case 'ignore-cleanup-hygiene-recommendations':
      return 'pnpm playbook ignore suggest --repo . --json';
    case 'approved-low-risk-remediation-patterns':
      return 'pnpm playbook remediation-status --json';
  }
};

const assertApprovalArtifact = (value: unknown, sourcePath: string): MaintenanceApprovalArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid maintenance approvals artifact at ${sourcePath}: expected object payload.`);
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== '1.0' || record.kind !== 'playbook-maintenance-approvals' || !Array.isArray(record.approvals)) {
    throw new Error(`Invalid maintenance approvals artifact at ${sourcePath}: expected schemaVersion=1.0, kind=playbook-maintenance-approvals, and approvals[].`);
  }
  return record as MaintenanceApprovalArtifact;
};

export const parseMaintenanceApprovals = (text: string, sourcePath: string): MaintenanceApprovalArtifact => {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid maintenance approvals JSON in ${sourcePath}: ${message}`);
  }
  return assertApprovalArtifact(payload, sourcePath);
};

export const buildApprovedMaintenanceTasks = (
  maintenancePlan: MaintenancePlanArtifact,
  approvals: MaintenanceApprovalArtifact,
  policyEvaluations: Array<{ proposal_id: string; decision: PolicyDecision; reason: string }>,
  options: { repoRoot: string }
): MaintenanceExecutionTask[] => {
  const approvalsById = new Map(approvals.approvals.map((entry) => [entry.maintenanceId, entry]));
  const policyByProposalId = new Map(policyEvaluations.map((entry) => [entry.proposal_id, entry]));

  const tasks: MaintenanceExecutionTask[] = [];

  for (const row of maintenancePlan.maintenanceRows) {
    if (!allowedTypes.has(row.maintenanceType)) {
      throw new Error(`Maintenance row ${row.maintenanceId} uses unsupported maintenance type ${row.maintenanceType}.`);
    }

    const approval = approvalsById.get(row.maintenanceId);
    if (!approval || !approval.approved) {
      throw new Error(`Maintenance row ${row.maintenanceId} is blocked: explicit approval is missing.`);
    }

    if (approval.boundedTargetSurface !== row.boundedTargetSurface) {
      throw new Error(`Maintenance row ${row.maintenanceId} is blocked: approval bounded surface does not match plan surface.`);
    }

    const policyProposalId = `maintenance:${row.maintenanceId}`;
    const policy = policyByProposalId.get(policyProposalId);
    if (!policy) {
      throw new Error(`Maintenance row ${row.maintenanceId} is blocked: missing policy evaluation entry ${policyProposalId}.`);
    }
    if (policy.decision !== 'safe') {
      throw new Error(`Maintenance row ${row.maintenanceId} is blocked: policy decision is ${policy.decision}.`);
    }

    for (const evidenceRef of row.sourceEvidenceRefs) {
      if (!evidenceRef.startsWith('.playbook/')) continue;
      const evidencePath = path.join(options.repoRoot, evidenceRef);
      if (!fs.existsSync(evidencePath)) {
        throw new Error(`Maintenance row ${row.maintenanceId} is blocked: required evidence is missing (${evidenceRef}).`);
      }
    }

    tasks.push({
      id: `maintenance:${row.maintenanceId}`,
      maintenanceId: row.maintenanceId,
      maintenanceType: row.maintenanceType,
      command: maintenanceCommandForType(row.maintenanceType),
      boundedTargetSurface: row.boundedTargetSurface,
      sourceEvidenceRefs: uniqueSorted(row.sourceEvidenceRefs),
      approvalRef: approval.approvalRef,
      policyRef: policyProposalId
    });
  }

  return tasks.sort((a, b) => a.id.localeCompare(b.id));
};

export const writeMaintenanceExecutionArtifacts = (
  repoRoot: string,
  input: {
    sourcePlan: string;
    sourceApprovals: string;
    sourcePolicy: string;
    outcomes: MaintenanceExecutionOutcome[];
  }
): { receipt: MaintenanceExecutionReceipt; state: MaintenanceExecutionState } => {
  const outcomes = [...input.outcomes].sort((a, b) => a.taskId.localeCompare(b.taskId));
  const now = new Date(0).toISOString();
  const receipt: MaintenanceExecutionReceipt = {
    schemaVersion: '1.0',
    kind: 'playbook-maintenance-execution-receipt',
    generatedAt: now,
    sourcePlan: input.sourcePlan,
    sourceApprovals: input.sourceApprovals,
    sourcePolicy: input.sourcePolicy,
    summary: {
      executed: outcomes.filter((entry) => entry.status === 'executed').length,
      failed: outcomes.filter((entry) => entry.status === 'failed').length,
      total: outcomes.length
    },
    outcomes
  };

  const state: MaintenanceExecutionState = {
    schemaVersion: '1.0',
    kind: 'playbook-maintenance-execution-state',
    updatedAt: now,
    lastReceiptPath: MAINTENANCE_EXECUTION_RECEIPT_RELATIVE_PATH,
    runs: outcomes.map((entry) => ({
      maintenanceId: entry.maintenanceId,
      taskId: entry.taskId,
      status: entry.status,
      executedAt: now,
      approvalRef: entry.approvalRef,
      policyRef: entry.policyRef
    }))
  };

  const receiptPath = path.join(repoRoot, MAINTENANCE_EXECUTION_RECEIPT_RELATIVE_PATH);
  const statePath = path.join(repoRoot, MAINTENANCE_EXECUTION_STATE_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, deterministicStringify(receipt), 'utf8');
  fs.writeFileSync(statePath, deterministicStringify(state), 'utf8');

  return { receipt, state };
};
