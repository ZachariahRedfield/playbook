import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findPortabilityOutcomes,
  getPortabilityOutcomeSummary,
  listPortabilityOutcomes,
  writePortabilityOutcomeRecord
} from './portabilityOutcomes.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-portability-outcomes-'));

describe('portability outcomes telemetry', () => {
  it('records accepted and successful transfer outcomes', () => {
    const repoRoot = createRepo();
    writePortabilityOutcomeRecord(repoRoot, {
      recommendation_id: 'recommendation-1',
      pattern_id: 'pattern.transferable',
      source_repo: 'source-repo',
      target_repo: 'target-repo',
      decision_status: 'accepted',
      decision_reason: 'deterministic evidence met threshold',
      adoption_status: 'adopted',
      observed_outcome: 'successful',
      outcome_confidence: 0.92,
      timestamp: '2026-05-01T00:00:00.000Z'
    });

    const summary = getPortabilityOutcomeSummary(repoRoot);
    const records = findPortabilityOutcomes(repoRoot, { pattern_id: 'pattern.transferable', decision_status: 'accepted' });

    expect(summary.total_records).toBe(1);
    expect(summary.decision_status_counts.accepted).toBe(1);
    expect(records[0]?.observed_outcome).toBe('successful');
  });

  it('records rejected transfer outcomes', () => {
    const repoRoot = createRepo();
    writePortabilityOutcomeRecord(repoRoot, {
      recommendation_id: 'recommendation-2',
      pattern_id: 'pattern.unfit',
      source_repo: 'source-repo',
      target_repo: 'target-repo',
      decision_status: 'rejected',
      decision_reason: 'dependency mismatch',
      adoption_status: 'not-adopted',
      observed_outcome: 'unsuccessful',
      outcome_confidence: 0.88,
      timestamp: '2026-05-02T00:00:00.000Z'
    });

    const summary = getPortabilityOutcomeSummary(repoRoot);
    const records = findPortabilityOutcomes(repoRoot, { decision_status: 'rejected' });

    expect(summary.decision_status_counts.rejected).toBe(1);
    expect(records).toHaveLength(1);
    expect(records[0]?.adoption_status).toBe('not-adopted');
  });

  it('records inconclusive transfer outcomes', () => {
    const repoRoot = createRepo();
    writePortabilityOutcomeRecord(repoRoot, {
      recommendation_id: 'recommendation-3',
      pattern_id: 'pattern.needs-more-evidence',
      source_repo: 'source-repo',
      target_repo: 'target-repo',
      decision_status: 'reviewed',
      observed_outcome: 'inconclusive',
      timestamp: '2026-05-03T00:00:00.000Z'
    });

    const records = findPortabilityOutcomes(repoRoot, { pattern_id: 'pattern.needs-more-evidence' });

    expect(records).toHaveLength(1);
    expect(records[0]?.observed_outcome).toBe('inconclusive');
  });

  it('writes deterministic ordering and append-safe dedupe', () => {
    const repoRoot = createRepo();
    const accepted = {
      recommendation_id: 'recommendation-4',
      pattern_id: 'pattern.ordering',
      source_repo: 'source-repo',
      target_repo: 'target-repo',
      decision_status: 'accepted' as const,
      timestamp: '2026-05-05T00:00:00.000Z'
    };

    writePortabilityOutcomeRecord(repoRoot, {
      recommendation_id: 'recommendation-5',
      pattern_id: 'pattern.ordering',
      source_repo: 'source-repo',
      target_repo: 'target-repo',
      decision_status: 'proposed',
      timestamp: '2026-05-04T00:00:00.000Z'
    });
    writePortabilityOutcomeRecord(repoRoot, accepted);
    writePortabilityOutcomeRecord(repoRoot, accepted);

    const records = listPortabilityOutcomes(repoRoot);
    expect(records).toHaveLength(2);
    expect(records.map((record) => record.recommendation_id)).toEqual(['recommendation-5', 'recommendation-4']);
  });

  it('normalizes partial and missing optional fields', () => {
    const repoRoot = createRepo();

    writePortabilityOutcomeRecord(repoRoot, {
      recommendation_id: 'recommendation-6',
      pattern_id: 'pattern.partial',
      source_repo: 'source-repo',
      target_repo: 'target-repo',
      decision_status: 'superseded',
      timestamp: '2026-05-06T00:00:00.000Z'
    });

    const records = listPortabilityOutcomes(repoRoot);
    expect(records[0]).toMatchObject({
      recommendation_id: 'recommendation-6',
      pattern_id: 'pattern.partial',
      decision_status: 'superseded'
    });
    expect(records[0]?.decision_reason).toBeUndefined();
    expect(records[0]?.observed_outcome).toBeUndefined();
    expect(records[0]?.outcome_confidence).toBeUndefined();
  });
});
