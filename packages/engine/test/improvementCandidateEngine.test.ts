import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyAutoSafeImprovements,
  approveGovernanceImprovement,
  generateImprovementCandidates,
  writeImprovementCandidatesArtifact,
  type LearningStateSnapshotArtifact
} from '../src/index.js';

const created: string[] = [];

const createRepo = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-improve-engine-'));
  created.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of created.splice(0, created.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const writeEvent = (repo: string, name: string, event: unknown): void => {
  const filePath = path.join(repo, '.playbook', 'memory', 'events', `${name}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(event, null, 2)}\n`, 'utf8');
};

const writeLearning = (repo: string, snapshot: LearningStateSnapshotArtifact): void => {
  const filePath = path.join(repo, '.playbook', 'learning-state.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
};

const learningSnapshot: LearningStateSnapshotArtifact = {
  schemaVersion: '1.0',
  kind: 'learning-state-snapshot',
  generatedAt: '2026-01-01T00:00:00.000Z',
  proposalOnly: true,
  sourceArtifacts: {
    outcomeTelemetry: { available: true, recordCount: 5, artifactPath: '.playbook/outcome-telemetry.json' },
    processTelemetry: { available: true, recordCount: 5, artifactPath: '.playbook/process-telemetry.json' },
    taskExecutionProfile: { available: true, recordCount: 3, artifactPath: '.playbook/task-execution-profile.json' }
  },
  metrics: {
    sample_size: 5,
    first_pass_yield: 0.8,
    retry_pressure: { docs_only: 1 },
    validation_load_ratio: 0.7,
    route_efficiency_score: { docs_only: 0.9 },
    smallest_sufficient_route_score: 0.72,
    parallel_safety_realized: 0.9,
    router_fit_score: 0.84,
    reasoning_scope_efficiency: 0.76,
    validation_cost_pressure: 0.82,
    pattern_family_effectiveness_score: { docs_only: 0.77 },
    portability_confidence: 0.63
  },
  confidenceSummary: {
    sample_size_score: 0.7,
    coverage_score: 0.8,
    evidence_completeness_score: 0.9,
    overall_confidence: 0.91,
    open_questions: []
  }
};

describe('improvement candidate engine', () => {
  it('generates deterministic candidates from memory events and learning-state signals', () => {
    const repo = createRepo();
    writeLearning(repo, learningSnapshot);

    for (let i = 0; i < 4; i += 1) {
      writeEvent(repo, `route-${i}`, {
        schemaVersion: '1.1',
        event_type: 'route_decision',
        event_id: `route-${i}`,
        timestamp: `2026-01-0${i + 1}T00:00:00.000Z`,
        subsystem: 'repository_memory',
        subject: { kind: 'task', id: `task-${i}` },
        related_artifacts: [],
        payload: {
          task_text: 'update docs',
          task_family: 'docs_only',
          route_id: 'docs_default',
          confidence: 0.92
        }
      });
    }

    for (let i = 0; i < 3; i += 1) {
      writeEvent(repo, `lane-${i}`, {
        schemaVersion: '1.1',
        event_type: 'lane_transition',
        event_id: `lane-${i}`,
        timestamp: `2026-01-0${i + 1}T00:00:00.000Z`,
        subsystem: 'repository_memory',
        subject: { kind: 'lane', id: `lane-${i}` },
        related_artifacts: [],
        payload: {
          lane_id: `lane-${i}`,
          from_state: 'assigned',
          to_state: 'blocked',
          reason: 'waiting_on_contract'
        }
      });
    }

    const artifact = generateImprovementCandidates(repo);
    expect(artifact.thresholds.minimum_recurrence).toBe(3);
    expect(artifact.thresholds.minimum_confidence).toBe(0.6);
    expect(artifact.candidates.some((candidate) => candidate.candidate_id === 'routing_docs_overvalidation')).toBe(true);
    expect(artifact.summary.AUTO_SAFE).toBeGreaterThan(0);
    expect(artifact.summary.CONVERSATIONAL).toBeGreaterThan(0);

    const outputPath = writeImprovementCandidatesArtifact(repo, artifact);
    expect(outputPath.endsWith('.playbook/improvement-candidates.json')).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);
  });



  it('applies auto-safe candidates and tracks pending approvals by tier', () => {
    const repo = createRepo();
    writeLearning(repo, learningSnapshot);

    for (let i = 0; i < 3; i += 1) {
      writeEvent(repo, `route-${i}`, {
        schemaVersion: '1.1',
        event_type: 'route_decision',
        event_id: `route-${i}`,
        timestamp: `2026-01-0${i + 1}T00:00:00.000Z`,
        subsystem: 'repository_memory',
        subject: { kind: 'task', id: `task-${i}` },
        related_artifacts: [],
        payload: {
          task_text: 'update docs',
          task_family: 'docs_only',
          route_id: 'docs_default',
          confidence: 0.92
        }
      });
      writeEvent(repo, `lane-${i}`, {
        schemaVersion: '1.1',
        event_type: 'lane_transition',
        event_id: `lane-${i}`,
        timestamp: `2026-01-1${i}T00:00:00.000Z`,
        subsystem: 'repository_memory',
        subject: { kind: 'lane', id: `lane-${i}` },
        related_artifacts: [],
        payload: {
          lane_id: `lane-${i}`,
          from_state: 'assigned',
          to_state: 'blocked',
          reason: 'waiting_on_contract'
        }
      });
      writeEvent(repo, `ontology-${i}`, {
        schemaVersion: '1.1',
        event_type: 'improvement_signal',
        event_id: `ontology-${i}`,
        timestamp: `2026-01-2${i}T00:00:00.000Z`,
        subsystem: 'knowledge_lifecycle',
        subject: { kind: 'improvement-candidate', id: `ontology-${i}` },
        related_artifacts: [],
        payload: {
          source: 'ontology-observer',
          summary: 'Ontology drift in route taxonomy',
          confidence: 0.9,
          candidate_id: `ontology-${i}`
        }
      });
    }

    const result = applyAutoSafeImprovements(repo);
    expect(result.action).toBe('apply-safe');
    expect(result.applied.length).toBeGreaterThan(0);
    expect(result.pending_conversation.length).toBeGreaterThan(0);
    expect(result.pending_governance.length).toBeGreaterThan(0);
  });

  it('requires explicit governance approval for governance-tier proposals', () => {
    const repo = createRepo();
    writeLearning(repo, learningSnapshot);

    for (let i = 0; i < 3; i += 1) {
      writeEvent(repo, `ontology-${i}`, {
        schemaVersion: '1.1',
        event_type: 'improvement_signal',
        event_id: `ontology-${i}`,
        timestamp: `2026-01-2${i}T00:00:00.000Z`,
        subsystem: 'knowledge_lifecycle',
        subject: { kind: 'improvement-candidate', id: `ontology-${i}` },
        related_artifacts: [],
        payload: {
          source: 'ontology-observer',
          summary: 'Ontology drift in route taxonomy',
          confidence: 0.9,
          candidate_id: `ontology-${i}`
        }
      });
    }

    const artifact = generateImprovementCandidates(repo);
    const governanceCandidate = artifact.candidates.find((candidate) => candidate.improvement_tier === 'governance');
    expect(governanceCandidate).toBeDefined();

    const approval = approveGovernanceImprovement(repo, governanceCandidate!.candidate_id);
    expect(approval.approvals.some((item) => item.proposal_id === governanceCandidate!.candidate_id)).toBe(true);
  });

  it('does not emit candidates when recurrence threshold is not met', () => {
    const repo = createRepo();
    writeLearning(repo, learningSnapshot);
    writeEvent(repo, 'route-1', {
      schemaVersion: '1.1',
      event_type: 'route_decision',
      event_id: 'route-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      subsystem: 'repository_memory',
      subject: { kind: 'task', id: 'route-1-task' },
      related_artifacts: [],
      payload: {
        task_text: 'update docs',
        task_family: 'docs_only',
        route_id: 'docs_default',
        confidence: 0.92
      }
    });

    const artifact = generateImprovementCandidates(repo);
    expect(artifact.candidates).toEqual([]);
    expect(artifact.summary.total).toBe(0);
  });
});
