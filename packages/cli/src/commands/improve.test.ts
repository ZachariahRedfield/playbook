import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runImprove, runImproveApplySafe, runImproveApprove } from './improve.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-improve-cli-'));

const seedRepo = (repo: string): void => {
  const learningPath = path.join(repo, '.playbook', 'learning-state.json');
  fs.mkdirSync(path.dirname(learningPath), { recursive: true });
  fs.writeFileSync(
    learningPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'learning-state-snapshot',
        generatedAt: '2026-01-01T00:00:00.000Z',
        proposalOnly: true,
        sourceArtifacts: {
          outcomeTelemetry: { available: true, recordCount: 1, artifactPath: '.playbook/outcome-telemetry.json' },
          processTelemetry: { available: true, recordCount: 1, artifactPath: '.playbook/process-telemetry.json' },
          taskExecutionProfile: { available: true, recordCount: 1, artifactPath: '.playbook/task-execution-profile.json' }
        },
        metrics: {
          sample_size: 4,
          first_pass_yield: 0.9,
          retry_pressure: { docs_only: 0 },
          validation_load_ratio: 0.7,
          route_efficiency_score: { docs_only: 0.9 },
          smallest_sufficient_route_score: 0.8,
          parallel_safety_realized: 0.9,
          router_fit_score: 0.85,
          reasoning_scope_efficiency: 0.8,
          validation_cost_pressure: 0.9,
          pattern_family_effectiveness_score: { docs_only: 0.9 },
          portability_confidence: 0.7
        },
        confidenceSummary: {
          sample_size_score: 0.7,
          coverage_score: 0.7,
          evidence_completeness_score: 0.8,
          overall_confidence: 0.9,
          open_questions: []
        }
      },
      null,
      2
    )
  );

  const eventsDir = path.join(repo, '.playbook', 'memory', 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  for (let i = 0; i < 3; i += 1) {
    fs.writeFileSync(
      path.join(eventsDir, `event-${i}.json`),
      JSON.stringify(
        {
          schemaVersion: '1.0',
          event_type: 'route_decision',
          event_id: `event-${i}`,
          timestamp: `2026-01-0${i + 1}T00:00:00.000Z`,
          task_text: 'docs task',
          task_family: 'docs_only',
          route_id: 'docs_default',
          confidence: 0.92
        },
        null,
        2
      )
    );
  }

  for (let i = 0; i < 3; i += 1) {
    fs.writeFileSync(
      path.join(eventsDir, `ontology-${i}.json`),
      JSON.stringify(
        {
          schemaVersion: '1.0',
          event_type: 'improvement_candidate',
          event_id: `ontology-${i}`,
          timestamp: `2026-01-1${i}T00:00:00.000Z`,
          source: 'ontology-observer',
          summary: 'Ontology drift in route taxonomy',
          confidence: 0.9
        },
        null,
        2
      )
    );
  }
};

describe('runImprove', () => {
  it('writes and prints json artifact', async () => {
    const repo = createRepo();
    seedRepo(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runImprove(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.kind).toBe('improvement-candidates');
    expect((payload.summary as Record<string, number>).CONVERSATIONAL).toBeGreaterThan(0);

    const candidates = payload.candidates as Array<{ improvement_tier: string; gating_tier: string; evidence_count: number }>;
    expect(candidates.some((candidate) => ['auto_safe', 'conversation', 'governance'].includes(candidate.improvement_tier))).toBe(true);
    expect(candidates.every((candidate) => candidate.gating_tier === candidate.improvement_tier)).toBe(true);
    expect(candidates.every((candidate) => candidate.evidence_count >= 3)).toBe(true);

    const artifactPath = path.join(repo, '.playbook', 'improvement-candidates.json');
    expect(fs.existsSync(artifactPath)).toBe(true);

    logSpy.mockRestore();
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('supports apply-safe and governance approval workflows', async () => {
    const repo = createRepo();
    seedRepo(repo);

    const applyExit = await runImproveApplySafe(repo, { format: 'text', quiet: true });
    expect(applyExit).toBe(ExitCode.Success);

    const artifact = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'improvement-candidates.json'), 'utf8')) as {
      candidates: Array<{ candidate_id: string; improvement_tier: string }>;
    };
    const governance = artifact.candidates.find((candidate) => candidate.improvement_tier === 'governance');
    expect(governance).toBeDefined();

    const approveExit = await runImproveApprove(repo, governance?.candidate_id, { format: 'text', quiet: true });
    expect(approveExit).toBe(ExitCode.Success);

    const approvalPath = path.join(repo, '.playbook', 'improvement-approvals.json');
    expect(fs.existsSync(approvalPath)).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });
});

describe('command registry', () => {
  it('registers improve command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'improve');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Generate deterministic improvement candidates from memory events and learning-state signals');
  });
});
