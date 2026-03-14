import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendAttractorScore,
  computeAttractorScore,
  type PatternGraphArtifact
} from '../src/scoring/patternAttractorScore.js';
import {
  appendFitnessStrengthScore,
  computePatternFitness,
  computePatternStrength,
  rankPatternStrength
} from '../src/scoring/patternFitnessScore.js';

const fixturePath = path.resolve(process.cwd(), '..', '..', 'tests', 'contracts', 'pattern-graph.fixture.json');

const loadFixture = (): PatternGraphArtifact => JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as PatternGraphArtifact;

describe('pattern fitness scoring engine', () => {
  it('computes weighted fitness score from provided outcome links', () => {
    const graph = loadFixture();
    const pattern = graph.patterns[0];

    const fitness = computePatternFitness(pattern, {
      outcome_stability: 0.9,
      defect_reduction: 0.8,
      governance_alignment: 0.7,
      architectural_clarity: 0.6,
      cross_repo_success: 0.5
    });

    expect(fitness.fitness_score).toBe(0.75);
  });

  it('appends a fitness-strength signal', () => {
    const graph = loadFixture();
    const pattern = graph.patterns[0];
    const fitness = computePatternFitness(pattern, {
      outcome_stability: 0.8,
      defect_reduction: 0.7,
      governance_alignment: 0.6,
      architectural_clarity: 0.5,
      cross_repo_success: 0.4
    });

    const updated = appendFitnessStrengthScore(pattern, fitness, graph.generatedAt);
    expect(updated.scores.at(-1)).toMatchObject({
      signal: 'fitness-strength',
      value: 0.65
    });
  });

  it('computes combined pattern strength from attractor and fitness scores', () => {
    const graph = loadFixture();
    const pattern = graph.patterns[0];

    const attractor = computeAttractorScore(pattern, graph);
    const withAttractor = appendAttractorScore(pattern, attractor, graph.generatedAt);
    const withFitness = appendFitnessStrengthScore(
      withAttractor,
      computePatternFitness(pattern, {
        outcome_stability: 0.9,
        defect_reduction: 0.8,
        governance_alignment: 0.7,
        architectural_clarity: 0.6,
        cross_repo_success: 0.5
      }),
      graph.generatedAt
    );

    expect(computePatternStrength(withFitness)).toBe(0.5112);
  });

  it('ranks patterns by descending pattern strength', () => {
    const graph = loadFixture();

    const enriched = graph.patterns.map((pattern, index) => {
      const withAttractor = appendAttractorScore(pattern, computeAttractorScore(pattern, graph), graph.generatedAt);
      const withFitness = appendFitnessStrengthScore(
        withAttractor,
        computePatternFitness(pattern, {
          outcome_stability: Math.max(0, 0.95 - index * 0.1),
          defect_reduction: Math.max(0, 0.9 - index * 0.1),
          governance_alignment: Math.max(0, 0.85 - index * 0.1),
          architectural_clarity: Math.max(0, 0.8 - index * 0.1),
          cross_repo_success: Math.max(0, 0.75 - index * 0.1)
        }),
        graph.generatedAt
      );
      return withFitness;
    });

    const ranked = rankPatternStrength(enriched);

    expect(ranked).toHaveLength(enriched.length);
    expect(ranked[0].pattern_strength).toBeGreaterThanOrEqual(ranked[1].pattern_strength);
    expect(ranked.at(-1)?.pattern_strength).toBeLessThanOrEqual(ranked[0].pattern_strength);
  });
});
