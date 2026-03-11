import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import type { AnalyzeReport } from './analyze.js';
import type { VerifyReport } from './verify.js';

const collectAnalyzeReport = vi.fn<(cwd: string) => Promise<AnalyzeReport>>();
const ensureRepoIndex = vi.fn<(repoRoot: string) => Promise<string>>();
const collectDoctorReport = vi.fn();
const collectVerifyReport = vi.fn<(cwd: string) => Promise<VerifyReport>>();

vi.mock('./analyze.js', () => ({ collectAnalyzeReport, ensureRepoIndex }));
vi.mock('./doctor.js', () => ({ collectDoctorReport }));
vi.mock('./verify.js', () => ({ collectVerifyReport }));

const makeAnalyzeReport = (overrides?: Partial<AnalyzeReport>): AnalyzeReport => ({
  repoPath: '/tmp/repo',
  ok: true,
  detectorsRun: [],
  detected: [],
  summary: '',
  signals: '',
  recommendations: [],
  ...overrides
});

const makeVerifyReport = (overrides?: Partial<VerifyReport>): VerifyReport => ({
  ok: true,
  summary: { failures: 0, warnings: 0 },
  failures: [],
  warnings: [],
  ...overrides
});

describe('runStatus', () => {
  beforeEach(() => {
    collectDoctorReport.mockReset();
    collectAnalyzeReport.mockReset();
    collectVerifyReport.mockReset();
    ensureRepoIndex.mockReset();
    ensureRepoIndex.mockImplementation(async (repoRoot: string) => `${repoRoot}/.playbook/repo-index.json`);
  });

  it('prints top issue guidance when findings exist', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    collectDoctorReport.mockResolvedValue({ governanceStatus: [{ id: 'playbook-config', ok: true }], verifySummary: { failures: 0 } });
    collectAnalyzeReport.mockResolvedValue(
      makeAnalyzeReport({
        ok: false,
        recommendations: [
          {
            id: 'analyze-no-signals',
            title: 'No stack signals detected',
            severity: 'WARN',
            message: 'No known stack detectors matched this repository.',
            why: 'why',
            fix: 'fix'
          }
        ]
      })
    );
    collectVerifyReport.mockResolvedValue(makeVerifyReport());

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Top issue');
    expect(output).toContain('analyze-no-signals – Warn when no framework or database stack signals are detected.');
    expect(output).toContain('pnpm playbook explain analyze-no-signals');

    logSpy.mockRestore();
  });

  it('keeps json output unchanged', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    collectDoctorReport.mockResolvedValue({ governanceStatus: [{ id: 'playbook-config', ok: true }], verifySummary: { failures: 0 } });
    collectAnalyzeReport.mockResolvedValue(makeAnalyzeReport());
    collectVerifyReport.mockResolvedValue(makeVerifyReport());

    const exitCode = await runStatus(process.cwd(), { ci: false, format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('status');
    expect(payload).not.toHaveProperty('topIssue');

    logSpy.mockRestore();
  });

  it('generates repo index when missing before printing status output', async () => {
    const { runStatus } = await import('./status.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    collectDoctorReport.mockResolvedValue({ governanceStatus: [{ id: 'playbook-config', ok: true }], verifySummary: { failures: 0 } });
    collectAnalyzeReport.mockResolvedValue(makeAnalyzeReport({ repoPath: '/tmp/repo-root' }));
    collectVerifyReport.mockResolvedValue(makeVerifyReport());

    const exitCode = await runStatus('/tmp/subdir', { ci: false, format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(ensureRepoIndex).toHaveBeenCalledWith('/tmp/repo-root');

    logSpy.mockRestore();
  });
});
