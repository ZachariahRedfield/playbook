import path from 'node:path';
import { createHash } from 'node:crypto';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';
import type { CommandExecutionQualityArtifact } from '@zachariahredfield/playbook-core';
import type { PatternConvergenceArtifact } from './patternConvergence.js';

type OutcomeFeedbackArtifact = {
  generatedAt?: string;
  outcomes?: Array<{ outcomeClass?: string; sourceType?: string; sourceRef?: string; observedAt?: string }>;
};

type RemediationStatusArtifact = {
  generatedAt?: string;
  telemetry?: {
    blocked_signature_rollup?: Array<{ failure_signature?: string; blocked_count?: number }>;
    repeat_policy_block_counts?: Array<{ decision?: string; count?: number }>;
  };
};

type TestAutofixHistoryArtifact = {
  generatedAt?: string;
  runs?: Array<{ admitted_findings?: string[]; generatedAt?: string }>;
};

type LearningCompactionArtifact = {
  generatedAt?: string;
  summary?: {
    recurring_failures?: Array<{ signal_id?: string; family?: string; evidence_count?: number; confidence?: number }>;
  };
};

type PatternReviewQueueArtifact = {
  generatedAt?: string;
  candidates?: Array<{ id?: string; stage?: string; recurrenceCount?: number; promotionScore?: number; convergencePrioritySuggestion?: { suggestedPriority?: string } }>;
};

const OUTCOME_FEEDBACK_PATH = '.playbook/outcome-feedback.json' as const;
const REMEDIATION_STATUS_PATH = '.playbook/remediation-status.json' as const;
const LEARNING_COMPACTION_PATH = '.playbook/learning-compaction.json' as const;
const TEST_AUTOFIX_HISTORY_PATH = '.playbook/test-autofix-history.json' as const;
const COMMAND_QUALITY_PATH = '.playbook/telemetry/command-quality.json' as const;
const PATTERN_CONVERGENCE_PATH = '.playbook/pattern-convergence.json' as const;
const PATTERN_REVIEW_QUEUE_PATH = '.playbook/pattern-review-queue.json' as const;
const DEFAULT_ISO = new Date(0).toISOString();
const MIN_EVIDENCE = 2;

export const LEARNING_CLUSTERS_SCHEMA_VERSION = '1.0' as const;
export const LEARNING_CLUSTERS_RELATIVE_PATH = '.playbook/learning-clusters.json' as const;

export type LearningClusterDimension =
  | 'repeated_failure_shape'
  | 'repeated_remediation_outcome'
  | 'repeated_query_usage_pattern'
  | 'repeated_governance_blocker';

export type LearningClusterCandidateType =
  | 'repair_class_investigation'
  | 'threshold_tuning'
  | 'verify_rule_improvement'
  | 'docs_doctrine_update'
  | 'query_experience_hardening';

export type LearningClusterRiskReviewRequirement = 'none' | 'maintainer-review' | 'governance-review';

export type LearningClusterRow = {
  clusterId: string;
  dimension: LearningClusterDimension;
  sourceEvidenceRefs: string[];
  repeatedSignalSummary: string;
  suggestedImprovementCandidateType: LearningClusterCandidateType;
  confidence: number;
  riskReviewRequirement: LearningClusterRiskReviewRequirement;
  nextActionText: string;
};

export type LearningClustersArtifact = {
  schemaVersion: typeof LEARNING_CLUSTERS_SCHEMA_VERSION;
  kind: 'learning-clusters';
  generatedAt: string;
  proposalOnly: true;
  reviewOnly: true;
  sourceArtifacts: string[];
  clusters: LearningClusterRow[];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round4 = (value: number): number => Number(value.toFixed(4));
const stableUniqueSorted = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))].sort((a, b) => a.localeCompare(b));
const slug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
const hash12 = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);

const pushCluster = (clusters: LearningClusterRow[], input: Omit<LearningClusterRow, 'clusterId' | 'confidence'> & { seed: string; confidence: number }): void => {
  clusters.push({
    clusterId: `cluster:${slug(input.dimension)}:${slug(input.seed)}:${hash12([input.dimension, input.seed, input.sourceEvidenceRefs])}`,
    dimension: input.dimension,
    sourceEvidenceRefs: stableUniqueSorted(input.sourceEvidenceRefs),
    repeatedSignalSummary: input.repeatedSignalSummary.trim(),
    suggestedImprovementCandidateType: input.suggestedImprovementCandidateType,
    confidence: round4(clamp01(input.confidence)),
    riskReviewRequirement: input.riskReviewRequirement,
    nextActionText: input.nextActionText.trim()
  });
};

export const buildLearningClustersArtifact = (repoRoot: string): LearningClustersArtifact => {
  const outcomeFeedback = readJsonIfExists<OutcomeFeedbackArtifact>(path.join(repoRoot, OUTCOME_FEEDBACK_PATH));
  const remediationStatus = readJsonIfExists<RemediationStatusArtifact>(path.join(repoRoot, REMEDIATION_STATUS_PATH));
  const learningCompaction = readJsonIfExists<LearningCompactionArtifact>(path.join(repoRoot, LEARNING_COMPACTION_PATH));
  const remediationHistory = readJsonIfExists<TestAutofixHistoryArtifact>(path.join(repoRoot, TEST_AUTOFIX_HISTORY_PATH));
  const commandQuality = readJsonIfExists<CommandExecutionQualityArtifact>(path.join(repoRoot, COMMAND_QUALITY_PATH));
  const patternConvergence = readJsonIfExists<PatternConvergenceArtifact>(path.join(repoRoot, PATTERN_CONVERGENCE_PATH));
  const patternReviewQueue = readJsonIfExists<PatternReviewQueueArtifact>(path.join(repoRoot, PATTERN_REVIEW_QUEUE_PATH));

  const sourceArtifacts = stableUniqueSorted([
    outcomeFeedback ? OUTCOME_FEEDBACK_PATH : null,
    remediationStatus ? REMEDIATION_STATUS_PATH : null,
    learningCompaction ? LEARNING_COMPACTION_PATH : null,
    remediationHistory ? TEST_AUTOFIX_HISTORY_PATH : null,
    commandQuality ? COMMAND_QUALITY_PATH : null,
    patternConvergence ? PATTERN_CONVERGENCE_PATH : null,
    patternReviewQueue ? PATTERN_REVIEW_QUEUE_PATH : null
  ]);

  const clusters: LearningClusterRow[] = [];

  const outcomeCounts = new Map<string, number>();
  for (const row of outcomeFeedback?.outcomes ?? []) {
    if (!row.outcomeClass) continue;
    outcomeCounts.set(row.outcomeClass, (outcomeCounts.get(row.outcomeClass) ?? 0) + 1);
  }
  for (const [outcomeClass, count] of [...outcomeCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count < MIN_EVIDENCE) continue;
    const isFailure = outcomeClass === 'bounded-failure' || outcomeClass === 'later-regression' || outcomeClass === 'rollback-deactivation';
    pushCluster(clusters, {
      seed: `outcome-${outcomeClass}`,
      dimension: isFailure ? 'repeated_remediation_outcome' : 'repeated_governance_blocker',
      sourceEvidenceRefs: [`${OUTCOME_FEEDBACK_PATH}#outcomeClass=${outcomeClass}`],
      repeatedSignalSummary: `Outcome-feedback shows ${count} recurring ${outcomeClass} events across canonical runtime/remediation sources.`,
      suggestedImprovementCandidateType: isFailure ? 'threshold_tuning' : 'docs_doctrine_update',
      confidence: clamp01(0.55 + count * 0.1),
      riskReviewRequirement: outcomeClass === 'blocked-policy' ? 'governance-review' : 'maintainer-review',
      nextActionText: `Review recurring ${outcomeClass} evidence and draft a candidate-only improvement proposal without any autonomous mutation.`
    });
  }

  for (const entry of remediationStatus?.telemetry?.blocked_signature_rollup ?? []) {
    const blockedCount = typeof entry.blocked_count === 'number' ? entry.blocked_count : 0;
    const signature = typeof entry.failure_signature === 'string' ? entry.failure_signature : '';
    if (!signature || blockedCount < MIN_EVIDENCE) continue;
    pushCluster(clusters, {
      seed: `blocked-signature-${signature}`,
      dimension: 'repeated_failure_shape',
      sourceEvidenceRefs: [`${REMEDIATION_STATUS_PATH}#blocked_signature_rollup/${signature}`],
      repeatedSignalSummary: `Failure signature ${signature} is repeatedly blocked (${blockedCount} runs) in remediation status telemetry.`,
      suggestedImprovementCandidateType: 'repair_class_investigation',
      confidence: clamp01(0.6 + blockedCount * 0.08),
      riskReviewRequirement: 'governance-review',
      nextActionText: `Create a candidate-only repair-class investigation for signature ${signature} and route through explicit review.`
    });
  }

  const verifyFindingCounts = new Map<string, number>();
  for (const run of remediationHistory?.runs ?? []) {
    for (const finding of run.admitted_findings ?? []) {
      if (!/\b(verify|doctor|test-triage)\b/i.test(finding)) continue;
      verifyFindingCounts.set(finding, (verifyFindingCounts.get(finding) ?? 0) + 1);
    }
  }
  for (const [finding, count] of [...verifyFindingCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count < MIN_EVIDENCE) continue;
    pushCluster(clusters, {
      seed: `finding-${finding}`,
      dimension: 'repeated_governance_blocker',
      sourceEvidenceRefs: [`${TEST_AUTOFIX_HISTORY_PATH}#admitted_findings/${finding}`],
      repeatedSignalSummary: `Canonical remediation history records repeated governance finding "${finding}" (${count} runs).`,
      suggestedImprovementCandidateType: 'verify_rule_improvement',
      confidence: clamp01(0.58 + count * 0.07),
      riskReviewRequirement: 'governance-review',
      nextActionText: `Draft a candidate-only verify/doctor/test-triage rule-improvement proposal for repeated finding "${finding}".`
    });
  }

  for (const signal of learningCompaction?.summary?.recurring_failures ?? []) {
    const evidenceCount = typeof signal.evidence_count === 'number' ? signal.evidence_count : 0;
    const signalId = typeof signal.signal_id === 'string' ? signal.signal_id : '';
    if (!signalId || evidenceCount < MIN_EVIDENCE) continue;
    pushCluster(clusters, {
      seed: `recurring-failure-${signalId}`,
      dimension: 'repeated_failure_shape',
      sourceEvidenceRefs: [`${LEARNING_COMPACTION_PATH}#recurring_failures/${signalId}`],
      repeatedSignalSummary: `Learning compaction reports recurring failure signal ${signalId} with ${evidenceCount} evidence events.`,
      suggestedImprovementCandidateType: 'verify_rule_improvement',
      confidence: clamp01(typeof signal.confidence === 'number' ? signal.confidence : 0.65),
      riskReviewRequirement: 'maintainer-review',
      nextActionText: `Translate recurring signal ${signalId} into a candidate-only deterministic improvement proposal and preserve review gates.`
    });
  }

  const queryPatternCounts = new Map<string, { count: number; warnings: number; openQuestions: number }>();
  for (const record of commandQuality?.records ?? []) {
    if (!['query', 'ask', 'explain', 'help'].includes(record.command_name)) continue;
    const key = `${record.command_name}::${record.inputs_summary}`;
    const bucket = queryPatternCounts.get(key) ?? { count: 0, warnings: 0, openQuestions: 0 };
    bucket.count += 1;
    bucket.warnings += record.warnings_count;
    bucket.openQuestions += record.open_questions_count;
    queryPatternCounts.set(key, bucket);
  }

  for (const [key, bucket] of [...queryPatternCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (bucket.count < MIN_EVIDENCE) continue;
    const [commandName, inputsSummary] = key.split('::');
    pushCluster(clusters, {
      seed: `query-usage-${commandName}-${inputsSummary}`,
      dimension: 'repeated_query_usage_pattern',
      sourceEvidenceRefs: [`${COMMAND_QUALITY_PATH}#${commandName}`, `${COMMAND_QUALITY_PATH}#inputs_summary=${inputsSummary}`],
      repeatedSignalSummary: `Runtime command-quality telemetry shows repeated ${commandName} usage pattern (${bucket.count} runs) for the same query/help intent.`,
      suggestedImprovementCandidateType: 'query_experience_hardening',
      confidence: clamp01(0.56 + bucket.count * 0.08 + Math.min(bucket.warnings + bucket.openQuestions, 3) * 0.04),
      riskReviewRequirement: bucket.warnings + bucket.openQuestions > 0 ? 'maintainer-review' : 'none',
      nextActionText: `Propose candidate-only query/help UX hardening for repeated ${commandName} pattern "${inputsSummary || 'n/a'}".`
    });
  }

  for (const cluster of patternConvergence?.clusters ?? []) {
    if (cluster.members.length < 3 || cluster.convergence_confidence < 0.6) continue;
    pushCluster(clusters, {
      seed: `pattern-convergence-${cluster.clusterId}`,
      dimension: 'repeated_governance_blocker',
      sourceEvidenceRefs: [`${PATTERN_CONVERGENCE_PATH}#${cluster.clusterId}`],
      repeatedSignalSummary: `Pattern convergence cluster ${cluster.clusterId} shows repeated review-relevant signals across ${cluster.members.length} members.`,
      suggestedImprovementCandidateType: 'docs_doctrine_update',
      confidence: clamp01(cluster.convergence_confidence),
      riskReviewRequirement: 'governance-review',
      nextActionText: `Create a candidate-only doctrine/documentation improvement derived from convergence cluster ${cluster.clusterId}.`
    });
  }

  const reviewCandidates = patternReviewQueue?.candidates?.filter((candidate) => candidate.stage === 'review' && (candidate.recurrenceCount ?? 0) >= MIN_EVIDENCE) ?? [];
  if (reviewCandidates.length >= MIN_EVIDENCE) {
    const highPriorityCount = reviewCandidates.filter((candidate) => candidate.convergencePrioritySuggestion?.suggestedPriority === 'high').length;
    pushCluster(clusters, {
      seed: 'pattern-review-queue-pressure',
      dimension: 'repeated_governance_blocker',
      sourceEvidenceRefs: [`${PATTERN_REVIEW_QUEUE_PATH}#candidates`],
      repeatedSignalSummary: `Pattern review queue has ${reviewCandidates.length} recurring review-stage candidates (${highPriorityCount} high-priority).`,
      suggestedImprovementCandidateType: 'docs_doctrine_update',
      confidence: clamp01(0.6 + reviewCandidates.length * 0.04 + highPriorityCount * 0.05),
      riskReviewRequirement: 'governance-review',
      nextActionText: 'Queue candidate-only review guidance updates to keep deterministic review throughput bounded and explicit.'
    });
  }

  const generatedAt = stableUniqueSorted([
    outcomeFeedback?.generatedAt,
    remediationStatus?.generatedAt,
    learningCompaction?.generatedAt,
    remediationHistory?.generatedAt,
    commandQuality?.generatedAt,
    patternConvergence?.generatedAt,
    patternReviewQueue?.generatedAt
  ]).slice(-1)[0] ?? DEFAULT_ISO;

  return {
    schemaVersion: LEARNING_CLUSTERS_SCHEMA_VERSION,
    kind: 'learning-clusters',
    generatedAt,
    proposalOnly: true,
    reviewOnly: true,
    sourceArtifacts,
    clusters: clusters.sort((a, b) =>
      a.dimension.localeCompare(b.dimension) ||
      b.confidence - a.confidence ||
      a.clusterId.localeCompare(b.clusterId)
    )
  };
};

export const writeLearningClustersArtifact = (
  repoRoot: string,
  artifact: LearningClustersArtifact,
  artifactPath = LEARNING_CLUSTERS_RELATIVE_PATH
): string => {
  const resolvedPath = path.resolve(repoRoot, artifactPath);
  writeDeterministicJsonAtomic(resolvedPath, artifact);
  return resolvedPath;
};

export const buildAndWriteLearningClustersArtifact = (repoRoot: string): { artifact: LearningClustersArtifact; artifactPath: string } => {
  const artifact = buildLearningClustersArtifact(repoRoot);
  const artifactPath = writeLearningClustersArtifact(repoRoot, artifact);
  return { artifact, artifactPath };
};
