import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendAttractorScore,
  computeAttractorScore,
  evaluatePromotionState,
  listTopPatterns,
  scorePatternGraph,
  type PatternGraphArtifact
} from '../src/scoring/patternAttractorScore.js';

const fixturePath = path.resolve(process.cwd(), '..', '..', 'tests', 'contracts', 'pattern-graph.fixture.json');

const loadFixture = (): PatternGraphArtifact => JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as PatternGraphArtifact;

describe('pattern attractor scoring engine', () => {
  it('computes deterministic scores for identical artifacts', () => {
    const graph = loadFixture();
    const target = graph.patterns.find((pattern) => pattern.id === 'pattern.modularity');
    expect(target).toBeDefined();

    const scoreA = computeAttractorScore(target!, graph);
    const scoreB = computeAttractorScore(target!, graph);

    expect(scoreA).toEqual(scoreB);
    expect(scoreA.attractor_score).toBeGreaterThan(0);
    expect(scoreA.attractor_score).toBeLessThanOrEqual(1);
  });

  it('appends attractor score entries without overwriting existing scores', () => {
    const graph = loadFixture();
    const pattern = graph.patterns[0];
    const beforeCount = pattern.scores.length;
    const score = computeAttractorScore(pattern, graph);

    const updated = appendAttractorScore(pattern, score, graph.generatedAt);

    expect(updated.scores).toHaveLength(beforeCount + 1);
    expect(updated.scores[0]).toEqual(pattern.scores[0]);
    expect(updated.scores.at(-1)?.signal).toBe('attractor-strength');
  });

  it('evaluates promotion thresholds correctly', () => {
    expect(evaluatePromotionState(0.2)).toBe('observed');
    expect(evaluatePromotionState(0.3)).toBe('candidate');
    expect(evaluatePromotionState(0.65)).toBe('promoted');
    expect(evaluatePromotionState(0.85)).toBe('canonical');
  });

  it('produces stable graph scoring and top ranking', () => {
    const graph = loadFixture();

    const scoredA = scorePatternGraph(graph);
    const scoredB = scorePatternGraph(graph);
    expect(scoredA).toEqual(scoredB);

    const top = listTopPatterns(graph, 3);
    expect(top).toHaveLength(3);
    const values = top.map((pattern) => pattern.scores[pattern.scores.length - 1]?.value ?? 0);
    expect(values[0]).toBeGreaterThanOrEqual(values[1]);
    expect(values[1]).toBeGreaterThanOrEqual(values[2]);
  });
});
