import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYBOOK_SCHEMA_PATHS } from '../../packages/contracts/src/index.js';

type CycleStateLike = {
  cycle_version?: unknown;
  repo?: unknown;
  cycle_id?: unknown;
  started_at?: unknown;
  result?: unknown;
  failed_step?: unknown;
  steps?: unknown;
  artifacts_written?: unknown;
};

const validateCycleStateLike = (artifact: CycleStateLike): boolean => {
  const required = ['cycle_version', 'repo', 'cycle_id', 'started_at', 'result', 'steps'] as const;
  for (const key of required) {
    if (!(key in artifact)) {
      return false;
    }
  }

  if (typeof artifact.cycle_version !== 'number') return false;
  if (typeof artifact.repo !== 'string') return false;
  if (typeof artifact.cycle_id !== 'string') return false;
  if (typeof artifact.started_at !== 'string') return false;
  if (artifact.result !== 'success' && artifact.result !== 'failed') return false;
  if (!Array.isArray(artifact.steps)) return false;

  for (const step of artifact.steps) {
    if (typeof step !== 'object' || step === null) return false;
    const stepRecord = step as Record<string, unknown>;
    if (typeof stepRecord.name !== 'string') return false;
    if (stepRecord.status !== 'success' && stepRecord.status !== 'failure') return false;
    if (typeof stepRecord.duration_ms !== 'number') return false;
  }

  if (artifact.artifacts_written !== undefined) {
    if (!Array.isArray(artifact.artifacts_written) || artifact.artifacts_written.some((entry) => typeof entry !== 'string')) {
      return false;
    }
  }

  if (artifact.result === 'success' && artifact.failed_step !== undefined) {
    return false;
  }

  if (artifact.result === 'failed' && typeof artifact.failed_step !== 'string') {
    return false;
  }

  return true;
};

describe('cycle-state contract', () => {
  it('registers cycle-state schema path', () => {
    expect(PLAYBOOK_SCHEMA_PATHS.cycleState).toBe('packages/contracts/src/cycle-state.schema.json');
  });

  it('declares cycle-state result/failed_step guardrails', () => {
    const schemaPath = path.resolve(process.cwd(), PLAYBOOK_SCHEMA_PATHS.cycleState);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      properties?: { result?: { enum?: string[] } };
      allOf?: Array<{ then?: { required?: string[]; not?: { required?: string[] } } }>;
    };

    expect(schema.properties?.result?.enum).toEqual(['success', 'failed']);
    expect(schema.allOf?.[0]?.then?.not?.required).toEqual(['failed_step']);
    expect(schema.allOf?.[1]?.then?.required).toEqual(['failed_step']);
  });

  it('rejects malformed cycle-state payloads', () => {
    const malformedSuccess: CycleStateLike = {
      cycle_version: 1,
      repo: '/repo',
      cycle_id: 'id-1',
      started_at: new Date().toISOString(),
      result: 'success',
      failed_step: 'verify',
      steps: []
    };

    const malformedFailed: CycleStateLike = {
      cycle_version: 1,
      repo: '/repo',
      cycle_id: 'id-2',
      started_at: new Date().toISOString(),
      result: 'failed',
      steps: []
    };

    expect(validateCycleStateLike(malformedSuccess)).toBe(false);
    expect(validateCycleStateLike(malformedFailed)).toBe(false);
  });
});
