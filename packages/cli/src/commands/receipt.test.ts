import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const ingestExecutionResults = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ ingestExecutionResults }));
vi.mock('./status.js', () => ({
  toFleetStatusResult: vi.fn(() => ({ fleet: { kind: 'fleet' } })),
  toQueueStatusResult: vi.fn(() => ({ queue: { kind: 'queue' } })),
  toExecutionStatusResult: vi.fn(() => ({ execution_plan: { session_id: 'session-1' } })),
  writeExecutionOutcomeInput: vi.fn((cwd: string, payload: unknown) => {
    const target = path.join(cwd, '.playbook', 'execution-outcome-input.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(payload, null, 2));
    return target;
  })
}));

describe('runReceipt', () => {
  beforeEach(() => {
    ingestExecutionResults.mockReset();
    ingestExecutionResults.mockReturnValue({
      outcome_input: {
        schemaVersion: '1.0',
        kind: 'fleet-adoption-execution-outcome-input',
        generated_at: '2026-01-04T00:00:00.000Z',
        session_id: 'session-1',
        prompt_outcomes: []
      },
      receipt: {
        kind: 'fleet-adoption-execution-receipt',
        verification_summary: { prompts_total: 2 }
      },
      updated_state: {
        kind: 'fleet-adoption-updated-state',
        summary: { repos_needing_retry: ['repo-b'], repos_needing_replan: [] }
      },
      next_queue: {
        kind: 'fleet-adoption-work-queue',
        work_items: [{ repo_id: 'repo-b' }]
      }
    });
  });

  it('ingests explicit execution results and writes the canonical outcome artifact', async () => {
    const { runReceipt } = await import('./receipt.js');
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-receipt-'));
    const inputPath = path.join(cwd, 'results.json');
    fs.writeFileSync(inputPath, JSON.stringify([
      { repo_id: 'repo-a', prompt_id: 'wave_1:index_lane:repo-a', status: 'success' },
      { repo_id: 'repo-b', prompt_id: 'wave_1:apply_lane:repo-b', status: 'failed', error: 'apply failed' }
    ], null, 2));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runReceipt(cwd, ['ingest', inputPath], { format: 'json', quiet: false, help: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(ingestExecutionResults).toHaveBeenCalled();
    expect(fs.existsSync(path.join(cwd, '.playbook', 'execution-outcome-input.json'))).toBe(true);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? '{}'));
    expect(payload.command).toBe('receipt');
    expect(payload.mode).toBe('ingest');
    expect(payload.receipt.kind).toBe('fleet-adoption-execution-receipt');
    logSpy.mockRestore();
  });
});
