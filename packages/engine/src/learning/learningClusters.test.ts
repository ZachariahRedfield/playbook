import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildLearningClustersArtifact,
  buildAndWriteLearningClustersArtifact,
  LEARNING_CLUSTERS_RELATIVE_PATH
} from './learningClusters.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-learning-clusters-'));

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const target = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const seedCanonicalArtifacts = (repo: string): void => {
  writeJson(repo, '.playbook/outcome-feedback.json', {
    schemaVersion: '1.0',
    kind: 'playbook-outcome-feedback',
    command: 'outcome-feedback',
    reviewOnly: true,
    authority: { mutation: 'read-only', promotion: 'review-required' },
    generatedAt: '2026-04-01T00:00:00.000Z',
    sourceArtifacts: {
      executionReceiptPath: '.playbook/execution-receipt.json',
      interopUpdatedTruthPath: '.playbook/interop-updated-truth.json',
      interopFollowupsPath: '.playbook/interop-followups.json',
      remediationStatusPath: '.playbook/remediation-status.json',
      remediationHistoryPath: '.playbook/test-autofix-history.json'
    },
    outcomeCounts: { success: 0, 'bounded-failure': 2, 'blocked-policy': 0, 'rollback-deactivation': 0, 'later-regression': 0 },
    outcomes: [
      {
        outcomeId: 'outcome-1',
        outcomeClass: 'bounded-failure',
        sourceType: 'remediation-history',
        sourceRef: 'runs/a',
        observedAt: '2026-04-01T00:00:00.000Z',
        summary: 'failure 1',
        provenanceRefs: ['.playbook/test-autofix-history.json'],
        candidateSignals: {
          confidenceUpdate: { direction: 'down', magnitude: 0.15, rationale: 'bounded failure' },
          triggerQualityNotes: [],
          staleKnowledgeFlags: [],
          trendUpdates: []
        },
        candidateOnly: true
      },
      {
        outcomeId: 'outcome-2',
        outcomeClass: 'bounded-failure',
        sourceType: 'remediation-history',
        sourceRef: 'runs/b',
        observedAt: '2026-04-01T01:00:00.000Z',
        summary: 'failure 2',
        provenanceRefs: ['.playbook/test-autofix-history.json'],
        candidateSignals: {
          confidenceUpdate: { direction: 'down', magnitude: 0.15, rationale: 'bounded failure' },
          triggerQualityNotes: [],
          staleKnowledgeFlags: [],
          trendUpdates: []
        },
        candidateOnly: true
      }
    ],
    signals: { confidence: [], triggerQuality: [], staleKnowledge: [], trends: [] },
    governance: { candidateOnly: true, autoPromotion: false, autoMutation: false, reviewRequired: true }
  });

  writeJson(repo, '.playbook/remediation-status.json', {
    schemaVersion: '1.0',
    kind: 'remediation-status',
    command: 'remediation-status',
    generatedAt: '2026-04-02T00:00:00.000Z',
    telemetry: {
      blocked_signature_rollup: [
        { failure_signature: 'sig.repeat.contract', blocked_count: 3 },
        { failure_signature: 'sig.noise.once', blocked_count: 1 }
      ],
      repeat_policy_block_counts: []
    }
  });

  writeJson(repo, '.playbook/learning-compaction.json', {
    schemaVersion: '1.0',
    kind: 'learning-compaction',
    generatedAt: '2026-04-03T00:00:00.000Z',
    summary: {
      recurring_failures: [
        { signal_id: 'failure.retry-heavy.docs_only', family: 'retry-heavy-task-family', evidence_count: 3, confidence: 0.72 },
        { signal_id: 'failure.noise.single', family: 'retry-heavy-task-family', evidence_count: 1, confidence: 0.4 }
      ]
    }
  });

  writeJson(repo, '.playbook/test-autofix-history.json', {
    schemaVersion: '1.0',
    kind: 'test-autofix-remediation-history',
    generatedAt: '2026-04-02T00:00:00.000Z',
    runs: [
      { run_id: 'run-1', generatedAt: '2026-04-01T00:00:00.000Z', admitted_findings: ['verify.PB101.rule-order'] },
      { run_id: 'run-2', generatedAt: '2026-04-01T01:00:00.000Z', admitted_findings: ['verify.PB101.rule-order'] },
      { run_id: 'run-3', generatedAt: '2026-04-01T02:00:00.000Z', admitted_findings: ['lint.non-canonical'] }
    ]
  });

  writeJson(repo, '.playbook/telemetry/command-quality.json', {
    schemaVersion: '1.0',
    kind: 'command-execution-quality',
    generatedAt: '2026-04-04T00:00:00.000Z',
    records: [
      {
        command_name: 'query',
        run_id: 'r-1',
        recorded_at: '2026-04-04T00:00:00.000Z',
        inputs_summary: 'modules',
        artifacts_read: [],
        artifacts_written: [],
        success_status: 'success',
        duration_ms: 120,
        warnings_count: 1,
        open_questions_count: 0,
        confidence_score: 0.8,
        downstream_artifacts_produced: []
      },
      {
        command_name: 'query',
        run_id: 'r-2',
        recorded_at: '2026-04-04T00:01:00.000Z',
        inputs_summary: 'modules',
        artifacts_read: [],
        artifacts_written: [],
        success_status: 'success',
        duration_ms: 110,
        warnings_count: 0,
        open_questions_count: 1,
        confidence_score: 0.82,
        downstream_artifacts_produced: []
      },
      {
        command_name: 'explain',
        run_id: 'r-3',
        recorded_at: '2026-04-04T00:02:00.000Z',
        inputs_summary: 'architecture',
        artifacts_read: [],
        artifacts_written: [],
        success_status: 'success',
        duration_ms: 130,
        warnings_count: 0,
        open_questions_count: 0,
        confidence_score: 0.81,
        downstream_artifacts_produced: []
      }
    ],
    summary: {
      total_runs: 3,
      success_runs: 3,
      failure_runs: 0,
      partial_runs: 0,
      average_duration_ms: 120,
      average_confidence_score: 0.81,
      total_warnings: 1,
      total_open_questions: 1
    }
  });
};

describe('learning clusters artifact', () => {
  it('is deterministic for the same canonical inputs', () => {
    const repo = createRepo();
    seedCanonicalArtifacts(repo);

    const first = buildLearningClustersArtifact(repo);
    const second = buildLearningClustersArtifact(repo);

    expect(second).toEqual(first);
    expect(first.kind).toBe('learning-clusters');
    expect(first.clusters.length).toBeGreaterThan(0);
  });

  it('clusters repeated signals and filters non-recurring noise', () => {
    const repo = createRepo();
    seedCanonicalArtifacts(repo);

    const artifact = buildLearningClustersArtifact(repo);
    const summaries = artifact.clusters.map((cluster) => cluster.repeatedSignalSummary).join('\n');

    expect(summaries).toContain('sig.repeat.contract');
    expect(summaries).toContain('failure.retry-heavy.docs_only');
    expect(summaries).toContain('verify.PB101.rule-order');
    expect(summaries).toContain('repeated query usage pattern');
    expect(summaries).not.toContain('sig.noise.once');
    expect(summaries).not.toContain('failure.noise.single');
    expect(summaries).not.toContain('lint.non-canonical');
  });

  it('writes .playbook/learning-clusters.json as read-only candidate artifact', () => {
    const repo = createRepo();
    seedCanonicalArtifacts(repo);

    const written = buildAndWriteLearningClustersArtifact(repo);
    const absolutePath = path.join(repo, LEARNING_CLUSTERS_RELATIVE_PATH);
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as { proposalOnly: boolean; reviewOnly: boolean };

    expect(written.artifactPath).toBe(path.resolve(repo, LEARNING_CLUSTERS_RELATIVE_PATH));
    expect(parsed.proposalOnly).toBe(true);
    expect(parsed.reviewOnly).toBe(true);
  });
});
