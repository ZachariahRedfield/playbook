import path from 'node:path';
import type { RemediationStatusArtifact, TestAutofixRemediationHistoryArtifact } from '@zachariahredfield/playbook-core';
import type { OutcomeFeedbackArtifact } from '../memory/outcomeFeedback.js';
import type { LearningStateSnapshotArtifact } from '../telemetry/learningState.js';
import type { ProcessTelemetryArtifact } from '../telemetry/outcomeTelemetry.js';
import type { PatternConvergenceArtifact } from './patternConvergence.js';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';

export const LEARNING_CLUSTERS_SCHEMA_VERSION = '1.0' as const;
export const LEARNING_CLUSTERS_RELATIVE_PATH = '.playbook/learning-clusters.json' as const;

const OUTCOME_FEEDBACK_PATH = '.playbook/outcome-feedback.json' as const;
const REMEDIATION_STATUS_PATH = '.playbook/remediation-status.json' as const;
const REMEDIATION_HISTORY_PATH = '.playbook/test-autofix-history.json' as const;
const LEARNING_STATE_PATH = '.playbook/learning-state.json' as const;
const PROCESS_TELEMETRY_PATH = '.playbook/process-telemetry.json' as const;
const LONGITUDINAL_STATE_PATH = '.playbook/longitudinal-state.json' as const;
const PATTERN_CONVERGENCE_PATH = '.playbook/pattern-convergence.json' as const;

export type LearningClusterDimension =
  | 'repeated_failure_shape'
  | 'repeated_remediation_outcome'
  | 'repeated_query_runtime_usage'
  | 'repeated_governance_blocker';

export type LearningClusterCandidateType =
  | 'threshold_tuning'
  | 'repair_class_investigation'
  | 'verify_rule_improvement'
  | 'fixture_contract_hardening'
  | 'docs_doctrine_update';

export type LearningCluster = {
  clusterId: string;
  clusterDimension: LearningClusterDimension;
  sourceEvidenceRefs: string[];
  repeatedSignalSummary: string;
  suggestedImprovementCandidateType: LearningClusterCandidateType;
  confidence: number;
  riskReviewRequirement: 'low' | 'medium' | 'high';
  nextActionText: string;
  candidateOnly: true;
};

export type LearningClustersArtifact = {
  schemaVersion: typeof LEARNING_CLUSTERS_SCHEMA_VERSION;
  kind: 'learning-clusters';
  generatedAt: string;
  proposalOnly: true;
  nonAutonomous: true;
  sourceArtifacts: {
    outcomeFeedbackPath: typeof OUTCOME_FEEDBACK_PATH;
    remediationStatusPath: typeof REMEDIATION_STATUS_PATH;
    remediationHistoryPath: typeof REMEDIATION_HISTORY_PATH;
    learningStatePath: typeof LEARNING_STATE_PATH;
    processTelemetryPath: typeof PROCESS_TELEMETRY_PATH;
    longitudinalStatePath: typeof LONGITUDINAL_STATE_PATH;
    patternConvergencePath: typeof PATTERN_CONVERGENCE_PATH;
  };
  clusters: LearningCluster[];
};

type LongitudinalStateArtifact = {
  generatedAt?: string;
  recurring_evidence?: {
    finding_clusters?: Array<{ key?: string; count?: number; refs?: string[] }>;
  };
};

const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const toSlug = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized.length > 0 ? normalized : 'unclassified';
};

const includesAny = (value: string, needles: string[]): boolean => needles.some((needle) => value.includes(needle));

const uniqueSorted = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));

const toGeneratedAt = (...values: Array<string | undefined>): string => {
  const candidates = values
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .sort((left, right) => left.localeCompare(right));
  return candidates[candidates.length - 1] ?? new Date(0).toISOString();
};

const pushCluster = (target: LearningCluster[], cluster: LearningCluster): void => {
  if (cluster.sourceEvidenceRefs.length === 0) return;
  target.push({
    ...cluster,
    confidence: round4(clamp01(cluster.confidence)),
    sourceEvidenceRefs: uniqueSorted(cluster.sourceEvidenceRefs)
  });
};

const failureShapeClusters = (
  remediationStatus: RemediationStatusArtifact | undefined,
  target: LearningCluster[]
): void => {
  if (!remediationStatus) return;

  for (const signature of remediationStatus.stable_failure_signatures) {
    if (signature.occurrences < 2) continue;
    const outlook = signature.retry_outlook;
    pushCluster(target, {
      clusterId: `cluster:${toSlug(`failure-shape-${signature.failure_signature}`)}`,
      clusterDimension: 'repeated_failure_shape',
      sourceEvidenceRefs: [
        `${REMEDIATION_STATUS_PATH}#stable_failure_signatures/${signature.failure_signature}`,
        ...signature.final_statuses.map((status) => `${REMEDIATION_STATUS_PATH}#status/${status}`)
      ],
      repeatedSignalSummary: `Failure signature ${signature.failure_signature} recurred ${signature.occurrences} times with retry outlook ${outlook}.`,
      suggestedImprovementCandidateType: outlook === 'blocked' ? 'verify_rule_improvement' : 'repair_class_investigation',
      confidence: 0.5 + Math.min(0.35, signature.occurrences * 0.08),
      riskReviewRequirement: outlook === 'blocked' ? 'high' : 'medium',
      nextActionText: `Review candidate-only remediation learning evidence for ${signature.failure_signature} before considering any verify/rule or repair-class improvements.`,
      candidateOnly: true
    });
  }
};

const remediationOutcomeClusters = (
  remediationHistory: TestAutofixRemediationHistoryArtifact | undefined,
  target: LearningCluster[]
): void => {
  if (!remediationHistory) return;
  const statusCounts = new Map<string, { count: number; refs: Set<string> }>();

  for (const run of remediationHistory.runs) {
    const key = run.final_status;
    const existing = statusCounts.get(key) ?? { count: 0, refs: new Set<string>() };
    existing.count += 1;
    existing.refs.add(`${REMEDIATION_HISTORY_PATH}#runs/${run.run_id}`);
    statusCounts.set(key, existing);
  }

  for (const [status, summary] of [...statusCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (summary.count < 2) continue;
    const highRisk = includesAny(status, ['blocked', 'review_required']);
    pushCluster(target, {
      clusterId: `cluster:${toSlug(`remediation-outcome-${status}`)}`,
      clusterDimension: 'repeated_remediation_outcome',
      sourceEvidenceRefs: [...summary.refs],
      repeatedSignalSummary: `Remediation final status ${status} repeated ${summary.count} times across canonical remediation history.`,
      suggestedImprovementCandidateType: highRisk ? 'verify_rule_improvement' : 'fixture_contract_hardening',
      confidence: 0.48 + Math.min(0.4, summary.count * 0.09),
      riskReviewRequirement: highRisk ? 'high' : 'medium',
      nextActionText: `Keep this as candidate-only outcome evidence and request reviewer confirmation before proposing any policy or rule updates for status ${status}.`,
      candidateOnly: true
    });
  }
};

const runtimeUsageClusters = (
  processTelemetry: ProcessTelemetryArtifact | undefined,
  outcomeFeedback: OutcomeFeedbackArtifact | undefined,
  target: LearningCluster[]
): void => {
  if (processTelemetry) {
    for (const [taskFamily, count] of Object.entries(processTelemetry.summary.task_family_counts).sort((a, b) => a[0].localeCompare(b[0]))) {
      const lowered = taskFamily.toLowerCase();
      if (count < 2 || !includesAny(lowered, ['query', 'ask', 'help', 'context'])) continue;
      pushCluster(target, {
        clusterId: `cluster:${toSlug(`usage-task-family-${taskFamily}`)}`,
        clusterDimension: 'repeated_query_runtime_usage',
        sourceEvidenceRefs: [`${PROCESS_TELEMETRY_PATH}#summary/task_family_counts/${taskFamily}`],
        repeatedSignalSummary: `Runtime task-family usage ${taskFamily} repeated ${count} times in process telemetry summaries.`,
        suggestedImprovementCandidateType: 'docs_doctrine_update',
        confidence: 0.45 + Math.min(0.35, count * 0.08),
        riskReviewRequirement: 'medium',
        nextActionText: `Capture candidate-only guidance for repeated ${taskFamily} usage and route through docs/doctrine review without runtime mutation.`,
        candidateOnly: true
      });
    }
  }

  if (outcomeFeedback) {
    const notes = outcomeFeedback.signals.triggerQuality.map((entry) => entry.toLowerCase());
    const repeatedQueryHelpSignal = notes.filter((entry) => includesAny(entry, ['query', 'help', 'context', 'ask'])).length;
    if (repeatedQueryHelpSignal >= 2) {
      pushCluster(target, {
        clusterId: 'cluster:usage-trigger-quality-query-help',
        clusterDimension: 'repeated_query_runtime_usage',
        sourceEvidenceRefs: [`${OUTCOME_FEEDBACK_PATH}#signals/triggerQuality`],
        repeatedSignalSummary: `Outcome-feedback trigger-quality notes referenced query/help/context usage ${repeatedQueryHelpSignal} times.`,
        suggestedImprovementCandidateType: 'docs_doctrine_update',
        confidence: 0.52 + Math.min(0.2, repeatedQueryHelpSignal * 0.05),
        riskReviewRequirement: 'medium',
        nextActionText: 'Draft candidate-only query/help ergonomics notes and require human review before doctrine or UX follow-up.',
        candidateOnly: true
      });
    }
  }
};

const governanceBlockerClusters = (
  remediationStatus: RemediationStatusArtifact | undefined,
  outcomeFeedback: OutcomeFeedbackArtifact | undefined,
  longitudinalState: LongitudinalStateArtifact | undefined,
  patternConvergence: PatternConvergenceArtifact | undefined,
  target: LearningCluster[]
): void => {
  if (remediationStatus) {
    for (const decision of remediationStatus.repeat_policy_decisions) {
      if (decision.count < 2 || !includesAny(decision.decision, ['blocked', 'review_required'])) continue;
      pushCluster(target, {
        clusterId: `cluster:${toSlug(`governance-policy-${decision.decision}`)}`,
        clusterDimension: 'repeated_governance_blocker',
        sourceEvidenceRefs: [
          `${REMEDIATION_STATUS_PATH}#repeat_policy_decisions/${decision.decision}`,
          ...decision.failure_signatures.map((signature) => `${REMEDIATION_STATUS_PATH}#signature/${signature}`)
        ],
        repeatedSignalSummary: `Repeat-policy decision ${decision.decision} recurred ${decision.count} times with governance-blocking signatures.`,
        suggestedImprovementCandidateType: 'verify_rule_improvement',
        confidence: 0.6 + Math.min(0.3, decision.count * 0.06),
        riskReviewRequirement: 'high',
        nextActionText: `Escalate candidate-only governance blocker evidence for ${decision.decision} into reviewed verify/rule improvement discussion.`,
        candidateOnly: true
      });
    }
  }

  if (outcomeFeedback && outcomeFeedback.outcomeCounts['blocked-policy'] >= 2) {
    pushCluster(target, {
      clusterId: 'cluster:governance-blocked-policy-outcomes',
      clusterDimension: 'repeated_governance_blocker',
      sourceEvidenceRefs: [`${OUTCOME_FEEDBACK_PATH}#outcomeCounts/blocked-policy`],
      repeatedSignalSummary: `Outcome feedback recorded blocked-policy outcomes ${outcomeFeedback.outcomeCounts['blocked-policy']} times.`,
      suggestedImprovementCandidateType: 'verify_rule_improvement',
      confidence: 0.58 + Math.min(0.3, outcomeFeedback.outcomeCounts['blocked-policy'] * 0.07),
      riskReviewRequirement: 'high',
      nextActionText: 'Keep blocker outcomes candidate-only and route to explicit governance review before any rule or policy mutation.',
      candidateOnly: true
    });
  }

  if (longitudinalState) {
    for (const finding of longitudinalState.recurring_evidence?.finding_clusters ?? []) {
      const key = typeof finding.key === 'string' ? finding.key : '';
      const count = typeof finding.count === 'number' ? finding.count : 0;
      if (count < 2 || !includesAny(key.toLowerCase(), ['governance', 'doctor', 'triage', 'verify'])) continue;
      pushCluster(target, {
        clusterId: `cluster:${toSlug(`governance-finding-${key}`)}`,
        clusterDimension: 'repeated_governance_blocker',
        sourceEvidenceRefs: [`${LONGITUDINAL_STATE_PATH}#recurring_evidence/finding_clusters/${key}`, ...(finding.refs ?? [])],
        repeatedSignalSummary: `Recurring governed finding ${key} appeared ${count} times in longitudinal finding clusters.`,
        suggestedImprovementCandidateType: 'verify_rule_improvement',
        confidence: 0.54 + Math.min(0.25, count * 0.06),
        riskReviewRequirement: 'high',
        nextActionText: `Treat ${key} as recurring governance blocker evidence and request human review for candidate verify/doctor/triage improvements.`,
        candidateOnly: true
      });
    }
  }

  if (patternConvergence) {
    for (const cluster of patternConvergence.clusters) {
      if (cluster.members.length < 2 || cluster.convergence_confidence < 0.7) continue;
      const text = `${cluster.intent} ${cluster.constraint_class} ${cluster.resolution_strategy}`.toLowerCase();
      if (!includesAny(text, ['review', 'governance', 'mutation-boundary'])) continue;
      pushCluster(target, {
        clusterId: `cluster:${toSlug(`governance-pattern-${cluster.clusterId}`)}`,
        clusterDimension: 'repeated_governance_blocker',
        sourceEvidenceRefs: [`${PATTERN_CONVERGENCE_PATH}#clusters/${cluster.clusterId}`],
        repeatedSignalSummary: `Pattern convergence cluster ${cluster.clusterId} signaled repeated governance/review constraints with confidence ${cluster.convergence_confidence}.`,
        suggestedImprovementCandidateType: 'docs_doctrine_update',
        confidence: 0.5 + Math.min(0.4, cluster.convergence_confidence * 0.4),
        riskReviewRequirement: 'medium',
        nextActionText: `Summarize ${cluster.clusterId} as proposal-only governance guidance and require reviewer confirmation before promotion or mutation.`,
        candidateOnly: true
      });
    }
  }
};

export const generateLearningClustersArtifact = (repoRoot: string): LearningClustersArtifact => {
  const outcomeFeedback = readJsonIfExists<OutcomeFeedbackArtifact>(path.join(repoRoot, OUTCOME_FEEDBACK_PATH));
  const remediationStatus = readJsonIfExists<RemediationStatusArtifact>(path.join(repoRoot, REMEDIATION_STATUS_PATH));
  const remediationHistory = readJsonIfExists<TestAutofixRemediationHistoryArtifact>(path.join(repoRoot, REMEDIATION_HISTORY_PATH));
  const learningState = readJsonIfExists<LearningStateSnapshotArtifact>(path.join(repoRoot, LEARNING_STATE_PATH));
  const processTelemetry = readJsonIfExists<ProcessTelemetryArtifact>(path.join(repoRoot, PROCESS_TELEMETRY_PATH));
  const longitudinalState = readJsonIfExists<LongitudinalStateArtifact>(path.join(repoRoot, LONGITUDINAL_STATE_PATH));
  const patternConvergence = readJsonIfExists<PatternConvergenceArtifact>(path.join(repoRoot, PATTERN_CONVERGENCE_PATH));

  const clusters: LearningCluster[] = [];
  failureShapeClusters(remediationStatus, clusters);
  remediationOutcomeClusters(remediationHistory, clusters);
  runtimeUsageClusters(processTelemetry, outcomeFeedback, clusters);
  governanceBlockerClusters(remediationStatus, outcomeFeedback, longitudinalState, patternConvergence, clusters);

  return {
    schemaVersion: LEARNING_CLUSTERS_SCHEMA_VERSION,
    kind: 'learning-clusters',
    generatedAt: toGeneratedAt(
      outcomeFeedback?.generatedAt,
      remediationStatus?.generatedAt,
      remediationHistory?.generatedAt,
      learningState?.generatedAt,
      processTelemetry?.generatedAt,
      longitudinalState?.generatedAt,
      patternConvergence?.generatedAt
    ),
    proposalOnly: true,
    nonAutonomous: true,
    sourceArtifacts: {
      outcomeFeedbackPath: OUTCOME_FEEDBACK_PATH,
      remediationStatusPath: REMEDIATION_STATUS_PATH,
      remediationHistoryPath: REMEDIATION_HISTORY_PATH,
      learningStatePath: LEARNING_STATE_PATH,
      processTelemetryPath: PROCESS_TELEMETRY_PATH,
      longitudinalStatePath: LONGITUDINAL_STATE_PATH,
      patternConvergencePath: PATTERN_CONVERGENCE_PATH
    },
    clusters: clusters
      .sort((left, right) => left.clusterId.localeCompare(right.clusterId))
  };
};

export const writeLearningClustersArtifact = (
  repoRoot: string,
  artifact: LearningClustersArtifact,
  artifactPath = LEARNING_CLUSTERS_RELATIVE_PATH
): string => {
  const outputPath = path.resolve(repoRoot, artifactPath);
  writeDeterministicJsonAtomic(outputPath, artifact);
  return outputPath;
};
