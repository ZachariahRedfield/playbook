import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const generatePlanContract = vi.fn();
const applyExecutionPlan = vi.fn();
const loadVerifyRules = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ generatePlanContract, applyExecutionPlan }));
vi.mock('../lib/loadVerifyRules.js', () => ({ loadVerifyRules }));

describe('runApply', () => {
  beforeEach(() => {
    generatePlanContract.mockReset();
    applyExecutionPlan.mockReset();
    loadVerifyRules.mockReset();
  });

  it('renders deterministic text output', async () => {
    const { runApply } = await import('./apply.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({ verify: { ok: false }, tasks: [{ id: 'task-1', ruleId: 'PB001', file: 'docs/ARCHITECTURE.md', action: 'update docs', autoFix: true }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({
      results: [{ id: 'task-1', ruleId: 'PB001', file: 'docs/ARCHITECTURE.md', action: 'update docs', autoFix: true, status: 'applied' }],
      summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
    });

    const exitCode = await runApply('/repo', { format: 'text', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Apply');
    expect(output).toContain('Applied: 1');
    expect(output).toContain('task-1 PB001 applied docs/ARCHITECTURE.md');

    logSpy.mockRestore();
  });

  it('emits stable json output', async () => {
    const { runApply } = await import('./apply.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({ verify: { ok: false }, tasks: [{ id: 'task-3', ruleId: 'PB003', file: 'docs/PLAYBOOK_CHECKLIST.md', action: 'add verify step', autoFix: false }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({
      results: [{ id: 'task-3', ruleId: 'PB003', file: 'docs/PLAYBOOK_CHECKLIST.md', action: 'add verify step', autoFix: false, status: 'skipped' }],
      summary: { applied: 0, skipped: 1, unsupported: 0, failed: 0 }
    });

    const exitCode = await runApply('/repo', { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'apply',
      ok: true,
      exitCode: ExitCode.Success,
      results: [{ id: 'task-3', ruleId: 'PB003', file: 'docs/PLAYBOOK_CHECKLIST.md', action: 'add verify step', autoFix: false, status: 'skipped' }],
      summary: { applied: 0, skipped: 1, unsupported: 0, failed: 0 }
    });

    logSpy.mockRestore();
  });

  it('loads serialized plan tasks from --from-plan input', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-'));
    const planPath = path.join(tmpRoot, 'plan.json');

    fs.writeFileSync(
      planPath,
      JSON.stringify({
        schemaVersion: '1.0',
        command: 'plan',
        tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }]
      })
    );

    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({ results: [], summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 } });

    await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' });

    expect(generatePlanContract).not.toHaveBeenCalled();
    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }],
      expect.any(Object)
    );
  });
});
