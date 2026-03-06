import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const generatePlanContract = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ generatePlanContract }));

describe('runPlan', () => {
  beforeEach(() => {
    generatePlanContract.mockReset();
  });

  it('renders deterministic text output with task count and entries', async () => {
    const { runPlan } = await import('./plan.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: { ok: false, summary: { failures: 2, warnings: 0 }, failures: [], warnings: [] },
      tasks: [
        { id: 'task-1', ruleId: 'PB001', file: 'docs/ARCHITECTURE.md', action: 'update architecture docs', autoFix: true },
        { id: 'task-2', ruleId: 'plugin.custom', file: null, action: 'add plugin docs', autoFix: false }
      ]
    });

    const exitCode = await runPlan('/repo', { format: 'text', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Plan');
    expect(output).toContain('Tasks: 2');
    expect(output).toContain('PB001 Update architecture docs');
    expect(output).toContain('plugin.custom Add plugin docs');

    logSpy.mockRestore();
  });

  it('prints an empty plan cleanly in text mode', async () => {
    const { runPlan } = await import('./plan.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: { ok: true, summary: { failures: 0, warnings: 0 }, failures: [], warnings: [] },
      tasks: []
    });

    const exitCode = await runPlan('/repo', { format: 'text', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Tasks: 0');
    expect(output).toContain('(none)');

    logSpy.mockRestore();
  });

  it('emits stable json output for automation', async () => {
    const { runPlan } = await import('./plan.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: { ok: false, summary: { failures: 1, warnings: 0 }, failures: [], warnings: [] },
      tasks: [{ id: 'task-3', ruleId: 'plugin.custom', file: null, action: 'fix plugin contract', autoFix: true }]
    });

    const exitCode = await runPlan('/repo', { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'plan',
      ok: true,
      exitCode: ExitCode.Success,
      verify: { ok: false, summary: { failures: 1, warnings: 0 }, failures: [], warnings: [] },
      tasks: [{ id: 'task-3', ruleId: 'plugin.custom', file: null, action: 'fix plugin contract', autoFix: true }]
    });

    logSpy.mockRestore();
  });
});
