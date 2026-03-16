import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import type { VerifyRule } from '../lib/loadVerifyRules.js';

const verifyRepo = vi.fn();
const loadConfig = vi.fn();
const formatHuman = vi.fn();
const loadVerifyRules = vi.fn<() => Promise<VerifyRule[]>>();
const getLatestMutableRun = vi.fn();
const createExecutionIntent = vi.fn();
const createExecutionRun = vi.fn();
const appendExecutionStep = vi.fn();
const executionRunPath = vi.fn();
const attachSessionRunState = vi.fn();
const completeExecutionRun = vi.fn();
const appendCommandExecutionQualityRecord = vi.fn();
const safeRecordRepositoryEvent = vi.fn((callback: () => void) => callback());
const recordCommandQuality = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ verifyRepo, loadConfig, formatHuman, getLatestMutableRun, createExecutionIntent, createExecutionRun, appendExecutionStep, completeExecutionRun, executionRunPath, attachSessionRunState, appendCommandExecutionQualityRecord, safeRecordRepositoryEvent, recordCommandQuality }));
vi.mock('../lib/loadVerifyRules.js', () => ({ loadVerifyRules }));

describe('runVerify policy mode', () => {
  beforeEach(() => {
    verifyRepo.mockReset();
    loadConfig.mockReset();
    formatHuman.mockReset();
    loadVerifyRules.mockReset();
    getLatestMutableRun.mockReset();
    createExecutionIntent.mockReset();
    createExecutionRun.mockReset();
    appendExecutionStep.mockReset();
    executionRunPath.mockReset();
    attachSessionRunState.mockReset();
    completeExecutionRun.mockReset();
    formatHuman.mockReturnValue('human report');
    loadConfig.mockReturnValue({ config: { verify: { policy: { rules: [] } } } });
    getLatestMutableRun.mockReturnValue({ id: 'run-test', steps: [] });
    appendExecutionStep.mockReturnValue({ id: 'run-test', steps: [] });
    loadVerifyRules.mockResolvedValue([
      {
        id: 'requireNotesOnChanges',
        description: 'require notes updates',
        check: ({ failure }) => failure.id === 'requireNotesOnChanges',
        policy: { id: 'requireNotesOnChanges' },
        remediation: ['update notes']
      },
      {
        id: 'notes.empty',
        description: 'notes should not be empty',
        check: ({ failure }) => failure.id === 'notes.empty',
        policy: { id: 'notes.empty' }
      }
    ]);
  });



  it('prints help without invoking verify engine', async () => {
    const { runVerify } = await import('./verify.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runVerify('/repo', { format: 'text', ci: false, quiet: false, explain: false, policy: false, help: true });

    expect(exitCode).toBe(ExitCode.Success);
    expect(verifyRepo).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Usage: playbook verify [options]');

    logSpy.mockRestore();
  });

  it('returns policy failure when configured policy rule is violated', async () => {
    const { runVerify } = await import('./verify.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    verifyRepo.mockReturnValue({
      ok: false,
      summary: { failures: 1, warnings: 0 },
      failures: [{ id: 'requireNotesOnChanges', message: 'notes file not updated', fix: 'add notes' }],
      warnings: []
    });
    loadConfig.mockReturnValue({ config: { verify: { policy: { rules: ['requireNotesOnChanges'] } } } });

    const exitCode = await runVerify('/repo', { format: 'json', ci: true, quiet: true, explain: false, policy: true });

    expect(exitCode).toBe(ExitCode.PolicyFailure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.ok).toBe(false);
    expect(payload.policyViolations).toEqual([
      {
        policyId: 'requireNotesOnChanges',
        ruleId: 'requireNotesOnChanges',
        message: 'notes file not updated',
        remediation: ['update notes']
      }
    ]);

    logSpy.mockRestore();
  });

  it('keeps non-policy failures informational in policy mode', async () => {
    const { runVerify } = await import('./verify.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    verifyRepo.mockReturnValue({
      ok: false,
      summary: { failures: 2, warnings: 0 },
      failures: [
        { id: 'requireNotesOnChanges', message: 'notes file not updated', fix: 'add notes' },
        { id: 'notes.empty', message: 'notes file is empty' }
      ],
      warnings: []
    });
    loadConfig.mockReturnValue({ config: { verify: { policy: { rules: ['requireNotesOnChanges'] } } } });

    const exitCode = await runVerify('/repo', { format: 'json', ci: true, quiet: true, explain: false, policy: true });

    expect(exitCode).toBe(ExitCode.PolicyFailure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).toEqual([
      expect.objectContaining({ id: 'verify.rule.requireNotesOnChanges', level: 'error' }),
      expect.objectContaining({ id: 'verify.rule.notes.empty', level: 'info' })
    ]);

    logSpy.mockRestore();
  });

  it('writes deterministic json artifacts with --out while keeping stdout JSON parseable', async () => {
    const { runVerify } = await import('./verify.js');
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-verify-out-'));
    const outputPath = path.join(repoDir, '.playbook', 'findings.json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    verifyRepo.mockReturnValue({
      ok: false,
      summary: { failures: 1, warnings: 0 },
      failures: [{ id: 'requireNotesOnChanges', message: 'notes file not updated', fix: 'add notes' }],
      warnings: []
    });

    const exitCode = await runVerify(repoDir, {
      format: 'json',
      ci: true,
      quiet: true,
      explain: false,
      policy: false,
      outFile: outputPath
    });

    expect(exitCode).toBe(ExitCode.PolicyFailure);
    const stdoutPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const artifactPayload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    expect(artifactPayload.data).toEqual(stdoutPayload);
    expect(typeof artifactPayload.checksum).toBe('string');
    expect(artifactPayload.version).toBe(1);

    const contaminated = `pnpm header\n${fs.readFileSync(outputPath, 'utf8')}`;
    expect(() => JSON.parse(contaminated)).toThrow();

    logSpy.mockRestore();
  });
});
