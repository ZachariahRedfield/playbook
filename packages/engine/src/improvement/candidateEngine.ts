import path from 'node:path';
import type {
  CompactedLearningSummary,
  RemediationStatusArtifact,
  TestAutofixArtifact,
  TestAutofixRemediationHistoryArtifact,
  TestAutofixRemediationHistoryEntry
} from '@zachariahredfield/playbook-core';
import type { LearningStateSnapshotArtifact } from '../telemetry/learningState.js';
import type { OutcomeTelemetryArtifact, ProcessTelemetryArtifact } from '../telemetry/outcomeTelemetry.js';
import {
  readRepositoryEvents,
  type ExecutionOutcomeEvent,
  type ImprovementCandidateEvent,
  type LaneTransitionEvent,
  type RepositoryEvent,
  type RouteDecisionEvent,
  type WorkerAssignmentEvent
} from '../memory/events.js';
import {
  generateDoctrinePromotionArtifacts,
  writeDoctrinePromotionArtifacts,
  KNOWLEDGE_CANDIDATES_RELATIVE_PATH,
  KNOWLEDGE_PROMOTIONS_RELATIVE_PATH,
  type DoctrinePromotionCandidatesArtifact,
  type DoctrinePromotionsArtifact
} from './doctrinePromotion.js';
import {
  generateCommandImprovementProposals,
  writeCommandImprovementArtifact,
  COMMAND_IMPROVEMENTS_RELATIVE_PATH as COMMAND_IMPROVEMENTS_ARTIFACT_RELATIVE_PATH,
  type CommandImprovementsArtifact
} from './commandProposals.js';
import { readJsonIfExists, writeDeterministicJsonAtomic } from '../learning/io.js';
import { analyzeImprovementOpportunities, type OpportunityAnalysisArtifact } from './opportunityAnalysis.js';

export { KNOWLEDGE_CANDIDATES_RELATIVE_PATH, KNOWLEDGE_PROMOTIONS_RELATIVE_PATH } from './doctrinePromotion.js';

export const IMPROVEMENT_CANDIDATES_SCHEMA_VERSION = '1.0' as const;
export const IMPROVEMENT_CANDIDATES_RELATIVE_PATH = '.playbook/improvement-candidates.json' as const;
export const ROUTER_RECOMMENDATIONS_RELATIVE_PATH = '.playbook/router-recommendations.json' as const;
export const COMMAND_IMPROVEMENTS_RELATIVE_PATH = COMMAND_IMPROVEMENTS_ARTIFACT_RELATIVE_PATH;

export type ImprovementCandidateCategory =
  | 'routing'
  | 'orchestration'
  | 'worker_prompts'
  | 'validation_efficiency'
  | 'ontology'
  | 'remediation_learning';

export type ImprovementTier = 'auto_safe' | 'conversation' | 'governance';

export type ImprovementGatingTier = 'AUTO-SAFE' | 'CONVERSATIONAL' | 'GOVERNANCE';

type ProposalEvidence = {
  event_ids: string[];
  evidence_count: number;
  supporting_runs: number;
};

export type RouterRecommendationGatingTier = 'CONVERSATIONAL' | 'GOVERNANCE';

export type RouterRecommendation = {
  recommendation_id: string;
  task_family: string;
  current_strategy: string;
  recommended_strategy: string;
  evidence_count: number;
  supporting_runs: number;
  confidence_score: number;
  rationale: string;
  gating_tier: RouterRecommendationGatingTier;
};

export type RejectedRouterRecommendation = RouterRecommendation & {
  blocking_reasons: string[];
};

export type RouterRecommendationsArtifact = {
  schemaVersion: typeof IMPROVEMENT_CANDIDATES_SCHEMA_VERSION;
  kind: 'router-recommendations';
  generatedAt: string;
  proposalOnly: true;
  nonAutonomous: true;
  sourceArtifacts: {
    learningStatePath: string;
    learningCompactionPath: string;
    processTelemetryPath: string;
    outcomeTelemetryPath: string;
    memoryEventsPath: string;
  };
  recommendations: RouterRecommendation[];
  rejected_recommendations: RejectedRouterRecommendation[];
};

export type ImprovementCandidate = {
  candidate_id: string;
  category: ImprovementCandidateCategory;
  proposal_kind?: 'threshold_tuning' | 'repair_class_investigation' | 'verify_rule_improvement' | 'fixture_contract_hardening' | 'docs_doctrine_update';
  observation: string;
  recurrence_count: number;
  confidence_score: number;
  suggested_action: string;
  gating_tier: ImprovementGatingTier;
  improvement_tier: ImprovementTier;
  required_review: boolean;
  blocking_reasons: string[];
  evidence: {
    event_ids: string[];
  };
  evidence_count: number;
  supporting_runs: number;
  provenance?: {
    remediation_source?: {
      remediationStatusPath: string;
      remediationHistoryPath: string;
      latestResultPath: string;
    };
    failure_signatures: string[];
    repair_classes: string[];
    outcomes: string[];
    latest_run_ids: string[];
  };
};

export type RejectedImprovementCandidate = {
  candidate_id: string;
  category: ImprovementCandidateCategory;
  observation: string;
  suggested_action: string;
  confidence_score: number;
  evidence_count: number;
  supporting_runs: number;
  blocking_reasons: string[];
};

export type ImprovementCandidatesArtifact = {
  schemaVersion: typeof IMPROVEMENT_CANDIDATES_SCHEMA_VERSION;
  kind: 'improvement-candidates';
  generatedAt: string;
  thresholds: {
    minimum_recurrence: number;
    minimum_confidence: number;
  };
  sourceArtifacts: {
    memoryEventsPath: string;
    learningStatePath: string;
    memoryEventCount: number;
    learningStateAvailable: boolean;
  };
  summary: {
    AUTO_SAFE: number;
    CONVERSATIONAL: number;
    GOVERNANCE: number;
    total: number;
  };
  router_recommendations: RouterRecommendationsArtifact;
  doctrine_candidates: DoctrinePromotionCandidatesArtifact;
  doctrine_promotions: DoctrinePromotionsArtifact;
  command_improvements: CommandImprovementsArtifact;
  opportunity_analysis: OpportunityAnalysisArtifact;
  candidates: ImprovementCandidate[];
  rejected_candidates: RejectedImprovementCandidate[];
};

export type ImprovementActionArtifact = {
  schemaVersion: typeof IMPROVEMENT_CANDIDATES_SCHEMA_VERSION;
  kind: 'improvement-actions';
  generatedAt: string;
  action: 'apply-safe';
  applied: string[];
  pending_conversation: string[];
  pending_governance: string[];
};

export type ImprovementGovernanceApprovalArtifact = {
  schemaVersion: typeof IMPROVEMENT_CANDIDATES_SCHEMA_VERSION;
  kind: 'improvement-governance-approvals';
  updatedAt: string;
  approvals: Array<{
    proposal_id: string;
    approvedAt: string;
  }>;
};

const MINIMUM_RECURRENCE = 3;
const MINIMUM_CONFIDENCE = 0.6;
const AUTO_SAFE_MINIMUM_EVIDENCE = 3;
const AUTO_SAFE_MINIMUM_RUNS = 1;

const CONVERSATIONAL_MINIMUM_EVIDENCE = 3;
const GOVERNANCE_MINIMUM_EVIDENCE = 2;
const REMEDIATION_REVIEW_MINIMUM_EVIDENCE = 2;
const ROUTER_RECOMMENDATION_MIN_EVIDENCE = 3;
const ROUTER_RECOMMENDATION_MIN_CONFIDENCE = 0.65;

const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getRunKey = (timestamp: string): string => timestamp.slice(0, 10);
const isSuccessStatus = (status: string): boolean => status === 'fixed' || status === 'partially_fixed';
const isBlockedStatus = (status: string): boolean =>
  status === 'blocked' || status === 'blocked_low_confidence' || status === 'review_required_only';

type LearningCompactionArtifact = {
  summary?: CompactedLearningSummary;
};

type RemediationArtifacts = {
  remediationStatus?: RemediationStatusArtifact;
  remediationHistory?: TestAutofixRemediationHistoryArtifact;
  latestResult?: TestAutofixArtifact;
};

const buildRouterRecommendation = (input: {
  recommendationId: string;
  taskFamily: string;
  currentStrategy: string;
  recommendedStrategy: string;
  evidenceEvents: Array<{ event_id: string; timestamp: string }>;
  signalScore: number;
  learningConfidence: number;
  rationale: string;
  gatingTier: RouterRecommendationGatingTier;
}): { recommendation?: RouterRecommendation; rejected?: RejectedRouterRecommendation } => {
  const evidence = buildEvidence(input.evidenceEvents);
  const confidenceScore = buildConfidence(evidence.evidence_count, input.signalScore, input.learningConfidence);
  const blockingReasons: string[] = [];

  if (evidence.evidence_count < ROUTER_RECOMMENDATION_MIN_EVIDENCE) {
    blockingReasons.push(`insufficient_evidence_count:${evidence.evidence_count}<${ROUTER_RECOMMENDATION_MIN_EVIDENCE}`);
  }
  if (confidenceScore < ROUTER_RECOMMENDATION_MIN_CONFIDENCE) {
    blockingReasons.push(`confidence_below_threshold:${confidenceScore}<${ROUTER_RECOMMENDATION_MIN_CONFIDENCE}`);
  }

  const base = {
    recommendation_id: input.recommendationId,
    task_family: input.taskFamily,
    current_strategy: input.currentStrategy,
    recommended_strategy: input.recommendedStrategy,
    evidence_count: evidence.evidence_count,
    supporting_runs: evidence.supporting_runs,
    confidence_score: confidenceScore,
    rationale: input.rationale,
    gating_tier: input.gatingTier
  };

  if (blockingReasons.length > 0) {
    return { rejected: { ...base, blocking_reasons: blockingReasons } };
  }

  return { recommendation: base };
};

const generateRouterRecommendations = (input: {
  events: RepositoryEvent[];
  learning: LearningStateSnapshotArtifact | undefined;
  processTelemetry: ProcessTelemetryArtifact | undefined;
  outcomeTelemetry: OutcomeTelemetryArtifact | undefined;
  compactedLearning: CompactedLearningSummary | undefined;
}): RouterRecommendationsArtifact => {
  const routeEvents = input.events.filter((event): event is RouteDecisionEvent => event.event_type === 'route_decision');
  const outcomeEvents = input.events.filter(
    (event): event is ExecutionOutcomeEvent => event.event_type === 'execution_outcome' || event.event_type === 'lane_outcome'
  );

  const recommendations: RouterRecommendation[] = [];
  const rejected: RejectedRouterRecommendation[] = [];
  const learningConfidence = input.learning?.confidenceSummary.overall_confidence ?? 0;

  const processByFamily = new Map<string, ProcessTelemetryArtifact['records']>();
  for (const record of input.processTelemetry?.records ?? []) {
    processByFamily.set(record.task_family, [...(processByFamily.get(record.task_family) ?? []), record]);
  }

  for (const [taskFamily, records] of [...processByFamily.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const evidenceEvents = records.map((record) => ({ event_id: record.id, timestamp: record.recordedAt }));
    const avgPredictedLanes = records.reduce((sum, record) => sum + (record.predicted_parallel_lanes ?? 1), 0) / Math.max(1, records.length);
    const avgActualLanes = records.reduce((sum, record) => sum + (record.actual_parallel_lanes ?? 1), 0) / Math.max(1, records.length);
    const avgRouterFit = records.reduce((sum, record) => sum + (record.router_fit_score ?? 0), 0) / Math.max(1, records.length);
    const avgPredictedValidation = records.reduce((sum, record) => sum + (record.predicted_validation_cost ?? 0), 0) / Math.max(1, records.length);
    const avgActualValidation = records.reduce((sum, record) => sum + (record.actual_validation_cost ?? 0), 0) / Math.max(1, records.length);

    if (avgPredictedLanes - avgActualLanes >= 1) {
      const built = buildRouterRecommendation({
        recommendationId: `router_over_fragmented_${taskFamily}`,
        taskFamily,
        currentStrategy: 'aggressive-fragmentation',
        recommendedStrategy: 'reduce-fragmentation-lanes',
        evidenceEvents,
        signalScore: clamp01(0.55 + (1 - avgRouterFit) * 0.35 + Math.min(2, avgPredictedLanes - avgActualLanes) * 0.05),
        learningConfidence,
        rationale:
          'Repeated router telemetry shows predicted parallel lanes consistently exceeding realized lanes; prefer tighter task-family bundling.',
        gatingTier: 'CONVERSATIONAL'
      });
      if (built.recommendation) recommendations.push(built.recommendation);
      if (built.rejected) rejected.push(built.rejected);
    }

    if (avgActualLanes - avgPredictedLanes >= 1) {
      const built = buildRouterRecommendation({
        recommendationId: `router_under_fragmented_${taskFamily}`,
        taskFamily,
        currentStrategy: 'conservative-fragmentation',
        recommendedStrategy: 'increase-fragmentation-lanes',
        evidenceEvents,
        signalScore: clamp01(0.55 + (1 - avgRouterFit) * 0.35 + Math.min(2, avgActualLanes - avgPredictedLanes) * 0.05),
        learningConfidence,
        rationale:
          'Repeated router telemetry shows realized parallel lanes exceeding predicted lanes; suggest controlled additional lane decomposition for this task family.',
        gatingTier: 'CONVERSATIONAL'
      });
      if (built.recommendation) recommendations.push(built.recommendation);
      if (built.rejected) rejected.push(built.rejected);
    }

    if (Math.abs(avgPredictedValidation - avgActualValidation) >= 1) {
      const overValidation = avgPredictedValidation > avgActualValidation;
      const built = buildRouterRecommendation({
        recommendationId: `router_validation_posture_${taskFamily}`,
        taskFamily,
        currentStrategy: overValidation ? 'high-validation-posture' : 'low-validation-posture',
        recommendedStrategy: overValidation ? 'validation-rightsize-down' : 'validation-rightsize-up',
        evidenceEvents,
        signalScore: clamp01(0.6 + (input.learning?.metrics.validation_cost_pressure ?? 0) * 0.2 + Math.min(4, Math.abs(avgPredictedValidation - avgActualValidation)) * 0.05),
        learningConfidence,
        rationale:
          'Validation-cost telemetry repeatedly diverges from predicted posture; recommend explicit task-family validation profile review before router policy updates.',
        gatingTier: 'GOVERNANCE'
      });
      if (built.recommendation) recommendations.push(built.recommendation);
      if (built.rejected) rejected.push(built.rejected);
    }
  }

  const successfulOutcomesByFamily = new Map<string, number>();
  for (const event of outcomeEvents) {
    if (event.outcome !== 'success') continue;
    const family = routeEvents.find((route) => route.run_id && route.run_id === event.run_id)?.task_family ?? 'unknown';
    successfulOutcomesByFamily.set(family, (successfulOutcomesByFamily.get(family) ?? 0) + 1);
  }
  for (const [family, count] of Object.entries(input.outcomeTelemetry?.summary.task_family_counts ?? {}).sort((a, b) => a[0].localeCompare(b[0]))) {
    successfulOutcomesByFamily.set(family, Math.max(successfulOutcomesByFamily.get(family) ?? 0, count));
  }

  for (const [family, successCount] of [...successfulOutcomesByFamily.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (successCount < ROUTER_RECOMMENDATION_MIN_EVIDENCE) continue;
    const familyRoutes = routeEvents.filter((event) => event.task_family === family);
    if (familyRoutes.length === 0) continue;
    const routeCounts = familyRoutes.reduce<Record<string, number>>((acc, event) => {
      acc[event.route_id] = (acc[event.route_id] ?? 0) + 1;
      return acc;
    }, {});
    const preferredRoute = Object.entries(routeCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'unknown-route';
    const built = buildRouterRecommendation({
      recommendationId: `router_success_bias_${family}`,
      taskFamily: family,
      currentStrategy: 'family-neutral-route-selection',
      recommendedStrategy: `prefer:${preferredRoute}`,
      evidenceEvents: familyRoutes.map((event) => ({ event_id: event.event_id, timestamp: event.timestamp })),
      signalScore: clamp01(0.58 + Math.min(10, successCount) / 20 + (input.compactedLearning?.route_patterns.length ?? 0) / 100),
      learningConfidence,
      rationale: `Task family ${family} has repeated successful lane outcomes with stable route evidence; biasing recommendations toward the winning route remains proposal-only and review-gated.`,
      gatingTier: 'CONVERSATIONAL'
    });
    if (built.recommendation) recommendations.push(built.recommendation);
    if (built.rejected) rejected.push(built.rejected);
  }

  return {
    schemaVersion: IMPROVEMENT_CANDIDATES_SCHEMA_VERSION,
    kind: 'router-recommendations',
    generatedAt: new Date().toISOString(),
    proposalOnly: true,
    nonAutonomous: true,
    sourceArtifacts: {
      learningStatePath: '.playbook/learning-state.json',
      learningCompactionPath: '.playbook/learning-compaction.json',
      processTelemetryPath: '.playbook/process-telemetry.json',
      outcomeTelemetryPath: '.playbook/outcome-telemetry.json',
      memoryEventsPath: '.playbook/memory/events/*'
    },
    recommendations: recommendations.sort((a, b) => b.confidence_score - a.confidence_score || a.recommendation_id.localeCompare(b.recommendation_id)),
    rejected_recommendations: rejected.sort((a, b) => a.recommendation_id.localeCompare(b.recommendation_id))
  };
};

const buildTier = (input: {
  category: ImprovementCandidateCategory;
  suggestedAction: string;
  proposalKind?: ImprovementCandidate['proposal_kind'];
}): ImprovementTier => {
  const suggestedAction = input.suggestedAction.toLowerCase();

  if (input.category === 'remediation_learning') {
    if (
      input.proposalKind === 'threshold_tuning' ||
      input.proposalKind === 'verify_rule_improvement' ||
      input.proposalKind === 'docs_doctrine_update'
    ) {
      return 'governance';
    }

    return 'conversation';
  }

  if (
    input.category === 'ontology' ||
    suggestedAction.includes('required validation') ||
    suggestedAction.includes('mutation scope') ||
    suggestedAction.includes('schema')
  ) {
    return 'governance';
  }

  if (input.category === 'routing' || suggestedAction.includes('classifier') || suggestedAction.includes('task family')) {
    return 'conversation';
  }

  return 'auto_safe';
};

const toGatingTier = (tier: ImprovementTier): ImprovementGatingTier => {
  if (tier === 'auto_safe') {
    return 'AUTO-SAFE';
  }

  if (tier === 'conversation') {
    return 'CONVERSATIONAL';
  }

  return 'GOVERNANCE';
};

const buildConfidence = (recurrenceCount: number, signalScore: number, learningConfidence: number): number =>
  round4(clamp01(Math.min(1, recurrenceCount / 10) * 0.45 + signalScore * 0.4 + learningConfidence * 0.15));

const buildEvidence = (events: Array<{ event_id: string; timestamp: string }>): ProposalEvidence => {
  const eventIds = events.map((event) => event.event_id).sort((left, right) => left.localeCompare(right));
  const uniqueRuns = new Set(events.map((event) => getRunKey(event.timestamp)));
  return {
    event_ids: eventIds,
    evidence_count: eventIds.length,
    supporting_runs: uniqueRuns.size
  };
};

const evaluateGating = (input: {
  category: ImprovementCandidateCategory;
  suggestedAction: string;
  proposalKind?: ImprovementCandidate['proposal_kind'];
  confidenceScore: number;
  evidence: ProposalEvidence;
}): {
  gatingTier: ImprovementGatingTier;
  improvementTier: ImprovementTier;
  requiredReview: boolean;
  blockingReasons: string[];
} => {
  const improvementTier = buildTier({
    category: input.category,
    suggestedAction: input.suggestedAction,
    proposalKind: input.proposalKind
  });
  const gatingTier = toGatingTier(improvementTier);
  const blockingReasons: string[] = [];
  const governanceSensitive = gatingTier === 'GOVERNANCE';
  const minimumEvidence = input.category === 'remediation_learning' ? REMEDIATION_REVIEW_MINIMUM_EVIDENCE : MINIMUM_RECURRENCE;

  if (input.evidence.evidence_count < minimumEvidence) {
    blockingReasons.push(`insufficient_evidence_count:${input.evidence.evidence_count}<${minimumEvidence}`);
  }

  if (input.confidenceScore < MINIMUM_CONFIDENCE) {
    blockingReasons.push(`confidence_below_threshold:${input.confidenceScore}<${MINIMUM_CONFIDENCE}`);
  }

  if (gatingTier === 'AUTO-SAFE') {
    if (input.evidence.evidence_count < AUTO_SAFE_MINIMUM_EVIDENCE) {
      blockingReasons.push(`auto_safe_requires_repeated_evidence:${input.evidence.evidence_count}<${AUTO_SAFE_MINIMUM_EVIDENCE}`);
    }
    if (input.evidence.supporting_runs < AUTO_SAFE_MINIMUM_RUNS) {
      blockingReasons.push(`auto_safe_requires_multi_run_support:${input.evidence.supporting_runs}<${AUTO_SAFE_MINIMUM_RUNS}`);
    }
    if (governanceSensitive) {
      blockingReasons.push('auto_safe_forbidden_for_governance_sensitive_change');
    }
  }

  if (gatingTier === 'CONVERSATIONAL' && input.evidence.evidence_count < CONVERSATIONAL_MINIMUM_EVIDENCE) {
    blockingReasons.push(`conversational_requires_evidence:${input.evidence.evidence_count}<${CONVERSATIONAL_MINIMUM_EVIDENCE}`);
  }

  if (gatingTier === 'GOVERNANCE' && input.evidence.evidence_count < GOVERNANCE_MINIMUM_EVIDENCE) {
    blockingReasons.push(`governance_requires_evidence:${input.evidence.evidence_count}<${GOVERNANCE_MINIMUM_EVIDENCE}`);
  }

  return {
    gatingTier,
    improvementTier,
    requiredReview: gatingTier !== 'AUTO-SAFE',
    blockingReasons
  };
};

const emitCandidate = (input: {
  candidateId: string;
  category: ImprovementCandidateCategory;
  proposalKind?: ImprovementCandidate['proposal_kind'];
  observation: string;
  recurrenceCount: number;
  signalScore: number;
  learningConfidence: number;
  suggestedAction: string;
  evidenceEvents: Array<{ event_id: string; timestamp: string }>;
  provenance?: ImprovementCandidate['provenance'];
}): { candidate: ImprovementCandidate | null; rejected: RejectedImprovementCandidate | null } => {
  const confidenceScore = buildConfidence(input.recurrenceCount, input.signalScore, input.learningConfidence);
  const evidence = buildEvidence(input.evidenceEvents);
  const gating = evaluateGating({
    category: input.category,
    suggestedAction: input.suggestedAction,
    proposalKind: input.proposalKind,
    confidenceScore,
    evidence
  });

  if (gating.blockingReasons.length > 0) {
    return {
      candidate: null,
      rejected: {
        candidate_id: input.candidateId,
        category: input.category,
        observation: input.observation,
        suggested_action: input.suggestedAction,
        confidence_score: confidenceScore,
        evidence_count: evidence.evidence_count,
        supporting_runs: evidence.supporting_runs,
        blocking_reasons: gating.blockingReasons
      }
    };
  }

  return {
    candidate: {
      candidate_id: input.candidateId,
      category: input.category,
      proposal_kind: input.proposalKind,
      observation: input.observation,
      recurrence_count: input.recurrenceCount,
      confidence_score: confidenceScore,
      suggested_action: input.suggestedAction,
      gating_tier: gating.gatingTier,
      improvement_tier: gating.improvementTier,
      required_review: gating.requiredReview,
      blocking_reasons: [],
      evidence: {
        event_ids: evidence.event_ids
      },
      evidence_count: evidence.evidence_count,
      supporting_runs: evidence.supporting_runs,
      provenance: input.provenance
    },
    rejected: null
  };
};

const buildRemediationSource = (): NonNullable<ImprovementCandidate['provenance']>['remediation_source'] => ({
  remediationStatusPath: '.playbook/remediation-status.json',
  remediationHistoryPath: '.playbook/test-autofix-history.json',
  latestResultPath: '.playbook/test-autofix.json'
});

const readRemediationArtifacts = (repoRoot: string): RemediationArtifacts => ({
  remediationStatus: readJsonIfExists<RemediationStatusArtifact>(path.join(repoRoot, '.playbook', 'remediation-status.json')),
  remediationHistory: readJsonIfExists<TestAutofixRemediationHistoryArtifact>(path.join(repoRoot, '.playbook', 'test-autofix-history.json')),
  latestResult: readJsonIfExists<TestAutofixArtifact>(path.join(repoRoot, '.playbook', 'test-autofix.json'))
});

const remediationEvidenceEvents = (entries: TestAutofixRemediationHistoryEntry[]): Array<{ event_id: string; timestamp: string }> =>
  entries.map((entry) => ({ event_id: entry.run_id, timestamp: entry.generatedAt }));

const buildRemediationProvenance = (entries: TestAutofixRemediationHistoryEntry[]): ImprovementCandidate['provenance'] => ({
  remediation_source: buildRemediationSource(),
  failure_signatures: [...new Set(entries.flatMap((entry) => entry.failure_signatures))].sort((a, b) => a.localeCompare(b)),
  repair_classes: [...new Set(entries.flatMap((entry) => entry.applied_repair_classes))].sort((a, b) => a.localeCompare(b)),
  outcomes: [...new Set(entries.map((entry) => entry.final_status))].sort((a, b) => a.localeCompare(b)),
  latest_run_ids: [...entries].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.run_id.localeCompare(a.run_id)).slice(0, 3).map((entry) => entry.run_id)
});

const generateRoutingCandidates = (
  events: RouteDecisionEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): { candidates: ImprovementCandidate[]; rejected: RejectedImprovementCandidate[] } => {
  const grouped = new Map<string, RouteDecisionEvent[]>();
  for (const event of events) {
    const key = `${event.task_family}::${event.route_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;
  const validationPressure = learning?.metrics.validation_cost_pressure ?? 0;

  const candidates: ImprovementCandidate[] = [];
  const rejected: RejectedImprovementCandidate[] = [];
  for (const [key, group] of [...grouped.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    const [taskFamily, routeId] = key.split('::');
    const averageConfidence = group.reduce((sum, event) => sum + event.confidence, 0) / Math.max(1, group.length);
    const signalScore = clamp01(averageConfidence * 0.65 + validationPressure * 0.35);

    const isDocsValidationCandidate = taskFamily === 'docs_only' && validationPressure >= 0.6;
    const observation = isDocsValidationCandidate
      ? 'docs_only tasks over-validated'
      : `Recurring route selection for ${taskFamily} tasks via ${routeId}.`;
    const suggestedAction = isDocsValidationCandidate
      ? 'reduce optional validation'
      : `codify ${routeId} as preferred baseline route for ${taskFamily} tasks`;

    const result = emitCandidate({
      candidateId: isDocsValidationCandidate
        ? 'routing_docs_overvalidation'
        : `routing_${taskFamily}_${routeId}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
      category: 'routing',
      observation,
      recurrenceCount: group.length,
      signalScore,
      learningConfidence,
      suggestedAction,
      evidenceEvents: group.map((event) => ({ event_id: event.event_id, timestamp: event.timestamp }))
    });

    if (result.candidate) {
      candidates.push(result.candidate);
    }

    if (result.rejected) {
      rejected.push(result.rejected);
    }
  }

  return { candidates, rejected };
};

const generateOrchestrationCandidates = (
  events: LaneTransitionEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): { candidates: ImprovementCandidate[]; rejected: RejectedImprovementCandidate[] } => {
  const blocked = events.filter((event) => event.to_state === 'blocked');
  const grouped = new Map<string, LaneTransitionEvent[]>();
  for (const event of blocked) {
    const reason = event.reason?.trim() || 'unknown';
    grouped.set(reason, [...(grouped.get(reason) ?? []), event]);
  }

  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;
  const results = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([reason, group]) =>
      emitCandidate({
        candidateId: `orchestration_blocked_${reason}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        category: 'orchestration',
        observation: `Lane transitions repeatedly block due to ${reason}.`,
        recurrenceCount: group.length,
        signalScore: clamp01(0.7 + (learning?.metrics.parallel_safety_realized ?? 0) * 0.15),
        learningConfidence,
        suggestedAction: `add deterministic unblock playbook for ${reason}`,
        evidenceEvents: group.map((event) => ({ event_id: event.event_id, timestamp: event.timestamp }))
      })
    );

  return {
    candidates: results.flatMap((result) => (result.candidate ? [result.candidate] : [])),
    rejected: results.flatMap((result) => (result.rejected ? [result.rejected] : []))
  };
};

const generateWorkerPromptCandidates = (
  events: WorkerAssignmentEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): { candidates: ImprovementCandidate[]; rejected: RejectedImprovementCandidate[] } => {
  const degraded = events.filter((event) => event.assignment_status === 'blocked' || event.assignment_status === 'skipped');
  const grouped = new Map<string, WorkerAssignmentEvent[]>();
  for (const event of degraded) {
    grouped.set(event.worker_id, [...(grouped.get(event.worker_id) ?? []), event]);
  }

  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;

  const results = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([workerId, group]) =>
      emitCandidate({
        candidateId: `worker_prompt_${workerId}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        category: 'worker_prompts',
        observation: `Worker ${workerId} assignments repeatedly degrade (blocked/skipped).`,
        recurrenceCount: group.length,
        signalScore: clamp01(0.68 + (1 - (learning?.metrics.reasoning_scope_efficiency ?? 0)) * 0.2),
        learningConfidence,
        suggestedAction: `tighten ${workerId} prompt contract with explicit acceptance checklist`,
        evidenceEvents: group.map((event) => ({ event_id: event.event_id, timestamp: event.timestamp }))
      })
    );

  return {
    candidates: results.flatMap((result) => (result.candidate ? [result.candidate] : [])),
    rejected: results.flatMap((result) => (result.rejected ? [result.rejected] : []))
  };
};

const generateValidationEfficiencyCandidates = (
  events: RepositoryEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): { candidates: ImprovementCandidate[]; rejected: RejectedImprovementCandidate[] } => {
  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;
  const validationPressure = learning?.metrics.validation_cost_pressure ?? 0;
  const overValidationRoutes = events.filter(
    (event): event is RouteDecisionEvent => event.event_type === 'route_decision' && event.task_family === 'docs_only'
  );

  if (overValidationRoutes.length === 0) {
    return { candidates: [], rejected: [] };
  }

  const result = emitCandidate({
    candidateId: 'validation_efficiency_docs_optional_checks',
    category: 'validation_efficiency',
    observation: 'Optional validations dominate docs-focused tasks and increase validation cost pressure.',
    recurrenceCount: overValidationRoutes.length,
    signalScore: clamp01(validationPressure),
    learningConfidence,
    suggestedAction: 'reduce optional validation for docs_only family unless risk signals are present',
    evidenceEvents: overValidationRoutes.map((event) => ({ event_id: event.event_id, timestamp: event.timestamp }))
  });

  return {
    candidates: result.candidate ? [result.candidate] : [],
    rejected: result.rejected ? [result.rejected] : []
  };
};

const generateOntologyCandidates = (
  events: ImprovementCandidateEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): { candidates: ImprovementCandidate[]; rejected: RejectedImprovementCandidate[] } => {
  const ontologyRelated = events.filter((event) => {
    const source = event.source.toLowerCase();
    const summary = event.summary.toLowerCase();
    return source.includes('ontology') || summary.includes('ontology') || summary.includes('taxonomy');
  });

  const grouped = new Map<string, ImprovementCandidateEvent[]>();
  for (const event of ontologyRelated) {
    const key = event.summary.trim().toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;
  const results = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([summary, group]) => {
      const averageEventConfidence = group.reduce((sum, event) => sum + (event.confidence ?? 0.7), 0) / Math.max(1, group.length);
      return emitCandidate({
        candidateId: `ontology_${summary}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        category: 'ontology',
        observation: `Ontology drift recurrence: ${summary}.`,
        recurrenceCount: group.length,
        signalScore: clamp01(averageEventConfidence),
        learningConfidence,
        suggestedAction: 'promote normalized ontology terms into governance dictionary and route prompts',
        evidenceEvents: group.map((event) => ({ event_id: event.event_id, timestamp: event.timestamp }))
      });
    });

  return {
    candidates: results.flatMap((result) => (result.candidate ? [result.candidate] : [])),
    rejected: results.flatMap((result) => (result.rejected ? [result.rejected] : []))
  };
};

const generateRemediationLearningCandidates = (
  remediationArtifacts: RemediationArtifacts,
  learning: LearningStateSnapshotArtifact | undefined
): { candidates: ImprovementCandidate[]; rejected: RejectedImprovementCandidate[] } => {
  const remediationStatus = remediationArtifacts.remediationStatus;
  const remediationHistory = remediationArtifacts.remediationHistory;

  if (!remediationStatus || !remediationHistory) {
    return { candidates: [], rejected: [] };
  }

  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;
  const candidates: ImprovementCandidate[] = [];
  const rejected: RejectedImprovementCandidate[] = [];

  for (const blocked of remediationStatus.telemetry.blocked_signature_rollup) {
    if (blocked.blocked_count < 2) continue;
    const entries = remediationHistory.runs.filter((entry) => entry.failure_signatures.includes(blocked.failure_signature));
    const result = emitCandidate({
      candidateId: `remediation_blocked_signature_${blocked.failure_signature}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
      category: 'remediation_learning',
      proposalKind: 'repair_class_investigation',
      observation: `Stable failure signature ${blocked.failure_signature} remains repeatedly blocked across remediation runs.`,
      recurrenceCount: entries.length,
      signalScore: 0.9,
      learningConfidence,
      suggestedAction: `propose a candidate-only investigation for an approved repair class covering ${blocked.failure_signature}; do not expand mutation authority automatically`,
      evidenceEvents: remediationEvidenceEvents(entries),
      provenance: buildRemediationProvenance(entries)
    });
    if (result.candidate) candidates.push(result.candidate);
    if (result.rejected) rejected.push(result.rejected);
  }

  for (const counterfactual of remediationStatus.telemetry.threshold_counterfactuals) {
    if (counterfactual.blocked_runs_that_would_clear === 0) continue;
    const eligibleEntries = remediationHistory.runs.filter((entry) =>
      typeof entry.autofix_confidence === 'number' && entry.autofix_confidence >= counterfactual.threshold
    );
    const result = emitCandidate({
      candidateId: `remediation_threshold_tuning_${String(counterfactual.threshold).replace('.', '_')}`,
      category: 'remediation_learning',
      proposalKind: 'threshold_tuning',
      observation: `Repeated blocked_low_confidence runs would have cleared the ${counterfactual.threshold} confidence threshold.`,
      recurrenceCount: Math.max(counterfactual.eligible_runs, eligibleEntries.length),
      signalScore: 0.92,
      learningConfidence,
      suggestedAction: `emit a candidate-only threshold tuning review for confidence threshold ${counterfactual.threshold} using stable failure signature evidence`,
      evidenceEvents: remediationEvidenceEvents(eligibleEntries),
      provenance: buildRemediationProvenance(eligibleEntries)
    });
    if (result.candidate) candidates.push(result.candidate);
    if (result.rejected) rejected.push(result.rejected);
  }

  const reviewHeavySuccessfulEntries = remediationHistory.runs.filter((entry) =>
    (entry.final_status === 'review_required_only' || entry.retry_policy_decision === 'review_required_repeat_failure') &&
    entry.applied_repair_classes.length > 0
  );
  if (reviewHeavySuccessfulEntries.length >= 2) {
    const result = emitCandidate({
      candidateId: 'remediation_verify_rule_improvement_review_pressure',
      category: 'remediation_learning',
      proposalKind: 'verify_rule_improvement',
      observation: 'Repeated review-heavy remediation cases show candidate repair classes exist but still depend on manual review pressure.',
      recurrenceCount: reviewHeavySuccessfulEntries.length,
      signalScore: 0.95,
      learningConfidence,
      suggestedAction: 'propose verify/rule improvement candidates that better classify these failure signatures before execution, without changing queue or execution behavior',
      evidenceEvents: remediationEvidenceEvents(reviewHeavySuccessfulEntries),
      provenance: buildRemediationProvenance(reviewHeavySuccessfulEntries)
    });
    if (result.candidate) candidates.push(result.candidate);
    if (result.rejected) rejected.push(result.rejected);
  }

  const successfulLowConfidenceEntries = remediationHistory.runs.filter((entry) =>
    typeof entry.autofix_confidence === 'number' &&
    entry.autofix_confidence < 0.85 &&
    (isSuccessStatus(entry.final_status) || entry.final_status === 'review_required_only')
  );
  if (successfulLowConfidenceEntries.length >= 2) {
    const result = emitCandidate({
      candidateId: 'remediation_fixture_contract_hardening_low_confidence_success',
      category: 'remediation_learning',
      proposalKind: 'fixture_contract_hardening',
      observation: 'Repeated successful but lower-confidence repairs suggest fixtures or contracts are under-specifying durable success conditions.',
      recurrenceCount: successfulLowConfidenceEntries.length,
      signalScore: 0.88,
      learningConfidence,
      suggestedAction: 'emit candidate-only fixture and contract hardening suggestions linked to the stable failure signatures and successful repair classes',
      evidenceEvents: remediationEvidenceEvents(successfulLowConfidenceEntries),
      provenance: buildRemediationProvenance(successfulLowConfidenceEntries)
    });
    if (result.candidate) candidates.push(result.candidate);
    if (result.rejected) rejected.push(result.rejected);
  }

  const docsDoctrineEntries = remediationHistory.runs.filter((entry) =>
    isBlockedStatus(entry.final_status) || (isSuccessStatus(entry.final_status) && entry.applied_repair_classes.length > 0)
  );
  if (docsDoctrineEntries.length >= 3) {
    const result = emitCandidate({
      candidateId: 'remediation_docs_doctrine_feedback_loop',
      category: 'remediation_learning',
      proposalKind: 'docs_doctrine_update',
      observation: 'Remediation history now contains enough repeated outcome evidence to suggest candidate docs/doctrine updates.',
      recurrenceCount: docsDoctrineEntries.length,
      signalScore: 0.88,
      learningConfidence,
      suggestedAction: 'propose candidate-only docs and doctrine updates stating that runtime outcomes may suggest improvements but may not mutate doctrine or policy automatically',
      evidenceEvents: remediationEvidenceEvents(docsDoctrineEntries),
      provenance: buildRemediationProvenance(docsDoctrineEntries)
    });
    if (result.candidate) candidates.push(result.candidate);
    if (result.rejected) rejected.push(result.rejected);
  }

  return {
    candidates: candidates.sort((a, b) => b.confidence_score - a.confidence_score || a.candidate_id.localeCompare(b.candidate_id)),
    rejected: rejected.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id))
  };
};

export const generateImprovementCandidates = (repoRoot: string): ImprovementCandidatesArtifact => {
  const events = readRepositoryEvents(repoRoot);
  const learningStatePath = path.join(repoRoot, '.playbook', 'learning-state.json');
  const learning = readJsonIfExists<LearningStateSnapshotArtifact>(learningStatePath);
  const compactedLearning = readJsonIfExists<LearningCompactionArtifact>(path.join(repoRoot, '.playbook', 'learning-compaction.json'))?.summary;
  const processTelemetry = readJsonIfExists<ProcessTelemetryArtifact>(path.join(repoRoot, '.playbook', 'process-telemetry.json'));
  const outcomeTelemetry = readJsonIfExists<OutcomeTelemetryArtifact>(path.join(repoRoot, '.playbook', 'outcome-telemetry.json'));
  const remediationArtifacts = readRemediationArtifacts(repoRoot);

  const routeEvents = events.filter((event): event is RouteDecisionEvent => event.event_type === 'route_decision');
  const laneTransitionEvents = events.filter((event): event is LaneTransitionEvent => event.event_type === 'lane_transition');
  const workerAssignmentEvents = events.filter((event): event is WorkerAssignmentEvent => event.event_type === 'worker_assignment');
  const improvementEvents = events.filter((event): event is ImprovementCandidateEvent => event.event_type === 'improvement_candidate');

  const generated = [
    generateRoutingCandidates(routeEvents, learning),
    generateOrchestrationCandidates(laneTransitionEvents, learning),
    generateWorkerPromptCandidates(workerAssignmentEvents, learning),
    generateValidationEfficiencyCandidates(events, learning),
    generateOntologyCandidates(improvementEvents, learning),
    generateRemediationLearningCandidates(remediationArtifacts, learning)
  ];

  const candidates = generated.flatMap((entry) => entry.candidates).sort((left, right) => {
    if (right.confidence_score !== left.confidence_score) {
      return right.confidence_score - left.confidence_score;
    }

    return left.candidate_id.localeCompare(right.candidate_id);
  });

  const rejectedCandidates = generated
    .flatMap((entry) => entry.rejected)
    .sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));

  const routerRecommendations = generateRouterRecommendations({
    events,
    learning,
    processTelemetry,
    outcomeTelemetry,
    compactedLearning
  });

  const doctrineArtifacts = generateDoctrinePromotionArtifacts({
    repoRoot,
    improvementCandidates: candidates,
    routerRecommendations,
    compactedLearning
  });
  const commandImprovements = generateCommandImprovementProposals(repoRoot, events);
  const opportunityAnalysis = analyzeImprovementOpportunities(repoRoot);

  const summary = {
    AUTO_SAFE: candidates.filter((candidate) => candidate.improvement_tier === 'auto_safe').length,
    CONVERSATIONAL: candidates.filter((candidate) => candidate.improvement_tier === 'conversation').length,
    GOVERNANCE: candidates.filter((candidate) => candidate.improvement_tier === 'governance').length,
    total: candidates.length
  };

  return {
    schemaVersion: IMPROVEMENT_CANDIDATES_SCHEMA_VERSION,
    kind: 'improvement-candidates',
    generatedAt: new Date().toISOString(),
    thresholds: {
      minimum_recurrence: MINIMUM_RECURRENCE,
      minimum_confidence: MINIMUM_CONFIDENCE
    },
    sourceArtifacts: {
      memoryEventsPath: '.playbook/memory/events/*',
      learningStatePath: '.playbook/learning-state.json',
      memoryEventCount: events.length,
      learningStateAvailable: Boolean(learning)
    },
    summary,
    router_recommendations: routerRecommendations,
    doctrine_candidates: doctrineArtifacts.candidatesArtifact,
    doctrine_promotions: doctrineArtifacts.promotionsArtifact,
    command_improvements: commandImprovements,
    opportunity_analysis: opportunityAnalysis,
    candidates,
    rejected_candidates: rejectedCandidates
  };
};

export const writeRouterRecommendationsArtifact = (
  repoRoot: string,
  artifact: RouterRecommendationsArtifact,
  artifactPath = ROUTER_RECOMMENDATIONS_RELATIVE_PATH
): string => {
  const resolvedPath = path.resolve(repoRoot, artifactPath);
  writeDeterministicJsonAtomic(resolvedPath, artifact);
  return resolvedPath;
};

export const writeImprovementCandidatesArtifact = (
  repoRoot: string,
  artifact: ImprovementCandidatesArtifact,
  artifactPath = IMPROVEMENT_CANDIDATES_RELATIVE_PATH
): string => {
  writeDoctrinePromotionArtifacts(repoRoot, {
    candidatesArtifact: artifact.doctrine_candidates,
    promotionsArtifact: artifact.doctrine_promotions
  });
  writeCommandImprovementArtifact(repoRoot, artifact.command_improvements, COMMAND_IMPROVEMENTS_RELATIVE_PATH);
  writeRouterRecommendationsArtifact(repoRoot, artifact.router_recommendations);
  const resolvedPath = path.resolve(repoRoot, artifactPath);
  writeDeterministicJsonAtomic(resolvedPath, artifact);
  return resolvedPath;
};

export const applyAutoSafeImprovements = (repoRoot: string): ImprovementActionArtifact => {
  const artifact = generateImprovementCandidates(repoRoot);
  writeImprovementCandidatesArtifact(repoRoot, artifact);

  const actionArtifact: ImprovementActionArtifact = {
    schemaVersion: IMPROVEMENT_CANDIDATES_SCHEMA_VERSION,
    kind: 'improvement-actions',
    generatedAt: new Date().toISOString(),
    action: 'apply-safe',
    applied: artifact.candidates
      .filter((candidate) => candidate.improvement_tier === 'auto_safe')
      .map((candidate) => candidate.candidate_id),
    pending_conversation: artifact.candidates
      .filter((candidate) => candidate.improvement_tier === 'conversation')
      .map((candidate) => candidate.candidate_id),
    pending_governance: artifact.candidates
      .filter((candidate) => candidate.improvement_tier === 'governance')
      .map((candidate) => candidate.candidate_id)
  };

  const outputPath = path.join(repoRoot, '.playbook', 'improvement-actions.json');
  writeDeterministicJsonAtomic(outputPath, actionArtifact);
  return actionArtifact;
};

export const approveGovernanceImprovement = (
  repoRoot: string,
  proposalId: string
): ImprovementGovernanceApprovalArtifact => {
  const candidates = generateImprovementCandidates(repoRoot).candidates;
  const target = candidates.find((candidate) => candidate.candidate_id === proposalId);

  if (!target) {
    throw new Error(`Unknown improvement proposal: ${proposalId}`);
  }

  if (target.improvement_tier !== 'governance') {
    throw new Error(`Proposal ${proposalId} is not governance-tier and does not require explicit governance approval.`);
  }

  const approvalsPath = path.join(repoRoot, '.playbook', 'improvement-approvals.json');
  const existing = readJsonIfExists<ImprovementGovernanceApprovalArtifact>(approvalsPath);

  const approvals = existing?.approvals ?? [];
  if (!approvals.some((entry) => entry.proposal_id === proposalId)) {
    approvals.push({ proposal_id: proposalId, approvedAt: new Date().toISOString() });
  }

  const artifact: ImprovementGovernanceApprovalArtifact = {
    schemaVersion: IMPROVEMENT_CANDIDATES_SCHEMA_VERSION,
    kind: 'improvement-governance-approvals',
    updatedAt: new Date().toISOString(),
    approvals: approvals.sort((left, right) => left.proposal_id.localeCompare(right.proposal_id))
  };

  writeDeterministicJsonAtomic(approvalsPath, artifact);
  return artifact;
};
