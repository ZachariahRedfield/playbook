import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePatternPortabilityRun, writePatternPortabilityArtifact } from './patternPortability.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-portability-'));

const writeCompaction = (
  repoRoot: string,
  input: {
    runIds: string[];
    routeFamily?: string;
    routeId?: string;
    lane?: string;
    validations?: string[];
    confidence?: number;
    failures?: Array<{ signal_id: string; family: string; confidence: number; evidence_count: number }>;
    successes?: Array<{ signal_id: string; family: string; confidence: number; evidence_count: number }>;
  }
): void => {
  fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, '.playbook', 'learning-compaction.json'),
    JSON.stringify({
      schemaVersion: '1.0',
      kind: 'learning-compaction',
      generatedAt: '2026-04-01T00:00:00.000Z',
      sourceArtifacts: {
        processTelemetry: { available: true, artifactPath: '.playbook/process-telemetry.json', recordCount: 1 },
        outcomeTelemetry: { available: true, artifactPath: '.playbook/outcome-telemetry.json', recordCount: 1 },
        memoryEvents: { available: true, artifactPath: '.playbook/memory/events', recordCount: 1 },
        memoryIndex: { available: true, artifactPath: '.playbook/memory/index.json', recordCount: 1 }
      },
      summary: {
        summary_id: `summary-${input.runIds.join('-')}`,
        source_run_ids: input.runIds,
        time_window: { start: '2026-03-01T00:00:00.000Z', end: '2026-03-31T00:00:00.000Z' },
        route_patterns: [
          {
            route_id: input.routeId ?? 'deterministic_local:knowledge_lifecycle',
            task_family: input.routeFamily ?? 'knowledge_lifecycle',
            observation_count: 4,
            avg_retry_count: 0.2,
            first_pass_rate: 0.9
          }
        ],
        lane_patterns: [
          {
            lane_shape: input.lane ?? 'parallel:2',
            success_count: 4,
            failure_count: 1,
            success_rate: 0.8
          }
        ],
        validation_patterns: (input.validations ?? ['pnpm test']).map((validation) => ({
          validation_key: validation,
          observation_count: 3,
          bottleneck_rate: 0.1,
          avg_duration_ms: 200
        })),
        recurring_failures:
          input.failures ?? [{ signal_id: 'failure.validation.contract-breakage', family: 'validation-bottleneck', confidence: 0.1, evidence_count: 1 }],
        recurring_successes:
          input.successes ?? [{ signal_id: 'success.router-fit.high', family: 'knowledge_lifecycle', confidence: 0.9, evidence_count: 4 }],
        confidence: input.confidence ?? 0.9,
        open_questions: []
      }
    })
  );
};

const writeRouterRecommendations = (repoRoot: string, includeRecommendation = true): void => {
  fs.writeFileSync(
    path.join(repoRoot, '.playbook', 'router-recommendations.json'),
    JSON.stringify({
      schemaVersion: '1.0',
      kind: 'router-recommendations',
      generatedAt: '2026-04-01T00:00:00.000Z',
      proposalOnly: true,
      nonAutonomous: true,
      sourceArtifacts: {
        learningStatePath: '.playbook/learning-state.json',
        learningCompactionPath: '.playbook/learning-compaction.json',
        processTelemetryPath: '.playbook/process-telemetry.json',
        outcomeTelemetryPath: '.playbook/outcome-telemetry.json',
        memoryEventsPath: '.playbook/memory/events'
      },
      recommendations: includeRecommendation
        ? [
            {
              recommendation_id: 'router_over_fragmented_knowledge_lifecycle',
              task_family: 'knowledge_lifecycle',
              current_strategy: 'aggressive-fragmentation',
              recommended_strategy: 'reduce-fragmentation-lanes',
              evidence_count: 4,
              supporting_runs: 2,
              confidence_score: 0.92,
              rationale: 'deterministic recommendation',
              gating_tier: 'CONVERSATIONAL'
            }
          ]
        : [],
      rejected_recommendations: []
    })
  );
};

const writeEvents = (repoRoot: string, outcomes: Array<'success' | 'failure' | 'blocked' | 'partial'>): void => {
  const eventsDir = path.join(repoRoot, '.playbook', 'memory', 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  outcomes.forEach((outcome, index) => {
    fs.writeFileSync(
      path.join(eventsDir, `event-${index}.json`),
      JSON.stringify({
        schemaVersion: '1.0',
        event_type: 'execution_outcome',
        event_id: `event-${index}`,
        timestamp: `2026-03-${String(index + 10).padStart(2, '0')}T00:00:00.000Z`,
        subsystem: 'repository_memory',
        subject: 'knowledge_lifecycle',
        related_artifacts: [],
        payload: { lane_id: 'knowledge_lifecycle', outcome, summary: outcome },
        run_id: `run-${index}`,
        lane_id: 'knowledge_lifecycle',
        outcome,
        summary: outcome
      })
    );
  });
};

describe('pattern portability scoring', () => {
  it('scores high portability when structures and dependencies align with successful evidence', () => {
    const source = createRepo();
    const target = createRepo();
    writeCompaction(source, { runIds: ['src-1', 'src-2'] });
    writeCompaction(target, { runIds: ['tgt-1', 'tgt-2'] });
    writeRouterRecommendations(source, true);
    writeRouterRecommendations(target, true);
    writeEvents(source, ['success', 'success']);
    writeEvents(target, ['success', 'success', 'success']);

    const run = generatePatternPortabilityRun({
      sourceRepoRoot: source,
      sourceRepoId: 'source-repo',
      targetRepoRoot: target,
      targetRepoId: 'target-repo'
    });

    expect(run.scores[0]?.confidence_score).toBeGreaterThanOrEqual(0.8);
    expect(run.scores[0]?.structural_similarity).toBeGreaterThanOrEqual(0.9);
  });

  it('scores low portability when topology and validation dependencies diverge', () => {
    const source = createRepo();
    const target = createRepo();
    writeCompaction(source, { runIds: ['src-1'], routeId: 'deterministic_local:improvement_engine', validations: ['pnpm test'] });
    writeCompaction(target, {
      runIds: ['tgt-1'],
      routeId: 'deterministic_local:repository_memory',
      lane: 'parallel:5',
      validations: ['pnpm lint'],
      confidence: 0.5,
      failures: [{ signal_id: 'failure.validation.contract-breakage', family: 'validation-bottleneck', confidence: 0.8, evidence_count: 4 }]
    });
    writeRouterRecommendations(source, true);
    writeRouterRecommendations(target, false);
    writeEvents(source, ['success']);
    writeEvents(target, ['failure', 'failure']);

    const run = generatePatternPortabilityRun({
      sourceRepoRoot: source,
      sourceRepoId: 'source-repo',
      targetRepoRoot: target,
      targetRepoId: 'target-repo'
    });

    expect(run.scores[0]?.confidence_score).toBeLessThanOrEqual(0.55);
    expect(run.scores[0]?.governance_risk).toBeGreaterThanOrEqual(0.6);
  });

  it('applies conservative confidence when evidence is missing', () => {
    const source = createRepo();
    const target = createRepo();
    writeCompaction(source, { runIds: [] });
    writeCompaction(target, { runIds: [] });
    writeRouterRecommendations(source, true);
    writeRouterRecommendations(target, true);
    writeEvents(source, []);
    writeEvents(target, []);

    const run = generatePatternPortabilityRun({
      sourceRepoRoot: source,
      sourceRepoId: 'source-repo',
      targetRepoRoot: target,
      targetRepoId: 'target-repo'
    });

    expect(run.evidence_runs).toBe(0);
    expect(run.scores[0]?.confidence_score).toBe(0.2);
  });

  it('supports partial repository compatibility and persists append-only runs', () => {
    const source = createRepo();
    const target = createRepo();
    writeCompaction(source, { runIds: ['src-1'], validations: ['pnpm test', 'pnpm lint'] });
    writeCompaction(target, { runIds: ['tgt-1'], validations: ['pnpm lint'] });
    writeRouterRecommendations(source, true);
    writeRouterRecommendations(target, true);
    writeEvents(source, ['success']);
    writeEvents(target, ['success', 'failure']);

    const runOne = generatePatternPortabilityRun({
      sourceRepoRoot: source,
      sourceRepoId: 'source-repo',
      targetRepoRoot: target,
      targetRepoId: 'target-repo'
    });

    const artifactPath = writePatternPortabilityArtifact(target, runOne);
    const runTwo = {
      ...runOne,
      run_id: `${runOne.run_id}-next`,
      generatedAt: '2026-04-02T00:00:00.000Z'
    };
    writePatternPortabilityArtifact(target, runTwo);

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as { runs: Array<{ run_id: string }> };
    expect(runOne.scores[0]?.dependency_compatibility).toBeGreaterThan(0);
    expect(runOne.scores[0]?.dependency_compatibility).toBeLessThan(1);
    expect(artifact.runs.map((entry) => entry.run_id)).toEqual([runOne.run_id, runTwo.run_id]);
  });
});
