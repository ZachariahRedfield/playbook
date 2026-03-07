import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const queryRepositoryIndex = vi.fn();
const queryRisk = vi.fn();
const runDocsAudit = vi.fn();
const existsSync = vi.fn();
const collectVerifyReport = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  queryRepositoryIndex,
  queryRisk,
  runDocsAudit
}));

vi.mock('node:fs', () => ({
  default: { existsSync },
  existsSync
}));

vi.mock('./verify.js', () => ({
  collectVerifyReport
}));

describe('runDoctor', () => {
  beforeEach(() => {
    queryRepositoryIndex.mockReset();
    queryRisk.mockReset();
    runDocsAudit.mockReset();
    existsSync.mockReset();
    collectVerifyReport.mockReset();

    existsSync.mockReturnValue(true);
    collectVerifyReport.mockResolvedValue({
      ok: true,
      summary: { failures: 0, warnings: 0 },
      failures: [],
      warnings: []
    });
    runDocsAudit.mockReturnValue({ ok: true, status: 'pass', summary: { errors: 0, warnings: 0, checksRun: 1 }, findings: [] });
    queryRepositoryIndex.mockReturnValue({
      command: 'query',
      field: 'modules',
      result: [{ name: 'auth', dependencies: [], path: 'src/auth' }]
    });
    queryRisk.mockReturnValue({
      schemaVersion: '1.0',
      command: 'query',
      type: 'risk',
      module: 'auth',
      riskScore: 0.21,
      riskLevel: 'low',
      signals: {
        directDependencies: 0,
        dependents: 1,
        transitiveImpact: 1,
        verifyFailures: 0,
        isArchitecturalHub: false
      },
      contributions: { fanIn: 0, impact: 0.1, verifyFailures: 0, hub: 0 },
      reasons: ['Stable module']
    });
  });

  it('prints text diagnosis sections', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runDoctor(process.cwd(), { format: 'text', quiet: false });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('Playbook Repository Diagnosis');
    expect(output).toContain('Architecture');
    expect(output).toContain('Docs');
    expect(output).toContain('Testing');
    expect(output).toContain('Risk');

    logSpy.mockRestore();
  });

  it('prints json diagnosis contract', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runDoctor(process.cwd(), { format: 'json', quiet: false });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(exitCode).toBe(ExitCode.Success);
    expect(payload).toMatchObject({
      schemaVersion: '1.0',
      command: 'doctor',
      status: 'ok',
      summary: { errors: 0, warnings: 0 }
    });
    expect(Array.isArray(payload.findings)).toBe(true);

    logSpy.mockRestore();
  });

  it('returns failure when error findings are present', async () => {
    const { runDoctor } = await import('./doctor.js');

    collectVerifyReport.mockResolvedValue({
      ok: false,
      summary: { failures: 1, warnings: 0 },
      failures: [{ id: 'PB001', message: 'Missing architecture docs' }],
      warnings: []
    });

    const exitCode = await runDoctor(process.cwd(), { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
  });
});
