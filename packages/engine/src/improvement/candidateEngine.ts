import fs from 'node:fs';
import path from 'node:path';
import type { LearningStateSnapshotArtifact } from '../telemetry/learningState.js';
import type {
  ImprovementCandidateEvent,
  LaneTransitionEvent,
  RepositoryEvent,
  RouteDecisionEvent,
  WorkerAssignmentEvent
} from '../memory/events.js';

export const IMPROVEMENT_CANDIDATES_SCHEMA_VERSION = '1.0' as const;
export const IMPROVEMENT_CANDIDATES_RELATIVE_PATH = '.playbook/improvement-candidates.json' as const;

export type ImprovementCandidateCategory =
  | 'routing'
  | 'orchestration'
  | 'worker_prompts'
  | 'validation_efficiency'
  | 'ontology';

export type ImprovementTier = 'auto_safe' | 'conversation' | 'governance';

export type ImprovementCandidate = {
  candidate_id: string;
  category: ImprovementCandidateCategory;
  observation: string;
  recurrence_count: number;
  evidence_count: number;
  supporting_runs: number;
  confidence_score: number;
  confidence: number;
  suggested_action: string;
  gating_tier: ImprovementTier;
  improvement_tier: ImprovementTier;
  required_review: boolean;
  blocking_reasons: string[];
  evidence: {
    event_ids: string[];
  };
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
  candidates: ImprovementCandidate[];
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
const AUTO_SAFE_MIN_EVIDENCE_COUNT = 5;
const AUTO_SAFE_MIN_SUPPORTING_RUNS = 3;
const AUTO_SAFE_MIN_CONFIDENCE = 0.78;
const CONVERSATIONAL_MIN_EVIDENCE_COUNT = 3;
const CONVERSATIONAL_MIN_SUPPORTING_RUNS = 2;

const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const readJsonFileIfExists = <T>(filePath: string): T | undefined => {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const readRepositoryEvents = (repoRoot: string): RepositoryEvent[] => {
  const eventsDir = path.join(repoRoot, '.playbook', 'memory', 'events');
  if (!fs.existsSync(eventsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(eventsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const events: RepositoryEvent[] = [];

  for (const fileName of files) {
    const eventPath = path.join(eventsDir, fileName);
    try {
      const parsed = JSON.parse(fs.readFileSync(eventPath, 'utf8')) as RepositoryEvent;
      if (parsed && typeof parsed.event_type === 'string' && typeof parsed.event_id === 'string') {
        events.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return events;
};

const buildConfidence = (recurrenceCount: number, signalScore: number, learningConfidence: number): number =>
  round4(clamp01(Math.min(1, recurrenceCount / 10) * 0.45 + signalScore * 0.4 + learningConfidence * 0.15));

const summarizeSupportingRuns = (timestamps: string[]): number => {
  const runKeys = new Set<string>();
  for (const timestamp of timestamps) {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    runKeys.add(parsed.toISOString().slice(0, 10));
  }

  return runKeys.size;
};

const hasGovernanceRisk = (input: { category: ImprovementCandidateCategory; observation: string; suggestedAction: string }): boolean => {
  const signal = `${input.observation} ${input.suggestedAction}`.toLowerCase();
  return (
    input.category === 'ontology' ||
    signal.includes('schema') ||
    signal.includes('trust boundary') ||
    signal.includes('doctrine') ||
    signal.includes('governance') ||
    signal.includes('taxonomy')
  );
};

const evaluateGatingTier = (input: {
  category: ImprovementCandidateCategory;
  observation: string;
  suggestedAction: string;
  evidenceCount: number;
  supportingRuns: number;
  confidenceScore: number;
}): { gatingTier: ImprovementTier; requiredReview: boolean; blockingReasons: string[] } => {
  const governanceRisk = hasGovernanceRisk(input);
  const blockingReasons: string[] = [];

  if (governanceRisk) {
    blockingReasons.push('trust-boundary or doctrine-sensitive change requires governance review');
    return { gatingTier: 'governance', requiredReview: true, blockingReasons };
  }

  if (input.evidenceCount < AUTO_SAFE_MIN_EVIDENCE_COUNT) {
    blockingReasons.push(`insufficient repeated evidence for AUTO-SAFE (needs >= ${AUTO_SAFE_MIN_EVIDENCE_COUNT})`);
  }
  if (input.supportingRuns < AUTO_SAFE_MIN_SUPPORTING_RUNS) {
    blockingReasons.push(`insufficient run diversity for AUTO-SAFE (needs >= ${AUTO_SAFE_MIN_SUPPORTING_RUNS})`);
  }
  if (input.confidenceScore < AUTO_SAFE_MIN_CONFIDENCE) {
    blockingReasons.push(`confidence below AUTO-SAFE threshold (${AUTO_SAFE_MIN_CONFIDENCE})`);
  }

  if (blockingReasons.length === 0) {
    return { gatingTier: 'auto_safe', requiredReview: false, blockingReasons: [] };
  }

  if (input.evidenceCount < CONVERSATIONAL_MIN_EVIDENCE_COUNT) {
    blockingReasons.push(`insufficient evidence for CONVERSATIONAL (needs >= ${CONVERSATIONAL_MIN_EVIDENCE_COUNT})`);
  }
  if (input.supportingRuns < CONVERSATIONAL_MIN_SUPPORTING_RUNS) {
    blockingReasons.push(`insufficient run diversity for CONVERSATIONAL (needs >= ${CONVERSATIONAL_MIN_SUPPORTING_RUNS})`);
  }

  const conversationalEligible =
    input.evidenceCount >= CONVERSATIONAL_MIN_EVIDENCE_COUNT &&
    input.supportingRuns >= CONVERSATIONAL_MIN_SUPPORTING_RUNS &&
    input.confidenceScore >= MINIMUM_CONFIDENCE;

  if (conversationalEligible) {
    return { gatingTier: 'conversation', requiredReview: true, blockingReasons };
  }

  return {
    gatingTier: 'governance',
    requiredReview: true,
    blockingReasons: [...blockingReasons, 'proposal failed deterministic evidence thresholds; governance adjudication required']
  };
};

const emitCandidate = (input: {
  candidateId: string;
  category: ImprovementCandidateCategory;
  observation: string;
  recurrenceCount: number;
  signalScore: number;
  learningConfidence: number;
  suggestedAction: string;
  eventIds: string[];
  eventTimestamps: string[];
}): ImprovementCandidate | null => {
  const confidenceScore = buildConfidence(input.recurrenceCount, input.signalScore, input.learningConfidence);
  const evidenceCount = input.eventIds.length;
  const supportingRuns = summarizeSupportingRuns(input.eventTimestamps);

  if (input.recurrenceCount < MINIMUM_RECURRENCE || confidenceScore < MINIMUM_CONFIDENCE) {
    return null;
  }

  const gating = evaluateGatingTier({
    category: input.category,
    observation: input.observation,
    suggestedAction: input.suggestedAction,
    evidenceCount,
    supportingRuns,
    confidenceScore
  });

  return {
    candidate_id: input.candidateId,
    category: input.category,
    observation: input.observation,
    recurrence_count: input.recurrenceCount,
    evidence_count: evidenceCount,
    supporting_runs: supportingRuns,
    confidence_score: confidenceScore,
    confidence: confidenceScore,
    suggested_action: input.suggestedAction,
    gating_tier: gating.gatingTier,
    improvement_tier: gating.gatingTier,
    required_review: gating.requiredReview,
    blocking_reasons: gating.blockingReasons,
    evidence: {
      event_ids: [...input.eventIds].sort((left, right) => left.localeCompare(right))
    }
  };
};

const generateRoutingCandidates = (
  events: RouteDecisionEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): ImprovementCandidate[] => {
  const grouped = new Map<string, RouteDecisionEvent[]>();
  for (const event of events) {
    const key = `${event.task_family}::${event.route_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;
  const validationPressure = learning?.metrics.validation_cost_pressure ?? 0;

  const candidates: ImprovementCandidate[] = [];
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

    const candidate = emitCandidate({
      candidateId: isDocsValidationCandidate
        ? 'routing_docs_overvalidation'
        : `routing_${taskFamily}_${routeId}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
      category: 'routing',
      observation,
      recurrenceCount: group.length,
      signalScore,
      learningConfidence,
      suggestedAction,
      eventIds: group.map((event) => event.event_id),
      eventTimestamps: group.map((event) => event.timestamp)
    });

    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
};

const generateOrchestrationCandidates = (
  events: LaneTransitionEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): ImprovementCandidate[] => {
  const blocked = events.filter((event) => event.to_state === 'blocked');
  const grouped = new Map<string, LaneTransitionEvent[]>();
  for (const event of blocked) {
    const reason = event.reason?.trim() || 'unknown';
    grouped.set(reason, [...(grouped.get(reason) ?? []), event]);
  }

  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;
  return [...grouped.entries()]
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
        eventIds: group.map((event) => event.event_id),
        eventTimestamps: group.map((event) => event.timestamp)
      })
    )
    .filter((candidate): candidate is ImprovementCandidate => Boolean(candidate));
};

const generateWorkerPromptCandidates = (
  events: WorkerAssignmentEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): ImprovementCandidate[] => {
  const degraded = events.filter((event) => event.assignment_status === 'blocked' || event.assignment_status === 'skipped');
  const grouped = new Map<string, WorkerAssignmentEvent[]>();
  for (const event of degraded) {
    grouped.set(event.worker_id, [...(grouped.get(event.worker_id) ?? []), event]);
  }

  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;

  return [...grouped.entries()]
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
        eventIds: group.map((event) => event.event_id),
        eventTimestamps: group.map((event) => event.timestamp)
      })
    )
    .filter((candidate): candidate is ImprovementCandidate => Boolean(candidate));
};

const generateValidationEfficiencyCandidates = (
  events: RepositoryEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): ImprovementCandidate[] => {
  const learningConfidence = learning?.confidenceSummary.overall_confidence ?? 0;
  const validationPressure = learning?.metrics.validation_cost_pressure ?? 0;
  const overValidationRoutes = events.filter(
    (event): event is RouteDecisionEvent => event.event_type === 'route_decision' && event.task_family === 'docs_only'
  );

  const candidate = emitCandidate({
    candidateId: 'validation_efficiency_docs_optional_checks',
    category: 'validation_efficiency',
    observation: 'Optional validations dominate docs-focused tasks and increase validation cost pressure.',
    recurrenceCount: overValidationRoutes.length,
    signalScore: clamp01(validationPressure),
    learningConfidence,
    suggestedAction: 'reduce optional validation for docs_only family unless risk signals are present',
    eventIds: overValidationRoutes.map((event) => event.event_id),
    eventTimestamps: overValidationRoutes.map((event) => event.timestamp)
  });

  return candidate ? [candidate] : [];
};

const generateOntologyCandidates = (
  events: ImprovementCandidateEvent[],
  learning: LearningStateSnapshotArtifact | undefined
): ImprovementCandidate[] => {
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
  return [...grouped.entries()]
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
        eventIds: group.map((event) => event.event_id),
        eventTimestamps: group.map((event) => event.timestamp)
      });
    })
    .filter((candidate): candidate is ImprovementCandidate => Boolean(candidate));
};

export const generateImprovementCandidates = (repoRoot: string): ImprovementCandidatesArtifact => {
  const events = readRepositoryEvents(repoRoot);
  const learningStatePath = path.join(repoRoot, '.playbook', 'learning-state.json');
  const learning = readJsonFileIfExists<LearningStateSnapshotArtifact>(learningStatePath);

  const routeEvents = events.filter((event): event is RouteDecisionEvent => event.event_type === 'route_decision');
  const laneTransitionEvents = events.filter((event): event is LaneTransitionEvent => event.event_type === 'lane_transition');
  const workerAssignmentEvents = events.filter((event): event is WorkerAssignmentEvent => event.event_type === 'worker_assignment');
  const improvementEvents = events.filter((event): event is ImprovementCandidateEvent => event.event_type === 'improvement_candidate');

  const candidates = [
    ...generateRoutingCandidates(routeEvents, learning),
    ...generateOrchestrationCandidates(laneTransitionEvents, learning),
    ...generateWorkerPromptCandidates(workerAssignmentEvents, learning),
    ...generateValidationEfficiencyCandidates(events, learning),
    ...generateOntologyCandidates(improvementEvents, learning)
  ].sort((left, right) => {
    if (right.confidence_score !== left.confidence_score) {
      return right.confidence_score - left.confidence_score;
    }

    return left.candidate_id.localeCompare(right.candidate_id);
  });

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
    candidates
  };
};

export const writeImprovementCandidatesArtifact = (
  repoRoot: string,
  artifact: ImprovementCandidatesArtifact,
  artifactPath = IMPROVEMENT_CANDIDATES_RELATIVE_PATH
): string => {
  const resolvedPath = path.resolve(repoRoot, artifactPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, deterministicStringify(artifact), 'utf8');
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
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, deterministicStringify(actionArtifact), 'utf8');
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
  const existing = readJsonFileIfExists<ImprovementGovernanceApprovalArtifact>(approvalsPath);

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

  fs.mkdirSync(path.dirname(approvalsPath), { recursive: true });
  fs.writeFileSync(approvalsPath, deterministicStringify(artifact), 'utf8');
  return artifact;
};
