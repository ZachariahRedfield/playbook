import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const generateRepositoryHealth = vi.fn();
const queryRepositoryIndex = vi.fn();
const queryRisk = vi.fn();
const runDocsAudit = vi.fn();
const classifySignalFailureDomains = vi.fn();
const existsSync = vi.fn();
const collectVerifyReport = vi.fn();
const runArchitectureAudit = vi.fn();

vi.mock('@zachariahredfield/playbook-core', () => ({
  runArchitectureAudit
}));

vi.mock('@zachariahredfield/playbook-engine', () => ({
  generateRepositoryHealth,
  queryRepositoryIndex,
  queryRisk,
  runDocsAudit,
  classifySignalFailureDomains
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
    generateRepositoryHealth.mockReset();
    queryRepositoryIndex.mockReset();
    queryRisk.mockReset();
    runDocsAudit.mockReset();
    classifySignalFailureDomains.mockReset();
    existsSync.mockReset();
    collectVerifyReport.mockReset();
    runArchitectureAudit.mockReset();

    existsSync.mockReturnValue(true);
    generateRepositoryHealth.mockReturnValue({
      artifactHygiene: {
        classification: { runtime: [], automation: [], contract: [] },
        findings: [],
        suggestions: []
      },
      memoryDiagnostics: {
        findings: [
          {
            code: 'memory-lifecycle-healthy',
            severity: 'info',
            message: 'Memory replay and promoted-knowledge lifecycle diagnostics are healthy.',
            recommendation: 'Continue replay-before-promotion and salience-gated promotion workflows.'
          }
        ],
        suggestions: []
      }
    });
    collectVerifyReport.mockResolvedValue({
      ok: true,
      summary: { failures: 0, warnings: 0 },
      failures: [],
      warnings: []
    });
    runDocsAudit.mockReturnValue({ ok: true, status: 'pass', summary: { errors: 0, warnings: 0, checksRun: 1 }, findings: [] });
    runArchitectureAudit.mockReturnValue({
      schemaVersion: '1.0',
      command: 'audit-architecture',
      ok: true,
      summary: { status: 'pass', checks: 8, pass: 8, warn: 0, fail: 0 },
      audits: [],
      nextActions: ['No action required. Architecture guardrails satisfy deterministic checks.']
    });
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
    classifySignalFailureDomains.mockReturnValue({
      failureDomains: [],
      primaryFailureDomain: null,
      domainBlockers: [],
      domainNextActions: []
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
    expect(output).toContain('Memory');

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
      summary: { errors: 0, warnings: 0 },
      failureDomains: [],
      primaryFailureDomain: null
    });
    expect(Array.isArray(payload.findings)).toBe(true);
    expect(payload.artifactHygiene).toMatchObject({
      classification: { runtime: [], automation: [], contract: [] },
      findings: [],
      suggestions: []
    });
    expect(payload.memoryDiagnostics).toMatchObject({
      findings: [
        {
          code: 'memory-lifecycle-healthy',
          severity: 'info',
          recommendation: 'Continue replay-before-promotion and salience-gated promotion workflows.'
        }
      ],
      suggestions: []
    });

    logSpy.mockRestore();
  });

  it('prints command help without running diagnosis', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runDoctor(process.cwd(), { format: 'text', quiet: false, help: true });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('Usage: playbook doctor [options]');
    expect(output).toContain('--ai');
    expect(queryRepositoryIndex).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });


  it('includes deterministic artifact hygiene suggestion IDs in json output', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generateRepositoryHealth.mockReturnValue({
      artifactHygiene: {
        classification: { runtime: [], automation: [], contract: [] },
        findings: [
          {
            type: 'missing-playbookignore',
            message: 'Missing .playbookignore in a large repository.',
            recommendation: 'Create .playbookignore.'
          }
        ],
        suggestions: [
          { id: 'PB012', title: 'Add .playbookignore', entries: ['dist/'] },
          { id: 'PB013', title: 'Update .gitignore for runtime artifacts', entries: ['.playbook/repo-index.json'] },
          { id: 'PB014', title: 'Move generated artifacts to .playbook runtime storage' }
        ]
      },
      memoryDiagnostics: {
        findings: [],
        suggestions: []
      }
    });

    const exitCode = await runDoctor(process.cwd(), { format: 'json', quiet: false });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.artifactHygiene.suggestions.map((entry: { id: string }) => entry.id)).toEqual(['PB012', 'PB013', 'PB014']);

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
