import fs from 'node:fs';
import path from 'node:path';

export const MAINTENANCE_PLAN_SCHEMA_VERSION = '1.0' as const;
export const MAINTENANCE_PLAN_RELATIVE_PATH = '.playbook/maintenance-plan.json' as const;

const VERIFY_PATH = '.playbook/verify.json' as const;
const VERIFY_PREFLIGHT_PATH = '.playbook/verify-preflight.json' as const;
const LONGITUDINAL_STATE_PATH = '.playbook/longitudinal-state.json' as const;
const OUTCOME_FEEDBACK_PATH = '.playbook/outcome-feedback.json' as const;
const REMEDIATION_STATUS_PATH = '.playbook/remediation-status.json' as const;
const REMEDIATION_HISTORY_PATH = '.playbook/test-autofix-history.json' as const;

type SourceArtifactPath =
  | typeof VERIFY_PATH
  | typeof VERIFY_PREFLIGHT_PATH
  | typeof LONGITUDINAL_STATE_PATH
  | typeof OUTCOME_FEEDBACK_PATH
  | typeof REMEDIATION_STATUS_PATH
  | typeof REMEDIATION_HISTORY_PATH;

type MaintenanceType =
  | 'docs-audit-maintenance'
  | 'release-governance-drift-reconciliation'
  | 'ignore-cleanup-hygiene-recommendations'
  | 'approved-low-risk-remediation-patterns';

export type MaintenancePlanRow = {
  maintenanceId: string;
  sourceEvidenceRefs: string[];
  maintenanceType: MaintenanceType;
  boundedTargetSurface: string;
  recurrenceTrendRationale: string;
  requiredApprovals: string[];
  confidence: number;
  nextActionText: string;
};

export type MaintenancePlanArtifact = {
  schemaVersion: typeof MAINTENANCE_PLAN_SCHEMA_VERSION;
  kind: 'playbook-maintenance-plan';
  command: 'maintenance-plan';
  proposalOnly: true;
  generatedAt: string;
  sourceArtifacts: Record<'verify' | 'verifyPreflight' | 'longitudinalState' | 'outcomeFeedback' | 'remediationStatus' | 'remediationHistory', SourceArtifactPath>;
  maintenanceRows: MaintenancePlanRow[];
  summary: {
    totalCandidates: number;
    byType: Record<MaintenanceType, number>;
  };
  authority: {
    mutation: 'read-only';
    execution: 'unchanged';
    doctrinePromotion: 'forbidden';
  };
};

type JsonRecord = Record<string, unknown>;

type RecurringCluster = {
  key: string;
  count: number;
  refs: string[];
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const readJson = (repoRoot: string, relativePath: string): JsonRecord | null => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as JsonRecord;
  } catch {
    return null;
  }
};

const readArray = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? value.filter((entry): entry is JsonRecord => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)) : [];

const uniqueSorted = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));

const parseRecurringClusters = (value: unknown): RecurringCluster[] =>
  readArray(value)
    .map((entry) => ({
      key: typeof entry.key === 'string' ? entry.key : '',
      count: typeof entry.count === 'number' ? entry.count : 0,
      refs: uniqueSorted(Array.isArray(entry.refs) ? entry.refs.filter((ref): ref is string => typeof ref === 'string') : [])
    }))
    .filter((entry) => entry.key.length > 0 && entry.count > 0)
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));

const includesAny = (value: string, needles: string[]): boolean => {
  const lower = value.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
};

const toConfidence = (count: number, base = 0.55): number => Number(Math.min(0.95, base + Math.max(0, count - 2) * 0.1).toFixed(2));

const buildCommonApprovals = (longitudinalState: JsonRecord | null): string[] => {
  const governance = longitudinalState && typeof longitudinalState.approvals_governance_refs === 'object'
    ? longitudinalState.approvals_governance_refs as JsonRecord
    : null;
  const requiredFromState = governance ? uniqueSorted(Array.isArray(governance.required) ? governance.required.filter((value): value is string => typeof value === 'string') : []) : [];
  return uniqueSorted(['policy:maintenance-plan-review', 'human:maintainer-approval', ...requiredFromState]);
};

const pushMaintenanceRow = (rows: MaintenancePlanRow[], row: MaintenancePlanRow): void => {
  rows.push({
    ...row,
    sourceEvidenceRefs: uniqueSorted(row.sourceEvidenceRefs),
    requiredApprovals: uniqueSorted(row.requiredApprovals),
    confidence: Number(row.confidence.toFixed(2))
  });
};

const collectDocsAuditMaintenance = (
  rows: MaintenancePlanRow[],
  longitudinalState: JsonRecord | null,
  requiredApprovals: string[]
): void => {
  const recurringEvidence = longitudinalState && typeof longitudinalState.recurring_evidence === 'object'
    ? longitudinalState.recurring_evidence as JsonRecord
    : null;
  const findingClusters = parseRecurringClusters(recurringEvidence?.finding_clusters);
  const docsClusters = findingClusters.filter((cluster) =>
    cluster.count >= 2 && includesAny(cluster.key, ['doc', 'readme', 'notes', 'changelog'])
  );
  if (docsClusters.length === 0) return;

  const dominant = docsClusters[0]!;
  pushMaintenanceRow(rows, {
    maintenanceId: 'maintenance.docs-audit.recurring-findings',
    sourceEvidenceRefs: uniqueSorted([
      LONGITUDINAL_STATE_PATH,
      ...docsClusters.flatMap((cluster) => cluster.refs)
    ]),
    maintenanceType: 'docs-audit-maintenance',
    boundedTargetSurface: 'docs/ governance surfaces and docs audit command outputs',
    recurrenceTrendRationale: `Recurring documentation findings were detected in longitudinal evidence (${docsClusters.map((cluster) => `${cluster.key}:${cluster.count}`).join(', ')}).`,
    requiredApprovals: [...requiredApprovals, 'human:docs-governance-owner'],
    confidence: toConfidence(dominant.count),
    nextActionText: 'Propose a bounded docs maintenance pass (`pnpm playbook docs audit --json`) and queue only explicit doc-governance fixes for review.'
  });
};

const collectReleaseGovernanceMaintenance = (
  rows: MaintenancePlanRow[],
  longitudinalState: JsonRecord | null,
  requiredApprovals: string[]
): void => {
  const recurringEvidence = longitudinalState && typeof longitudinalState.recurring_evidence === 'object'
    ? longitudinalState.recurring_evidence as JsonRecord
    : null;
  const findingClusters = parseRecurringClusters(recurringEvidence?.finding_clusters);
  const releaseClusters = findingClusters.filter((cluster) =>
    cluster.count >= 2 && includesAny(cluster.key, ['release', 'version', 'governance'])
  );
  if (releaseClusters.length === 0) return;

  const dominant = releaseClusters[0]!;
  pushMaintenanceRow(rows, {
    maintenanceId: 'maintenance.release-governance.recurring-drift',
    sourceEvidenceRefs: uniqueSorted([
      LONGITUDINAL_STATE_PATH,
      VERIFY_PATH,
      VERIFY_PREFLIGHT_PATH,
      ...releaseClusters.flatMap((cluster) => cluster.refs)
    ]),
    maintenanceType: 'release-governance-drift-reconciliation',
    boundedTargetSurface: 'release/version governance contracts and verify-preflight compatibility checks',
    recurrenceTrendRationale: `Release-governance drift signals recurred above threshold (${releaseClusters.map((cluster) => `${cluster.key}:${cluster.count}`).join(', ')}).`,
    requiredApprovals: [...requiredApprovals, 'human:release-governance-owner'],
    confidence: toConfidence(dominant.count, 0.6),
    nextActionText: 'Prepare a release-governance reconciliation proposal that is review-gated before any mutation.'
  });
};

const collectIgnoreHygieneMaintenance = (
  rows: MaintenancePlanRow[],
  longitudinalState: JsonRecord | null,
  _outcomeFeedback: JsonRecord | null,
  requiredApprovals: string[]
): void => {
  const recurringEvidence = longitudinalState && typeof longitudinalState.recurring_evidence === 'object'
    ? longitudinalState.recurring_evidence as JsonRecord
    : null;
  const findingClusters = parseRecurringClusters(recurringEvidence?.finding_clusters);
  const ignoreClusters = findingClusters.filter((cluster) =>
    cluster.count >= 2 && includesAny(cluster.key, ['ignore', 'cleanup', 'hygiene'])
  );

  if (ignoreClusters.length === 0) return;
  const dominant = ignoreClusters[0]!;

  pushMaintenanceRow(rows, {
    maintenanceId: 'maintenance.ignore-cleanup.recurring-hygiene',
    sourceEvidenceRefs: uniqueSorted([
      LONGITUDINAL_STATE_PATH,
      OUTCOME_FEEDBACK_PATH,
      ...ignoreClusters.flatMap((cluster) => cluster.refs)
    ]),
    maintenanceType: 'ignore-cleanup-hygiene-recommendations',
    boundedTargetSurface: '.playbookignore recommendations and bounded repo hygiene suggestions',
    recurrenceTrendRationale: `Ignore/cleanup findings are recurring in governed evidence (${ignoreClusters.map((cluster) => `${cluster.key}:${cluster.count}`).join(', ')}).`,
    requiredApprovals: [...requiredApprovals, 'human:repo-hygiene-owner'],
    confidence: toConfidence(dominant.count),
    nextActionText: 'Generate ignore/cleanup hygiene recommendations and keep all resulting changes in proposal-only review.'
  });
};

const collectLowRiskRemediationPatterns = (
  rows: MaintenancePlanRow[],
  remediationStatus: JsonRecord | null,
  remediationHistory: JsonRecord | null,
  requiredApprovals: string[]
): void => {
  const preferredRepairClasses = readArray(remediationStatus?.preferred_repair_classes);
  const blockedSignatures = uniqueSorted(Array.isArray(remediationStatus?.blocked_signatures)
    ? remediationStatus.blocked_signatures.filter((value): value is string => typeof value === 'string')
    : []);
  const reviewRequiredSignatures = uniqueSorted(Array.isArray(remediationStatus?.review_required_signatures)
    ? remediationStatus.review_required_signatures.filter((value): value is string => typeof value === 'string')
    : []);

  const acceptedClasses = preferredRepairClasses
    .map((entry) => ({
      repairClass: typeof entry.repair_class === 'string' ? entry.repair_class : '',
      successCount: typeof entry.success_count === 'number' ? entry.success_count : 0,
      signatures: uniqueSorted(Array.isArray(entry.failure_signatures) ? entry.failure_signatures.filter((value): value is string => typeof value === 'string') : [])
    }))
    .filter((entry) =>
      entry.repairClass.length > 0
      && entry.successCount >= 2
      && entry.signatures.every((signature) => !blockedSignatures.includes(signature) && !reviewRequiredSignatures.includes(signature))
    )
    .sort((left, right) => right.successCount - left.successCount || left.repairClass.localeCompare(right.repairClass));

  const runs = readArray(remediationHistory?.runs);
  if (acceptedClasses.length === 0 || runs.length === 0) return;

  const top = acceptedClasses[0]!;
  pushMaintenanceRow(rows, {
    maintenanceId: `maintenance.remediation.low-risk.${top.repairClass.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    sourceEvidenceRefs: uniqueSorted([
      REMEDIATION_STATUS_PATH,
      REMEDIATION_HISTORY_PATH,
      ...top.signatures.map((signature) => `signature:${signature}`)
    ]),
    maintenanceType: 'approved-low-risk-remediation-patterns',
    boundedTargetSurface: 'existing approved low-risk remediation classes only (proposal-only)',
    recurrenceTrendRationale: `Repair class ${top.repairClass} has repeated successful outcomes (${top.successCount}) with no current blocked/review-required signature overlap.`,
    requiredApprovals: [...requiredApprovals, 'human:remediation-owner'],
    confidence: toConfidence(top.successCount, 0.65),
    nextActionText: 'Propose a recurring low-risk remediation plan limited to previously approved repair classes and keep execution disabled in this phase.'
  });
};

export const readMaintenancePlan = (repoRoot: string): MaintenancePlanArtifact => {
  readJson(repoRoot, VERIFY_PATH);
  readJson(repoRoot, VERIFY_PREFLIGHT_PATH);
  const longitudinalState = readJson(repoRoot, LONGITUDINAL_STATE_PATH);
  const outcomeFeedback = readJson(repoRoot, OUTCOME_FEEDBACK_PATH);
  const remediationStatus = readJson(repoRoot, REMEDIATION_STATUS_PATH);
  const remediationHistory = readJson(repoRoot, REMEDIATION_HISTORY_PATH);

  const rows: MaintenancePlanRow[] = [];
  const requiredApprovals = buildCommonApprovals(longitudinalState);
  collectDocsAuditMaintenance(rows, longitudinalState, requiredApprovals);
  collectReleaseGovernanceMaintenance(rows, longitudinalState, requiredApprovals);
  collectIgnoreHygieneMaintenance(rows, longitudinalState, outcomeFeedback, requiredApprovals);
  collectLowRiskRemediationPatterns(rows, remediationStatus, remediationHistory, requiredApprovals);

  const maintenanceRows = [...rows].sort((left, right) => left.maintenanceId.localeCompare(right.maintenanceId));
  const byType: Record<MaintenanceType, number> = {
    'docs-audit-maintenance': maintenanceRows.filter((row) => row.maintenanceType === 'docs-audit-maintenance').length,
    'release-governance-drift-reconciliation': maintenanceRows.filter((row) => row.maintenanceType === 'release-governance-drift-reconciliation').length,
    'ignore-cleanup-hygiene-recommendations': maintenanceRows.filter((row) => row.maintenanceType === 'ignore-cleanup-hygiene-recommendations').length,
    'approved-low-risk-remediation-patterns': maintenanceRows.filter((row) => row.maintenanceType === 'approved-low-risk-remediation-patterns').length
  };

  return {
    schemaVersion: MAINTENANCE_PLAN_SCHEMA_VERSION,
    kind: 'playbook-maintenance-plan',
    command: 'maintenance-plan',
    proposalOnly: true,
    generatedAt: new Date(0).toISOString(),
    sourceArtifacts: {
      verify: VERIFY_PATH,
      verifyPreflight: VERIFY_PREFLIGHT_PATH,
      longitudinalState: LONGITUDINAL_STATE_PATH,
      outcomeFeedback: OUTCOME_FEEDBACK_PATH,
      remediationStatus: REMEDIATION_STATUS_PATH,
      remediationHistory: REMEDIATION_HISTORY_PATH
    },
    maintenanceRows,
    summary: {
      totalCandidates: maintenanceRows.length,
      byType
    },
    authority: {
      mutation: 'read-only',
      execution: 'unchanged',
      doctrinePromotion: 'forbidden'
    }
  };
};

export const writeMaintenancePlan = (repoRoot: string): MaintenancePlanArtifact => {
  const artifact = readMaintenancePlan(repoRoot);
  const absolutePath = path.join(repoRoot, MAINTENANCE_PLAN_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, deterministicStringify(artifact), 'utf8');
  return artifact;
};
