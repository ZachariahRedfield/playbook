import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runPolicy } from './policy.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-policy-cli-'));

const writeImprovementCandidates = (repoRoot: string): void => {
  const artifactPath = path.join(repoRoot, '.playbook', 'improvement-candidates.json');
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'improvement-candidates',
        generatedAt: '2026-01-01T00:00:00.000Z',
        thresholds: { minimum_recurrence: 3, minimum_confidence: 0.6 },
        sourceArtifacts: { memoryEventsPath: '.playbook/memory/events', learningStatePath: '.playbook/learning-state.json', memoryEventCount: 0, learningStateAvailable: false },
        summary: { AUTO_SAFE: 0, CONVERSATIONAL: 1, GOVERNANCE: 0, total: 1 },
        router_recommendations: { schemaVersion: '1.0', kind: 'router-recommendations', generatedAt: '2026-01-01T00:00:00.000Z', proposalOnly: true, nonAutonomous: true, sourceArtifacts: { learningStatePath: '', learningCompactionPath: '', processTelemetryPath: '', outcomeTelemetryPath: '', memoryEventsPath: '' }, recommendations: [], rejected_recommendations: [] },
        doctrine_candidates: { schemaVersion: '1.0', kind: 'doctrine-promotion-candidates', generatedAt: '2026-01-01T00:00:00.000Z', proposalOnly: true, sourceArtifacts: { memoryCandidatesPath: '', processTelemetryPath: '', outcomeTelemetryPath: '' }, candidates: [] },
        doctrine_promotions: { schemaVersion: '1.0', kind: 'doctrine-promotions', generatedAt: '2026-01-01T00:00:00.000Z', proposalOnly: true, transitions: [], approvals: [] },
        command_improvements: { schemaVersion: '1.0', kind: 'command-improvements', generatedAt: '2026-01-01T00:00:00.000Z', proposalOnly: true, nonAutonomous: true, thresholds: { minimum_evidence_count: 0, high_failure_rate_threshold: 0, low_confidence_threshold: 0, high_warning_open_question_rate_threshold: 0, high_latency_peer_ratio_threshold: 0, repeated_partial_failure_rate_threshold: 0 }, sourceArtifacts: { commandQualityPath: '', commandQualitySummariesPath: [], memoryEventsPath: '', commandQualityAvailable: false, cycleHistoryPath: '', cycleStatePath: '', cycleTelemetrySummaryPath: '', cycleRegressionsPath: '', cycleTelemetrySummaryAvailable: false, cycleRegressionsAvailable: false, cycleHistoryAvailable: false, cycleStateAvailable: false }, runtime_hardening: { proposals: [], rejected_proposals: [], open_questions: [] }, proposals: [], rejected_proposals: [] },
        candidates: [
          {
            candidate_id: 'policy-safe',
            category: 'ontology',
            observation: 'stable signal',
            recurrence_count: 2,
            confidence_score: 0.9,
            suggested_action: 'monitor',
            gating_tier: 'CONVERSATIONAL',
            improvement_tier: 'conversation',
            required_review: false,
            blocking_reasons: [],
            evidence: { event_ids: ['e1', 'e2', 'e3', 'e4'] },
            evidence_count: 4,
            supporting_runs: 2
          }
        ],
        rejected_candidates: []
      },
      null,
      2
    )
  );
};

describe('runPolicy', () => {
  it('emits json evaluation for policy evaluate', async () => {
    const repo = createRepo();
    writeImprovementCandidates(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPolicy(repo, ['evaluate'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.kind).toBe('policy-evaluation');
    expect(Array.isArray(payload.evaluations)).toBe(true);

    logSpy.mockRestore();
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('returns failure for unsupported subcommand', async () => {
    const repo = createRepo();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPolicy(repo, [], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { findings: Array<{ id: string }> };
    expect(payload.findings[0]?.id).toBe('policy.subcommand.unsupported');

    logSpy.mockRestore();
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('registers policy command metadata', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'policy');
    expect(command).toBeDefined();
    expect(command?.description).toContain('Evaluate improvement proposals');
  });
});
