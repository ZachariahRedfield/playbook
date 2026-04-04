import fs from 'node:fs';
import path from 'node:path';

type UnresolvedRiskSummary = {
  total_open: number;
  high: number;
  medium: number;
  low: number;
};

type RecurringFindingClusterSummary = {
  cluster_id: string;
  occurrences: number;
  unresolved: number;
};

type VerificationLineageSummary = {
  latest_verification_ref: string | null;
  latest_verified_at: string | null;
  latest_approval_refs: string[];
};

type KnowledgeLifecycleSummary = {
  candidate: number;
  promoted: number;
  superseded: number;
};

export type LongitudinalStateSummary = {
  unresolved_risk_summary: UnresolvedRiskSummary;
  recurring_finding_clusters: RecurringFindingClusterSummary[];
  verification_lineage: VerificationLineageSummary;
  knowledge_lifecycle_summary: KnowledgeLifecycleSummary;
};

const DEFAULT_SUMMARY: LongitudinalStateSummary = {
  unresolved_risk_summary: { total_open: 0, high: 0, medium: 0, low: 0 },
  recurring_finding_clusters: [],
  verification_lineage: {
    latest_verification_ref: null,
    latest_verified_at: null,
    latest_approval_refs: []
  },
  knowledge_lifecycle_summary: {
    candidate: 0,
    promoted: 0,
    superseded: 0
  }
};

const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const toText = (value: unknown): string | null => (typeof value === 'string' && value.trim().length > 0 ? value : null);
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).sort((a, b) => a.localeCompare(b)) : [];

export const readLongitudinalStateSummary = (
  cwd: string,
  hints?: { knowledgeLifecycleSummary?: Partial<KnowledgeLifecycleSummary> }
): LongitudinalStateSummary => {
  const filePath = path.join(cwd, '.playbook', 'longitudinal-state.json');
  const payload = fs.existsSync(filePath)
    ? (JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>)
    : {};

  const unresolvedRecord = (payload.unresolved_risk_summary ?? payload.unresolvedRiskSummary ?? {}) as Record<string, unknown>;
  const recurring = (payload.recurring_finding_clusters ?? payload.recurringFindingClusters ?? []) as Array<Record<string, unknown>>;
  const verification = (payload.verification_lineage ?? payload.verificationLineage ?? {}) as Record<string, unknown>;
  const lifecycle = (payload.knowledge_lifecycle_summary ?? payload.knowledgeLifecycleSummary ?? {}) as Record<string, unknown>;

  const summary: LongitudinalStateSummary = {
    unresolved_risk_summary: {
      total_open: toNumber(unresolvedRecord.total_open ?? unresolvedRecord.totalOpen),
      high: toNumber(unresolvedRecord.high),
      medium: toNumber(unresolvedRecord.medium),
      low: toNumber(unresolvedRecord.low)
    },
    recurring_finding_clusters: recurring
      .map((entry) => ({
        cluster_id: toText(entry.cluster_id ?? entry.clusterId) ?? 'unknown',
        occurrences: toNumber(entry.occurrences),
        unresolved: toNumber(entry.unresolved)
      }))
      .filter((entry) => entry.cluster_id !== 'unknown' || entry.occurrences > 0 || entry.unresolved > 0)
      .sort((a, b) => (b.occurrences - a.occurrences) || a.cluster_id.localeCompare(b.cluster_id)),
    verification_lineage: {
      latest_verification_ref: toText(verification.latest_verification_ref ?? verification.latestVerificationRef),
      latest_verified_at: toText(verification.latest_verified_at ?? verification.latestVerifiedAt),
      latest_approval_refs: toStringArray(verification.latest_approval_refs ?? verification.latestApprovalRefs)
    },
    knowledge_lifecycle_summary: {
      candidate: toNumber(lifecycle.candidate),
      promoted: toNumber(lifecycle.promoted),
      superseded: toNumber(lifecycle.superseded)
    }
  };

  const hinted = hints?.knowledgeLifecycleSummary;
  if (hinted) {
    summary.knowledge_lifecycle_summary = {
      candidate: summary.knowledge_lifecycle_summary.candidate || toNumber(hinted.candidate),
      promoted: summary.knowledge_lifecycle_summary.promoted || toNumber(hinted.promoted),
      superseded: summary.knowledge_lifecycle_summary.superseded || toNumber(hinted.superseded)
    };
  }

  return {
    ...DEFAULT_SUMMARY,
    ...summary,
    unresolved_risk_summary: {
      ...DEFAULT_SUMMARY.unresolved_risk_summary,
      ...summary.unresolved_risk_summary
    },
    verification_lineage: {
      ...DEFAULT_SUMMARY.verification_lineage,
      ...summary.verification_lineage
    },
    knowledge_lifecycle_summary: {
      ...DEFAULT_SUMMARY.knowledge_lifecycle_summary,
      ...summary.knowledge_lifecycle_summary
    }
  };
};

export const formatLongitudinalThinText = (summary: LongitudinalStateSummary): string =>
  `longitudinal open_risk=${summary.unresolved_risk_summary.total_open} recurring_clusters=${summary.recurring_finding_clusters.length} approvals=${summary.verification_lineage.latest_approval_refs.length} lifecycle=candidate:${summary.knowledge_lifecycle_summary.candidate},promoted:${summary.knowledge_lifecycle_summary.promoted},superseded:${summary.knowledge_lifecycle_summary.superseded}`;
