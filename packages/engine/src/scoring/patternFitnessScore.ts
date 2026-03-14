import {
  calculateGovernanceAlignmentScore,
  type AttractorScore,
  type PatternGraphPattern
} from './patternAttractorScore.js';

export type PatternFitnessSignals = {
  outcome_stability: number;
  defect_reduction: number;
  governance_alignment: number;
  architectural_clarity: number;
  cross_repo_success: number;
};

export type PatternFitnessScoreResult = PatternFitnessSignals & {
  fitness_score: number;
};

export type PatternOutcomeLinks = Partial<PatternFitnessSignals>;

export type RankedPatternStrength = {
  pattern: PatternGraphPattern;
  pattern_strength: number;
};

const clamp = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(4))));

const sanitizeRefId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9._:/-]/g, '-');

const resolveSignal = (pattern: PatternGraphPattern, signal: string): number => {
  const entry = [...pattern.scores].reverse().find((score) => score.signal === signal);
  return clamp(entry?.value ?? 0);
};

const deriveOutcomeStability = (pattern: PatternGraphPattern): number => {
  const instanceSignal = clamp(pattern.instance_refs.length / 5);
  const evidenceSignal = clamp(pattern.evidence_refs.length / 5);
  return clamp(instanceSignal * 0.6 + evidenceSignal * 0.4);
};

const deriveDefectReduction = (pattern: PatternGraphPattern): number => {
  const mechanismSignal = clamp(pattern.mechanism_refs.length / 4);
  const evidenceSignal = clamp(pattern.evidence_refs.length / 5);
  return clamp(mechanismSignal * 0.5 + evidenceSignal * 0.5);
};

const deriveArchitecturalClarity = (pattern: PatternGraphPattern): number => {
  const layer = pattern.layer.toLowerCase();
  const layerSignal = layer.includes('architecture') ? 1 : layer.includes('governance') ? 0.85 : 0.65;
  const relationSignal = clamp(pattern.relation_edges.length / 5);
  return clamp(layerSignal * 0.75 + relationSignal * 0.25);
};

const deriveCrossRepoSuccess = (pattern: PatternGraphPattern): number => {
  const sourceSignal = pattern.source === 'repository-native' ? 0.8 : 0.6;
  const evidenceSignal = clamp(pattern.evidence_refs.length / 5);
  return clamp(sourceSignal * 0.7 + evidenceSignal * 0.3);
};

export const computePatternFitness = (
  pattern: PatternGraphPattern,
  outcomeLinks: PatternOutcomeLinks = {}
): PatternFitnessScoreResult => {
  const outcome_stability = clamp(outcomeLinks.outcome_stability ?? deriveOutcomeStability(pattern));
  const defect_reduction = clamp(outcomeLinks.defect_reduction ?? deriveDefectReduction(pattern));
  const governance_alignment = clamp(outcomeLinks.governance_alignment ?? calculateGovernanceAlignmentScore(pattern));
  const architectural_clarity = clamp(outcomeLinks.architectural_clarity ?? deriveArchitecturalClarity(pattern));
  const cross_repo_success = clamp(outcomeLinks.cross_repo_success ?? deriveCrossRepoSuccess(pattern));

  const fitness_score = clamp(
    outcome_stability * 0.3 +
      defect_reduction * 0.25 +
      governance_alignment * 0.2 +
      architectural_clarity * 0.15 +
      cross_repo_success * 0.1
  );

  return {
    outcome_stability,
    defect_reduction,
    governance_alignment,
    architectural_clarity,
    cross_repo_success,
    fitness_score
  };
};

export const appendFitnessStrengthScore = (
  pattern: PatternGraphPattern,
  fitness: PatternFitnessScoreResult,
  updatedAt: string
): PatternGraphPattern => {
  const id = sanitizeRefId(`score.${pattern.id}.fitness.${updatedAt}`);
  const entry: AttractorScore = {
    id,
    signal: 'fitness-strength',
    value: fitness.fitness_score,
    updatedAt,
    notes: 'Fitness score represents correlation between pattern use and downstream outcomes.'
  };

  return {
    ...pattern,
    scores: [...pattern.scores, entry]
  };
};

export const computePatternStrength = (pattern: PatternGraphPattern): number => {
  const attractorScore = resolveSignal(pattern, 'attractor-strength');
  const fitnessScore = resolveSignal(pattern, 'fitness-strength');
  return clamp(attractorScore * 0.6 + fitnessScore * 0.4);
};

export const rankPatternStrength = (patterns: PatternGraphPattern[]): RankedPatternStrength[] =>
  patterns
    .map((pattern) => ({
      pattern,
      pattern_strength: computePatternStrength(pattern)
    }))
    .sort((left, right) => right.pattern_strength - left.pattern_strength || left.pattern.id.localeCompare(right.pattern.id));
