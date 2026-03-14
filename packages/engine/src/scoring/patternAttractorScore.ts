export type PromotionState = 'observed' | 'candidate' | 'promoted' | 'canonical' | 'retired';

export type AttractorScore = {
  id: string;
  signal: string;
  value: number;
  updatedAt: string;
  notes?: string;
};

export type PatternGraphPattern = {
  id: string;
  title: string;
  description: string;
  source: 'repository-native' | 'research-conceptual';
  layer: string;
  mechanism_refs: string[];
  evidence_refs: string[];
  instance_refs: string[];
  relation_edges: string[];
  scores: AttractorScore[];
  status: PromotionState;
};

export type PatternGraphEvidence = {
  id: string;
  kind: 'code' | 'document' | 'observation' | 'research';
};

export type PatternGraphRelation = {
  id: string;
  from_pattern: string;
  to_pattern: string;
};

export type PatternGraphArtifact = {
  schemaVersion: '1.0';
  kind: 'pattern-graph';
  generatedAt: string;
  patterns: PatternGraphPattern[];
  evidence: PatternGraphEvidence[];
  relations: PatternGraphRelation[];
};

export type PatternAttractorScoreSignals = {
  recurrence: number;
  cross_domain_reuse: number;
  evidence_strength: number;
  repository_impact: number;
  governance_alignment: number;
};

export type PatternAttractorScoreResult = PatternAttractorScoreSignals & {
  attractor_score: number;
};

const clamp = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(4))));

const sanitizeRefId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9._:/-]/g, '-');

const collectRelatedPatternIds = (pattern: PatternGraphPattern, graph: PatternGraphArtifact): Set<string> => {
  const ids = new Set<string>();
  for (const relation of graph.relations) {
    if (relation.from_pattern === pattern.id) {
      ids.add(relation.to_pattern);
    }
    if (relation.to_pattern === pattern.id) {
      ids.add(relation.from_pattern);
    }
  }
  return ids;
};

export const calculateRecurrenceScore = (pattern: PatternGraphPattern): number => clamp(pattern.instance_refs.length / 5);

export const calculateCrossDomainScore = (pattern: PatternGraphPattern, graph: PatternGraphArtifact): number => {
  const relatedIds = collectRelatedPatternIds(pattern, graph);
  const sources = new Set<string>([pattern.source]);

  for (const related of graph.patterns) {
    if (relatedIds.has(related.id)) {
      sources.add(related.source);
    }
  }

  return clamp(sources.size / 2);
};

export const calculateEvidenceScore = (pattern: PatternGraphPattern, graph: PatternGraphArtifact): number => {
  if (pattern.evidence_refs.length === 0) {
    return 0;
  }

  const byId = new Map(graph.evidence.map((entry) => [entry.id, entry]));
  const kinds = new Set<string>();
  for (const evidenceRef of pattern.evidence_refs) {
    const evidence = byId.get(evidenceRef);
    if (evidence) {
      kinds.add(evidence.kind);
    }
  }

  const countSignal = clamp(pattern.evidence_refs.length / 4);
  const diversitySignal = clamp(kinds.size / 4);
  return clamp(countSignal * 0.7 + diversitySignal * 0.3);
};

export const calculateRepositoryImpactScore = (pattern: PatternGraphPattern): number => {
  const instanceSignal = clamp(pattern.instance_refs.length / 4);
  const relationSignal = clamp(pattern.relation_edges.length / 4);
  const sourceSignal = pattern.source === 'repository-native' ? 1 : 0.35;
  return clamp(instanceSignal * 0.45 + relationSignal * 0.35 + sourceSignal * 0.2);
};

export const calculateGovernanceAlignmentScore = (pattern: PatternGraphPattern): number => {
  const layerLabel = pattern.layer.toLowerCase();
  const layerSignal = layerLabel.includes('governance') ? 1 : layerLabel.includes('architecture') ? 0.85 : 0.7;
  const evidenceSignal = pattern.evidence_refs.length > 0 ? 1 : 0;
  const instanceSignal = pattern.instance_refs.length > 0 ? 1 : 0;
  return clamp(layerSignal * 0.4 + evidenceSignal * 0.3 + instanceSignal * 0.3);
};

export const computeAttractorScore = (pattern: PatternGraphPattern, graph: PatternGraphArtifact): PatternAttractorScoreResult => {
  const recurrence = calculateRecurrenceScore(pattern);
  const cross_domain_reuse = calculateCrossDomainScore(pattern, graph);
  const evidence_strength = calculateEvidenceScore(pattern, graph);
  const repository_impact = calculateRepositoryImpactScore(pattern);
  const governance_alignment = calculateGovernanceAlignmentScore(pattern);

  const attractor_score = clamp(
    recurrence * 0.3 +
      cross_domain_reuse * 0.2 +
      evidence_strength * 0.2 +
      repository_impact * 0.2 +
      governance_alignment * 0.1
  );

  return {
    recurrence,
    cross_domain_reuse,
    evidence_strength,
    repository_impact,
    governance_alignment,
    attractor_score
  };
};

export const evaluatePromotionState = (score: number): PromotionState => {
  if (score >= 0.85) return 'canonical';
  if (score >= 0.65) return 'promoted';
  if (score >= 0.3) return 'candidate';
  return 'observed';
};

export const appendAttractorScore = (
  pattern: PatternGraphPattern,
  score: PatternAttractorScoreResult,
  updatedAt: string
): PatternGraphPattern => {
  const stamp = sanitizeRefId(updatedAt);
  const id = sanitizeRefId(`score.${pattern.id}.attractor.${stamp}`);

  const entry: AttractorScore = {
    id,
    signal: 'attractor-strength',
    value: score.attractor_score,
    updatedAt,
    notes:
      'Attractor score ranks structural persistence and utility. It is not a claim of truth; aggregated weak signals are preferred over any single heuristic.'
  };

  return {
    ...pattern,
    scores: [...pattern.scores, entry],
    status: evaluatePromotionState(score.attractor_score)
  };
};

export const scorePatternGraph = (graph: PatternGraphArtifact): PatternGraphArtifact => ({
  ...graph,
  patterns: graph.patterns.map((pattern) => appendAttractorScore(pattern, computeAttractorScore(pattern, graph), graph.generatedAt))
});

export const listTopPatterns = (graph: PatternGraphArtifact, limit = 5): PatternGraphPattern[] => {
  const scored = scorePatternGraph(graph);
  return [...scored.patterns]
    .sort((left, right) => {
      const leftScore = left.scores[left.scores.length - 1]?.value ?? 0;
      const rightScore = right.scores[right.scores.length - 1]?.value ?? 0;
      return rightScore - leftScore || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(1, limit));
};
