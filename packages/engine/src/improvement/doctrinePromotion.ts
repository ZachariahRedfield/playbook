import fs from 'node:fs';
import path from 'node:path';
import type { CompactedLearningSummary } from '@zachariahredfield/playbook-core';
import type { ImprovementCandidate, RouterRecommendationsArtifact } from './candidateEngine.js';
import type { RepositoryEvent } from '../memory/events.js';

export const KNOWLEDGE_CANDIDATES_RELATIVE_PATH = '.playbook/knowledge-candidates.json' as const;
export const KNOWLEDGE_PROMOTIONS_RELATIVE_PATH = '.playbook/knowledge-promotions.json' as const;

export type DoctrineLifecycleStage = 'candidate' | 'compacted' | 'promoted' | 'retired';
export type DoctrineGatingTier = 'AUTO-SAFE' | 'CONVERSATIONAL' | 'GOVERNANCE';

export type DoctrinePromotionCandidate = {
  candidate_id: string;
  source_evidence: string[];
  related_runs: string[];
  related_artifacts: string[];
  pattern_family: string;
  confidence_score: number;
  lifecycle_stage: DoctrineLifecycleStage;
  promotion_rationale: string;
  retirement_rationale: string | null;
  gating_tier: DoctrineGatingTier;
};

export type DoctrinePromotionDecision = {
  candidate_id: string;
  from_stage: DoctrineLifecycleStage;
  to_stage: DoctrineLifecycleStage;
  governance_gated: boolean;
  approved: boolean;
  rationale: string;
};

export type DoctrinePromotionCandidatesArtifact = {
  schemaVersion: '1.0';
  kind: 'knowledge-candidates';
  generatedAt: string;
  proposalOnly: true;
  nonAutonomous: true;
  candidates: DoctrinePromotionCandidate[];
};

export type DoctrinePromotionsArtifact = {
  schemaVersion: '1.0';
  kind: 'knowledge-promotions';
  generatedAt: string;
  proposalOnly: true;
  nonAutonomous: true;
  transitions: DoctrinePromotionDecision[];
};

const MIN_COMPACTED_EVIDENCE = 2;
const MIN_PROMOTED_EVIDENCE = 3;
const MIN_PROMOTED_RUNS = 2;
const MIN_PROMOTED_CONFIDENCE = 0.7;

const round4 = (value: number): number => Number(value.toFixed(4));

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const readJsonFileIfExists = <T>(filePath: string): T | undefined => {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const parseRunId = (input: string): string => {
  const idx = input.indexOf(':run:');
  if (idx >= 0) {
    return input.slice(idx + 5);
  }
  return input;
};

const dedupeSorted = (items: string[]): string[] => [...new Set(items)].sort((a, b) => a.localeCompare(b));

const toCandidateId = (input: string): string => input.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

const loadApprovals = (repoRoot: string): Set<string> => {
  const approvals = readJsonFileIfExists<{ approvals?: Array<{ proposal_id?: string }> }>(path.join(repoRoot, '.playbook', 'improvement-approvals.json'));
  return new Set((approvals?.approvals ?? []).map((entry) => entry.proposal_id).filter((id): id is string => typeof id === 'string'));
};

const loadRepositoryEvents = (repoRoot: string): RepositoryEvent[] => {
  const dir = path.join(repoRoot, '.playbook', 'memory', 'events');
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, entry.name), 'utf8')) as RepositoryEvent;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is RepositoryEvent => Boolean(entry));
};

const fromRouterRecommendations = (
  recommendations: RouterRecommendationsArtifact,
  compactedLearning: CompactedLearningSummary | undefined
): DoctrinePromotionCandidate[] => {
  const learningConfidence = compactedLearning?.confidence ?? 0;

  return recommendations.recommendations.map((recommendation) => {
    const relatedRuns = Array.from({ length: recommendation.supporting_runs }, (_, i) => `run-${i + 1}`);
    const sourceEvidence = [
      `router:${recommendation.recommendation_id}`,
      ...Array.from({ length: recommendation.evidence_count }, (_, i) => `${recommendation.recommendation_id}:evidence:${i + 1}`)
    ];
    return {
      candidate_id: toCandidateId(`router_${recommendation.recommendation_id}`),
      source_evidence: dedupeSorted(sourceEvidence),
      related_runs: relatedRuns,
      related_artifacts: dedupeSorted(['.playbook/router-recommendations.json', '.playbook/learning-compaction.json']),
      pattern_family: recommendation.task_family,
      confidence_score: round4((recommendation.confidence_score + learningConfidence) / 2),
      lifecycle_stage: 'candidate',
      promotion_rationale: recommendation.rationale,
      retirement_rationale: null,
      gating_tier: recommendation.gating_tier
    };
  });
};

const fromImprovementCandidates = (candidates: ImprovementCandidate[]): DoctrinePromotionCandidate[] =>
  candidates.map((candidate) => ({
    candidate_id: toCandidateId(`improvement_${candidate.candidate_id}`),
    source_evidence: dedupeSorted(candidate.evidence.event_ids.map((id) => `event:${id}`)),
    related_runs: dedupeSorted(candidate.evidence.event_ids.map((id) => parseRunId(id))),
    related_artifacts: dedupeSorted(['.playbook/improvement-candidates.json']),
    pattern_family: candidate.category,
    confidence_score: candidate.confidence_score,
    lifecycle_stage: 'candidate',
    promotion_rationale: candidate.suggested_action,
    retirement_rationale: null,
    gating_tier: candidate.gating_tier
  }));

const fromCompactedLearning = (summary: CompactedLearningSummary | undefined): DoctrinePromotionCandidate[] => {
  if (!summary) {
    return [];
  }

  const runEvidence = dedupeSorted(summary.source_run_ids.map((run) => `run:${run}`));
  const routeCandidates = summary.route_patterns.map((pattern) => ({
    candidate_id: toCandidateId(`compacted_route_${pattern.route_id}`),
    source_evidence: dedupeSorted([...runEvidence, `route:${pattern.route_id}`]),
    related_runs: dedupeSorted(summary.source_run_ids),
    related_artifacts: dedupeSorted(['.playbook/learning-compaction.json']),
    pattern_family: pattern.task_family,
    confidence_score: round4((summary.confidence + pattern.first_pass_rate) / 2),
    lifecycle_stage: 'candidate' as const,
    promotion_rationale: `Compacted route pattern observed for ${pattern.task_family}.`,
    retirement_rationale: null,
    gating_tier: 'CONVERSATIONAL' as const
  }));

  const recurringFailureCandidates = summary.recurring_failures.map((signal) => ({
    candidate_id: toCandidateId(`compacted_signal_${signal.signal_id}`),
    source_evidence: dedupeSorted([...runEvidence, `signal:${signal.signal_id}`]),
    related_runs: dedupeSorted(summary.source_run_ids),
    related_artifacts: dedupeSorted(['.playbook/learning-compaction.json']),
    pattern_family: signal.family,
    confidence_score: round4((summary.confidence + signal.confidence) / 2),
    lifecycle_stage: 'candidate' as const,
    promotion_rationale: `Recurring compacted signal ${signal.signal_id} detected.`,
    retirement_rationale: null,
    gating_tier: 'GOVERNANCE' as const
  }));

  return [...routeCandidates, ...recurringFailureCandidates];
};

const mergeCandidates = (candidates: DoctrinePromotionCandidate[]): DoctrinePromotionCandidate[] => {
  const grouped = new Map<string, DoctrinePromotionCandidate[]>();
  for (const candidate of candidates) {
    grouped.set(candidate.candidate_id, [...(grouped.get(candidate.candidate_id) ?? []), candidate]);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([candidateId, entries]) => {
      const first = entries[0] as DoctrinePromotionCandidate;
      const confidence = entries.reduce((sum, entry) => sum + entry.confidence_score, 0) / entries.length;
      return {
        ...first,
        candidate_id: candidateId,
        source_evidence: dedupeSorted(entries.flatMap((entry) => entry.source_evidence)),
        related_runs: dedupeSorted(entries.flatMap((entry) => entry.related_runs)),
        related_artifacts: dedupeSorted(entries.flatMap((entry) => entry.related_artifacts)),
        confidence_score: round4(confidence),
        promotion_rationale: entries.map((entry) => entry.promotion_rationale).join(' | ')
      };
    });
};

const determineLifecycle = (input: {
  current: DoctrinePromotionCandidate;
  approvals: Set<string>;
}): { candidate: DoctrinePromotionCandidate; transition: DoctrinePromotionDecision } => {
  const evidenceCount = input.current.source_evidence.length;
  const runCount = input.current.related_runs.length;
  const requiresGovernance = input.current.gating_tier === 'GOVERNANCE';
  const approved = !requiresGovernance || input.approvals.has(input.current.candidate_id);

  let nextStage: DoctrineLifecycleStage = 'candidate';
  let rationale = 'Evidence recorded for candidate review.';

  if (evidenceCount >= MIN_COMPACTED_EVIDENCE) {
    nextStage = 'compacted';
    rationale = 'Evidence compaction threshold met.';
  }

  if (evidenceCount >= MIN_PROMOTED_EVIDENCE && runCount >= MIN_PROMOTED_RUNS && input.current.confidence_score >= MIN_PROMOTED_CONFIDENCE) {
    if (approved) {
      nextStage = 'promoted';
      rationale = requiresGovernance
        ? 'Governance-gated promotion approved with sufficient repeated evidence.'
        : 'Promotion threshold met with repeated inspectable evidence.';
    } else {
      nextStage = 'compacted';
      rationale = 'Promotion threshold met but governance approval missing.';
    }
  }

  return {
    candidate: {
      ...input.current,
      lifecycle_stage: nextStage,
      promotion_rationale: rationale,
      retirement_rationale: null
    },
    transition: {
      candidate_id: input.current.candidate_id,
      from_stage: 'candidate',
      to_stage: nextStage,
      governance_gated: requiresGovernance,
      approved,
      rationale
    }
  };
};

const proposeRetirements = (input: {
  nextCandidates: DoctrinePromotionCandidate[];
  previousCandidates: DoctrinePromotionCandidate[];
}): DoctrinePromotionCandidate[] => {
  const nextIds = new Set(input.nextCandidates.map((candidate) => candidate.candidate_id));
  return input.previousCandidates
    .filter((candidate) => candidate.lifecycle_stage === 'promoted' && !nextIds.has(candidate.candidate_id))
    .map((candidate) => ({
      ...candidate,
      lifecycle_stage: 'retired',
      retirement_rationale: 'No repeated evidence in current cycle; propose retirement to avoid premature doctrine crystallization.'
    }));
};

export const generateDoctrinePromotionArtifacts = (input: {
  repoRoot: string;
  improvementCandidates: ImprovementCandidate[];
  routerRecommendations: RouterRecommendationsArtifact;
  compactedLearning: CompactedLearningSummary | undefined;
}): { candidatesArtifact: DoctrinePromotionCandidatesArtifact; promotionsArtifact: DoctrinePromotionsArtifact } => {
  const memoryEvents = loadRepositoryEvents(input.repoRoot);
  const approvals = loadApprovals(input.repoRoot);

  const previousCandidates =
    readJsonFileIfExists<DoctrinePromotionCandidatesArtifact>(path.join(input.repoRoot, KNOWLEDGE_CANDIDATES_RELATIVE_PATH))?.candidates ?? [];

  const normalizedMemoryCandidates: DoctrinePromotionCandidate[] = memoryEvents.map((event) => ({
    candidate_id: toCandidateId(`memory_${event.event_type}_${event.event_id}`),
    source_evidence: [`memory-event:${event.event_id}`],
    related_runs: event.run_id ? [event.run_id] : [],
    related_artifacts: dedupeSorted([`.playbook/memory/events/${event.event_id}.json`]),
    pattern_family: event.subsystem,
    confidence_score: 0.6,
    lifecycle_stage: 'candidate',
    promotion_rationale: `Normalized memory evidence for ${event.event_type}.`,
    retirement_rationale: null,
    gating_tier: 'CONVERSATIONAL'
  }));

  const mergedCandidates = mergeCandidates([
    ...fromCompactedLearning(input.compactedLearning),
    ...fromRouterRecommendations(input.routerRecommendations, input.compactedLearning),
    ...fromImprovementCandidates(input.improvementCandidates),
    ...normalizedMemoryCandidates
  ]);

  const transitioned = mergedCandidates.map((candidate) => determineLifecycle({ current: candidate, approvals }));
  const activeCandidates = transitioned.map((entry) => entry.candidate);
  const retirements = proposeRetirements({ nextCandidates: activeCandidates, previousCandidates });

  const transitions: DoctrinePromotionDecision[] = transitioned.map((entry) => entry.transition);
  for (const retirement of retirements) {
    transitions.push({
      candidate_id: retirement.candidate_id,
      from_stage: 'promoted',
      to_stage: 'retired',
      governance_gated: retirement.gating_tier === 'GOVERNANCE',
      approved: true,
      rationale: retirement.retirement_rationale ?? 'Retirement proposed due to missing evidence.'
    });
  }

  const generatedAt = new Date().toISOString();
  return {
    candidatesArtifact: {
      schemaVersion: '1.0',
      kind: 'knowledge-candidates',
      generatedAt,
      proposalOnly: true,
      nonAutonomous: true,
      candidates: [...activeCandidates, ...retirements].sort((a, b) => a.candidate_id.localeCompare(b.candidate_id))
    },
    promotionsArtifact: {
      schemaVersion: '1.0',
      kind: 'knowledge-promotions',
      generatedAt,
      proposalOnly: true,
      nonAutonomous: true,
      transitions: transitions.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id))
    }
  };
};

export const writeDoctrinePromotionArtifacts = (
  repoRoot: string,
  artifacts: { candidatesArtifact: DoctrinePromotionCandidatesArtifact; promotionsArtifact: DoctrinePromotionsArtifact }
): { candidatesPath: string; promotionsPath: string } => {
  const candidatesPath = path.resolve(repoRoot, KNOWLEDGE_CANDIDATES_RELATIVE_PATH);
  const promotionsPath = path.resolve(repoRoot, KNOWLEDGE_PROMOTIONS_RELATIVE_PATH);

  fs.mkdirSync(path.dirname(candidatesPath), { recursive: true });
  fs.mkdirSync(path.dirname(promotionsPath), { recursive: true });

  fs.writeFileSync(candidatesPath, deterministicStringify(artifacts.candidatesArtifact), 'utf8');
  fs.writeFileSync(promotionsPath, deterministicStringify(artifacts.promotionsArtifact), 'utf8');

  return { candidatesPath, promotionsPath };
};
