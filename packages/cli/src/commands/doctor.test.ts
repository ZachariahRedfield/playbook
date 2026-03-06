import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const generateRepositoryHealth = vi.fn();
const doctorFixes = [
  {
    id: 'doctor.fix.docs.directory',
    description: 'Ensure docs/ directory exists.',
    safeToAutoApply: true,
    check: vi.fn(async () => ({ applicable: true })),
    fix: vi.fn(async () => ({ changes: ['docs/'] }))
  },
  {
    id: 'doctor.fix.config.file',
    description: 'Repair missing playbook.config.json using Playbook defaults.',
    safeToAutoApply: true,
    check: vi.fn(async () => ({ applicable: false })),
    fix: vi.fn(async () => ({ changes: ['playbook.config.json'] }))
  }
];

vi.mock('@zachariahredfield/playbook-engine', () => ({
  generateRepositoryHealth
}));

vi.mock('../lib/doctorFixes.js', () => ({
  doctorFixes
}));

const healthyReport = {
  framework: 'Next.js',
  language: 'TypeScript',
  architecture: 'Modular Monolith',
  governanceStatus: [
    { id: 'playbook-config', ok: true, message: 'Playbook config detected' },
    { id: 'architecture-docs', ok: true, message: 'Architecture docs present' },
    { id: 'checklist-verify-step', ok: true, message: 'PLAYBOOK_CHECKLIST includes verify step' },
    { id: 'repo-index', ok: true, message: 'Repo index up to date' }
  ],
  verifySummary: { ok: true, failures: 0, warnings: 0 },
  suggestedActions: [],
  issues: []
};

describe('runDoctor', () => {
  beforeEach(() => {
    generateRepositoryHealth.mockReset();
    doctorFixes[0].check.mockClear();
    doctorFixes[1].check.mockClear();
  });

  it('prints repository health text output', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    generateRepositoryHealth.mockReturnValue(healthyReport);

    const exitCode = await runDoctor(process.cwd(), {
      format: 'text',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('Repository Health');
    expect(output).toContain('Framework: Next.js');
    expect(output).toContain('Automation');
    expect(output).toContain('1 safe fixes available');

    logSpy.mockRestore();
  });

  it('prints doctor json contract output', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    generateRepositoryHealth.mockReturnValue({
      ...healthyReport,
      issues: ['Repo index outdated'],
      suggestedActions: ['playbook analyze']
    });

    const exitCode = await runDoctor(process.cwd(), {
      format: 'json',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(exitCode).toBe(ExitCode.Success);
    expect(payload).toEqual({
      command: 'doctor',
      framework: 'Next.js',
      architecture: 'Modular Monolith',
      issues: ['Repo index outdated'],
      suggestedActions: ['playbook analyze']
    });

    logSpy.mockRestore();
  });

  it('handles empty repository health defaults', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    generateRepositoryHealth.mockReturnValue({
      framework: 'Unknown',
      language: 'Unknown',
      architecture: 'Unknown',
      governanceStatus: [
        { id: 'playbook-config', ok: false, message: 'Playbook config missing; defaults loaded' },
        { id: 'architecture-docs', ok: false, message: 'Architecture docs missing' },
        { id: 'checklist-verify-step', ok: false, message: 'PLAYBOOK_CHECKLIST missing verify step' },
        { id: 'repo-index', ok: false, message: 'Repo index missing' }
      ],
      verifySummary: { ok: true, failures: 0, warnings: 0 },
      suggestedActions: ['playbook analyze'],
      issues: ['Repo index missing']
    });

    const exitCode = await runDoctor(process.cwd(), {
      format: 'text',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('Framework: Unknown');
    expect(output).toContain('⚠ Repo index missing');
    expect(output).toContain('playbook analyze');

    logSpy.mockRestore();
  });

  it('suggests playbook plan when verify findings exist', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generateRepositoryHealth.mockReturnValue({
      ...healthyReport,
      verifySummary: { ok: false, failures: 1, warnings: 0 },
      suggestedActions: ['playbook plan'],
      issues: ['PLAYBOOK_CHECKLIST missing verify step']
    });

    const exitCode = await runDoctor(process.cwd(), {
      format: 'text',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('Run:');
    expect(output).toContain('playbook plan');

    logSpy.mockRestore();
  });
});
