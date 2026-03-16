import { findPortabilityOutcomes, getPortabilityOutcomeSummary, readCrossRepoPatternsArtifact } from '@zachariahredfield/playbook-engine';

type PortabilityRiskSignal = 'dependency mismatch' | 'outcome volatility' | 'low instance diversity' | 'governance instability';

type PortabilityRecord = {
  pattern_id: string;
  source_repo: string;
  portability_score: number;
  evidence_runs: number;
  compatible_subsystems: string[];
  risk_signals: PortabilityRiskSignal[];
  portability_outcomes: {
    total_records: number;
    accepted: number;
    rejected: number;
    successful: number;
    unsuccessful: number;
    inconclusive: number;
  };
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

type PortabilityOutcomeEntry = {
  decision_status?: string;
  observed_outcome?: string;
};

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

export const runKnowledgePortability = (cwd: string): { schemaVersion: '1.0'; command: 'knowledge-portability'; portability: PortabilityRecord[] } => {
  const artifact = readCrossRepoPatternsArtifact(cwd) as { aggregates: CrossRepoAggregate[]; repositories: CrossRepoRepository[] };
  const outcomes = getPortabilityOutcomeSummary(cwd);

  const portability = artifact.aggregates.map((entry) => {
    const patternOutcomes = findPortabilityOutcomes(cwd, { pattern_id: entry.pattern_id }) as PortabilityOutcomeEntry[];
    return {
      pattern_id: entry.pattern_id,
      source_repo: resolveSourceRepo(artifact.repositories, entry.pattern_id),
      portability_score: entry.portability_score,
      evidence_runs: entry.repo_count,
      compatible_subsystems: inferCompatibleSubsystems(entry.pattern_id),
      risk_signals: inferRiskSignals(entry),
      portability_outcomes: {
        total_records: outcomes.by_pattern[entry.pattern_id] ?? 0,
        accepted: patternOutcomes.filter((record) => record.decision_status === 'accepted').length,
        rejected: patternOutcomes.filter((record) => record.decision_status === 'rejected').length,
        successful: patternOutcomes.filter((record) => record.observed_outcome === 'successful').length,
        unsuccessful: patternOutcomes.filter((record) => record.observed_outcome === 'unsuccessful').length,
        inconclusive: patternOutcomes.filter((record) => record.observed_outcome === 'inconclusive').length
      }
    };
  });

  return {
    schemaVersion: '1.0',
    command: 'knowledge-portability',
    portability
  };
};
