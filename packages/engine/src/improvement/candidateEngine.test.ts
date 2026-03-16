import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateImprovementCandidates } from './candidateEngine.js';

type TestEvent = {
  event_id: string;
  event_type: string;
  timestamp: string;
  [key: string]: unknown;
};

const tempRoots: string[] = [];

const createRepoRoot = (): string => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-improve-'));
  tempRoots.push(repoRoot);
  fs.mkdirSync(path.join(repoRoot, '.playbook', 'memory', 'events'), { recursive: true });
  return repoRoot;
};

const writeEvent = (repoRoot: string, event: TestEvent): void => {
  const filePath = path.join(repoRoot, '.playbook', 'memory', 'events', `${event.event_id}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify({ schemaVersion: '1.0', ...event }, null, 2)}\n`, 'utf8');
};

const writeLearningState = (repoRoot: string, overallConfidence: number, validationCostPressure = 0): void => {
  fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, '.playbook', 'learning-state.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'learning-state-snapshot',
        generatedAt: '2026-01-01T00:00:00.000Z',
        proposalOnly: true,
        sourceArtifacts: {
          outcomeTelemetry: { available: false, recordCount: 0, artifactPath: '.playbook/outcome.json' },
          processTelemetry: { available: false, recordCount: 0, artifactPath: '.playbook/process.json' },
          taskExecutionProfile: { available: false, recordCount: 0, artifactPath: '.playbook/task-profile.json' }
        },
        metrics: {
          sample_size: 0,
          first_pass_yield: 0,
          retry_pressure: {},
          validation_load_ratio: 0,
          route_efficiency_score: {},
          smallest_sufficient_route_score: 0,
          parallel_safety_realized: 0.9,
          router_fit_score: 0,
          reasoning_scope_efficiency: 0,
          validation_cost_pressure: validationCostPressure,
          pattern_family_effectiveness_score: {},
          portability_confidence: 0
        },
        confidenceSummary: {
          sample_size_score: 0,
          coverage_score: 0,
          evidence_completeness_score: 0,
          overall_confidence: overallConfidence,
          open_questions: []
        }
      },
      null,
      2
    )}\n`,
    'utf8'
  );
};

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('generateImprovementCandidates gating', () => {
  it('promotes strong repeated evidence to AUTO-SAFE', () => {
    const repoRoot = createRepoRoot();
    writeLearningState(repoRoot, 0.95);

    for (let index = 0; index < 8; index += 1) {
      writeEvent(repoRoot, {
        event_id: `worker-${index}`,
        event_type: 'worker_assignment',
        timestamp: `2026-02-0${(index % 4) + 1}T12:00:00.000Z`,
        lane_id: `lane-${index}`,
        worker_id: 'worker-a',
        assignment_status: 'blocked'
      });
    }

    const artifact = generateImprovementCandidates(repoRoot);
    const candidate = artifact.candidates.find((entry) => entry.candidate_id === 'worker_prompt_worker_a');

    expect(candidate?.gating_tier).toBe('auto_safe');
    expect(candidate?.required_review).toBe(false);
    expect(candidate?.evidence_count).toBe(8);
    expect(candidate?.supporting_runs).toBeGreaterThanOrEqual(3);
  });

  it('gates reviewable non-sensitive proposals as CONVERSATIONAL', () => {
    const repoRoot = createRepoRoot();
    writeLearningState(repoRoot, 0.8, 1);

    for (let index = 0; index < 4; index += 1) {
      writeEvent(repoRoot, {
        event_id: `route-${index}`,
        event_type: 'route_decision',
        timestamp: `2026-03-0${(index % 3) + 1}T12:00:00.000Z`,
        task_text: 'docs task',
        task_family: 'docs_only',
        route_id: 'docs-route',
        confidence: 0.95
      });
    }

    const artifact = generateImprovementCandidates(repoRoot);
    const candidate = artifact.candidates.find((entry) => entry.candidate_id === 'routing_docs_overvalidation');

    expect(candidate?.gating_tier).toBe('conversation');
    expect(candidate?.required_review).toBe(true);
    expect(candidate?.blocking_reasons.join(' ')).toContain('AUTO-SAFE');
  });

  it('requires GOVERNANCE for doctrine/trust-boundary-sensitive proposals', () => {
    const repoRoot = createRepoRoot();
    writeLearningState(repoRoot, 0.85);

    for (let index = 0; index < 3; index += 1) {
      writeEvent(repoRoot, {
        event_id: `ontology-${index}`,
        event_type: 'improvement_candidate',
        timestamp: `2026-04-0${index + 1}T12:00:00.000Z`,
        candidate_id: `ont-${index}`,
        source: 'ontology-normalizer',
        summary: 'Ontology taxonomy drift in routing labels',
        confidence: 0.9
      });
    }

    const artifact = generateImprovementCandidates(repoRoot);
    const candidate = artifact.candidates.find((entry) => entry.candidate_id.includes('ontology_ontology_taxonomy_drift_in_routing_labels'));

    expect(candidate?.gating_tier).toBe('governance');
    expect(candidate?.required_review).toBe(true);
    expect(candidate?.blocking_reasons.join(' ')).toContain('trust-boundary or doctrine-sensitive');
  });

  it('rejects proposals with insufficient deterministic evidence', () => {
    const repoRoot = createRepoRoot();
    writeLearningState(repoRoot, 0.95, 0.95);

    for (let index = 0; index < 2; index += 1) {
      writeEvent(repoRoot, {
        event_id: `few-route-${index}`,
        event_type: 'route_decision',
        timestamp: `2026-05-0${index + 1}T12:00:00.000Z`,
        task_text: 'docs task',
        task_family: 'docs_only',
        route_id: 'docs-route',
        confidence: 0.99
      });
    }

    const artifact = generateImprovementCandidates(repoRoot);
    expect(artifact.candidates).toHaveLength(0);
  });
});
