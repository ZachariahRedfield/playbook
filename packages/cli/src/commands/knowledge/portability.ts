import { readCrossRepoPatternsArtifact } from '@zachariahredfield/playbook-engine';

type PortabilityRiskSignal = 'dependency mismatch' | 'outcome volatility' | 'low instance diversity' | 'governance instability';

type PortabilityRecord = {
  pattern_id: string;
  source_repo: string;
  portability_score: number;
  evidence_runs: number;
  compatible_subsystems: string[];
  risk_signals: PortabilityRiskSignal[];
};

type PortabilityRecommendationRecord = {
  pattern: string;
  source_repo: string;
  target_repo: string;
  initial_portability_score: number;
  decision_status: 'recommended' | 'monitor';
  evidence_count: number;
};

type PortabilityOutcomeRecord = {
  pattern: string;
  source_repo: string;
  target_repo: string;
  initial_portability_score: number;
  adoption_status: 'adopted' | 'trial' | 'deferred';
  observed_outcome: 'positive' | 'mixed' | 'negative';
  sample_size: number;
};

type PortabilityRecalibrationRecord = {
  pattern: string;
  source_repo: string;
  target_repo: string;
  initial_portability_score: number;
  recalibrated_confidence: number;
  evidence_count: number;
  sample_size: number;
};

type CrossRepoAggregate = {
  pattern_id: string;
  portability_score: number;
  repo_count: number;
  outcome_consistency: number;
  instance_diversity: number;
  governance_stability: number;
};

type CrossRepoRepository = {
  id: string;
  patterns: Array<{ pattern_id: string; strength: number; instance_count: number }>;
};

type CrossRepoPatternsArtifact = {
  aggregates: CrossRepoAggregate[];
  repositories: CrossRepoRepository[];
  portability_recommendations?: PortabilityRecommendationRecord[];
  portability_outcomes?: PortabilityOutcomeRecord[];
  portability_recalibration?: PortabilityRecalibrationRecord[];
};

export type PortabilityView = 'overview' | 'recommendations' | 'outcomes' | 'recalibration';

const clamp = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(4))));

const inferCompatibleSubsystems = (patternId: string): string[] => {
  const tokenized = patternId.toLowerCase();
  const subsystems = new Set<string>();

  if (tokenized.includes('bootstrap') || tokenized.includes('contract')) {
    subsystems.add('bootstrap_contract_surface');
  }
  if (tokenized.includes('knowledge') || tokenized.includes('memory')) {
    subsystems.add('knowledge_lifecycle');
  }
  if (tokenized.includes('telemetry') || tokenized.includes('learning')) {
    subsystems.add('telemetry_learning');
  }
  if (tokenized.includes('route') || tokenized.includes('routing') || tokenized.includes('lane')) {
    subsystems.add('routing_engine');
  }

  return [...subsystems].sort((left, right) => left.localeCompare(right));
};

const inferRiskSignals = (entry: CrossRepoAggregate): PortabilityRiskSignal[] => {
  const risks = new Set<PortabilityRiskSignal>();

  if (entry.outcome_consistency < 0.8) {
    risks.add('dependency mismatch');
  }
  if (entry.outcome_consistency < 0.65) {
    risks.add('outcome volatility');
  }
  if (entry.instance_diversity < 0.6) {
    risks.add('low instance diversity');
  }
  if (entry.governance_stability < 0.75) {
    risks.add('governance instability');
  }

  return [...risks];
};

const resolveSourceRepo = (repositories: CrossRepoRepository[], patternId: string): string => {
  const ranked = repositories
    .map((repository) => ({
      id: repository.id,
      match: repository.patterns.find((pattern) => pattern.pattern_id === patternId)
    }))
    .filter((entry): entry is { id: string; match: { pattern_id: string; strength: number; instance_count: number } } => Boolean(entry.match))
    .sort((left, right) => right.match.strength - left.match.strength || right.match.instance_count - left.match.instance_count || left.id.localeCompare(right.id));

  return ranked[0]?.id ?? 'unknown';
};

const derivePortabilityRecords = (artifact: CrossRepoPatternsArtifact): PortabilityRecord[] =>
  artifact.aggregates.map((entry) => ({
    pattern_id: entry.pattern_id,
    source_repo: resolveSourceRepo(artifact.repositories, entry.pattern_id),
    portability_score: entry.portability_score,
    evidence_runs: entry.repo_count,
    compatible_subsystems: inferCompatibleSubsystems(entry.pattern_id),
    risk_signals: inferRiskSignals(entry)
  }));

const deriveRecommendations = (artifact: CrossRepoPatternsArtifact): PortabilityRecommendationRecord[] => {
  if (Array.isArray(artifact.portability_recommendations)) {
    return [...artifact.portability_recommendations];
  }

  const recommendations: PortabilityRecommendationRecord[] = [];
  for (const aggregate of artifact.aggregates) {
    const sourceRepo = resolveSourceRepo(artifact.repositories, aggregate.pattern_id);
    const reposWithPattern = new Set(
      artifact.repositories
        .filter((repository) => repository.patterns.some((pattern) => pattern.pattern_id === aggregate.pattern_id))
        .map((repository) => repository.id)
    );

    for (const repository of artifact.repositories) {
      if (reposWithPattern.has(repository.id)) {
        continue;
      }

      recommendations.push({
        pattern: aggregate.pattern_id,
        source_repo: sourceRepo,
        target_repo: repository.id,
        initial_portability_score: aggregate.portability_score,
        decision_status: aggregate.portability_score >= 0.7 ? 'recommended' : 'monitor',
        evidence_count: aggregate.repo_count
      });
    }
  }

  return recommendations.sort(
    (left, right) =>
      right.initial_portability_score - left.initial_portability_score ||
      left.pattern.localeCompare(right.pattern) ||
      left.target_repo.localeCompare(right.target_repo)
  );
};

const classifyOutcome = (portabilityScore: number): PortabilityOutcomeRecord['observed_outcome'] => {
  if (portabilityScore >= 0.8) {
    return 'positive';
  }
  if (portabilityScore >= 0.6) {
    return 'mixed';
  }
  return 'negative';
};

const classifyAdoption = (portabilityScore: number): PortabilityOutcomeRecord['adoption_status'] => {
  if (portabilityScore >= 0.75) {
    return 'adopted';
  }
  if (portabilityScore >= 0.6) {
    return 'trial';
  }
  return 'deferred';
};

const deriveOutcomes = (artifact: CrossRepoPatternsArtifact, recommendations: PortabilityRecommendationRecord[]): PortabilityOutcomeRecord[] => {
  if (Array.isArray(artifact.portability_outcomes)) {
    return [...artifact.portability_outcomes];
  }

  return recommendations.map((recommendation) => ({
    pattern: recommendation.pattern,
    source_repo: recommendation.source_repo,
    target_repo: recommendation.target_repo,
    initial_portability_score: recommendation.initial_portability_score,
    adoption_status: classifyAdoption(recommendation.initial_portability_score),
    observed_outcome: classifyOutcome(recommendation.initial_portability_score),
    sample_size: recommendation.evidence_count
  }));
};

const deriveRecalibration = (artifact: CrossRepoPatternsArtifact, outcomes: PortabilityOutcomeRecord[]): PortabilityRecalibrationRecord[] => {
  if (Array.isArray(artifact.portability_recalibration)) {
    return [...artifact.portability_recalibration];
  }

  const aggregateByPattern = new Map(artifact.aggregates.map((entry) => [entry.pattern_id, entry]));

  return outcomes.map((outcome) => {
    const aggregate = aggregateByPattern.get(outcome.pattern);
    const outcomeMultiplier = outcome.observed_outcome === 'positive' ? 1 : outcome.observed_outcome === 'mixed' ? 0.92 : 0.8;
    const consistency = aggregate?.outcome_consistency ?? 0.5;
    const adjusted = clamp(outcome.initial_portability_score * 0.65 + consistency * 0.35 * outcomeMultiplier);

    return {
      pattern: outcome.pattern,
      source_repo: outcome.source_repo,
      target_repo: outcome.target_repo,
      initial_portability_score: outcome.initial_portability_score,
      recalibrated_confidence: adjusted,
      evidence_count: aggregate?.repo_count ?? outcome.sample_size,
      sample_size: outcome.sample_size
    };
  });
};

export const parsePortabilityView = (args: string[]): PortabilityView => {
  const rawView = args.find((arg) => arg.startsWith('--view='))?.slice('--view='.length) ?? (() => {
    const index = args.findIndex((arg) => arg === '--view');
    return index >= 0 ? args[index + 1] : undefined;
  })();

  if (!rawView || rawView === 'overview') {
    return 'overview';
  }

  if (rawView === 'recommendations' || rawView === 'outcomes' || rawView === 'recalibration') {
    return rawView;
  }

  throw new Error(`playbook knowledge portability: invalid --view value "${rawView}"; expected overview, recommendations, outcomes, or recalibration`);
};

export const runKnowledgePortability = (
  cwd: string,
  view: PortabilityView = 'overview'
):
  | { schemaVersion: '1.0'; command: 'knowledge-portability'; portability: PortabilityRecord[] }
  | { schemaVersion: '1.0'; command: 'knowledge-portability-recommendations'; recommendations: PortabilityRecommendationRecord[] }
  | { schemaVersion: '1.0'; command: 'knowledge-portability-outcomes'; outcomes: PortabilityOutcomeRecord[] }
  | { schemaVersion: '1.0'; command: 'knowledge-portability-recalibration'; recalibration: PortabilityRecalibrationRecord[] } => {
  const artifact = readCrossRepoPatternsArtifact(cwd) as CrossRepoPatternsArtifact;

  if (view === 'overview') {
    return {
      schemaVersion: '1.0',
      command: 'knowledge-portability',
      portability: derivePortabilityRecords(artifact)
    };
  }

  const recommendations = deriveRecommendations(artifact);
  if (view === 'recommendations') {
    return {
      schemaVersion: '1.0',
      command: 'knowledge-portability-recommendations',
      recommendations
    };
  }

  const outcomes = deriveOutcomes(artifact, recommendations);
  if (view === 'outcomes') {
    return {
      schemaVersion: '1.0',
      command: 'knowledge-portability-outcomes',
      outcomes
    };
  }

  return {
    schemaVersion: '1.0',
    command: 'knowledge-portability-recalibration',
    recalibration: deriveRecalibration(artifact, outcomes)
  };
};
