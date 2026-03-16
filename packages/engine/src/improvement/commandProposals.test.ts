import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateCommandImprovementProposals } from './commandProposals.js';

type CommandRecordSeed = {
  command_name: string;
  run_id: string;
  success_status: 'success' | 'failure' | 'partial';
  duration_ms: number;
  confidence_score: number;
  warnings_count?: number;
  open_questions_count?: number;
};

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-command-proposals-'));

const writeCommandQuality = (repo: string, records: CommandRecordSeed[]): void => {
  const artifactPath = path.join(repo, '.playbook', 'telemetry', 'command-quality.json');
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'command-execution-quality',
        generatedAt: '2026-01-01T00:00:00.000Z',
        records: records.map((record, index) => ({
          ...record,
          recorded_at: `2026-01-0${(index % 5) + 1}T00:00:00.000Z`,
          inputs_summary: 'seed',
          artifacts_read: [],
          artifacts_written: [],
          downstream_artifacts_produced: [],
          warnings_count: record.warnings_count ?? 0,
          open_questions_count: record.open_questions_count ?? 0
        })),
        summary: {
          total_runs: records.length,
          success_runs: records.filter((record) => record.success_status === 'success').length,
          failure_runs: records.filter((record) => record.success_status === 'failure').length,
          partial_runs: records.filter((record) => record.success_status === 'partial').length,
          average_duration_ms: 0,
          average_confidence_score: 0,
          total_warnings: records.reduce((sum, record) => sum + (record.warnings_count ?? 0), 0),
          total_open_questions: records.reduce((sum, record) => sum + (record.open_questions_count ?? 0), 0)
        }
      },
      null,
      2
    )
  );
};

describe('command improvement proposals', () => {
  it('emits failure-heavy command proposal', () => {
    const repo = createRepo();
    writeCommandQuality(repo, [
      { command_name: 'verify', run_id: 'r1', success_status: 'failure', duration_ms: 1000, confidence_score: 0.8 },
      { command_name: 'verify', run_id: 'r2', success_status: 'failure', duration_ms: 1200, confidence_score: 0.78 },
      { command_name: 'verify', run_id: 'r3', success_status: 'success', duration_ms: 900, confidence_score: 0.81 }
    ]);

    const artifact = generateCommandImprovementProposals(repo, []);
    expect(artifact.proposals.some((proposal) => proposal.command_name === 'verify' && proposal.issue_type === 'high_failure_rate')).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('emits low-confidence command proposal', () => {
    const repo = createRepo();
    writeCommandQuality(repo, [
      { command_name: 'route', run_id: 'r1', success_status: 'success', duration_ms: 400, confidence_score: 0.4 },
      { command_name: 'route', run_id: 'r2', success_status: 'success', duration_ms: 380, confidence_score: 0.45 },
      { command_name: 'route', run_id: 'r3', success_status: 'success', duration_ms: 420, confidence_score: 0.42 }
    ]);

    const artifact = generateCommandImprovementProposals(repo, []);
    expect(artifact.proposals.some((proposal) => proposal.command_name === 'route' && proposal.issue_type === 'low_confidence')).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('rejects sparse evidence proposals', () => {
    const repo = createRepo();
    writeCommandQuality(repo, [
      { command_name: 'improve', run_id: 'r1', success_status: 'failure', duration_ms: 300, confidence_score: 0.5 }
    ]);

    const artifact = generateCommandImprovementProposals(repo, []);
    expect(artifact.proposals).toHaveLength(0);
    expect(artifact.rejected_proposals.length).toBeGreaterThan(0);
    expect(artifact.rejected_proposals[0]?.blocking_reasons.some((reason) => reason.includes('insufficient_evidence_count'))).toBe(true);

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('sorts proposals deterministically', () => {
    const repo = createRepo();
    writeCommandQuality(repo, [
      { command_name: 'zeta', run_id: 'a', success_status: 'failure', duration_ms: 100, confidence_score: 0.3 },
      { command_name: 'zeta', run_id: 'b', success_status: 'failure', duration_ms: 100, confidence_score: 0.3 },
      { command_name: 'zeta', run_id: 'c', success_status: 'failure', duration_ms: 100, confidence_score: 0.3 },
      { command_name: 'alpha', run_id: 'd', success_status: 'failure', duration_ms: 100, confidence_score: 0.3 },
      { command_name: 'alpha', run_id: 'e', success_status: 'failure', duration_ms: 100, confidence_score: 0.3 },
      { command_name: 'alpha', run_id: 'f', success_status: 'failure', duration_ms: 100, confidence_score: 0.3 }
    ]);

    const artifact = generateCommandImprovementProposals(repo, []);
    const ids = artifact.proposals.map((proposal) => proposal.proposal_id);
    expect(ids).toEqual([...ids].sort((left, right) => left.localeCompare(right)));

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('marks severe repeated partial-failure proposals as governance gated', () => {
    const repo = createRepo();
    writeCommandQuality(repo, [
      { command_name: 'execute', run_id: 'r1', success_status: 'partial', duration_ms: 900, confidence_score: 0.7 },
      { command_name: 'execute', run_id: 'r2', success_status: 'partial', duration_ms: 950, confidence_score: 0.71 },
      { command_name: 'execute', run_id: 'r3', success_status: 'partial', duration_ms: 910, confidence_score: 0.69 },
      { command_name: 'execute', run_id: 'r4', success_status: 'success', duration_ms: 800, confidence_score: 0.74 }
    ]);

    const artifact = generateCommandImprovementProposals(repo, []);
    const proposal = artifact.proposals.find((entry) => entry.command_name === 'execute' && entry.issue_type === 'repeated_partial_failures');
    expect(proposal?.gating_tier).toBe('GOVERNANCE');

    fs.rmSync(repo, { recursive: true, force: true });
  });
});
