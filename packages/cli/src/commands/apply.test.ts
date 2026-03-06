import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const generatePlanContract = vi.fn();
const applyExecutionPlan = vi.fn();
const parsePlanArtifact = vi.fn();
const loadVerifyRules = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ generatePlanContract, applyExecutionPlan, parsePlanArtifact }));
vi.mock('../lib/loadVerifyRules.js', () => ({ loadVerifyRules }));

describe('runApply', () => {
  beforeEach(() => {
    generatePlanContract.mockReset();
    applyExecutionPlan.mockReset();
    parsePlanArtifact.mockReset();
    loadVerifyRules.mockReset();
  });

  it('renders deterministic text output', async () => {
    const { runApply } = await import('./apply.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({ verify: { ok: false }, tasks: [{ id: 'task-1', ruleId: 'PB001', file: 'docs/ARCHITECTURE.md', action: 'update docs', autoFix: true }] });
    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
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
    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
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

    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({ results: [], summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 } });

    await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' });

    expect(generatePlanContract).not.toHaveBeenCalled();
    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }],
      { dryRun: false, handlers: {} }
    );
  });

  it('fails clearly when --from-plan file is missing', async () => {
    const { runApply } = await import('./apply.js');

    await expect(runApply('/repo', { format: 'json', ci: false, quiet: false, fromPlan: 'missing-plan.json' })).rejects.toThrow(
      'Unable to read plan file at /repo/missing-plan.json:'
    );
    expect(generatePlanContract).not.toHaveBeenCalled();
  });

  it('fails clearly when --from-plan file has invalid json', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-invalid-json-'));
    const planPath = path.join(tmpRoot, 'plan.json');
    fs.writeFileSync(planPath, '{ this is not valid json');

    await expect(runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' })).rejects.toThrow(
      `Invalid plan JSON in ${planPath}:`
    );
    expect(generatePlanContract).not.toHaveBeenCalled();
    expect(parsePlanArtifact).not.toHaveBeenCalled();
  });

  it('fails clearly when --from-plan envelope is invalid', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-invalid-envelope-'));
    const planPath = path.join(tmpRoot, 'plan.json');

    fs.writeFileSync(planPath, JSON.stringify({ schemaVersion: '1.0', command: 'plan', tasks: [] }));
    parsePlanArtifact.mockImplementation(() => {
      throw new Error('Invalid plan payload: each task must include id, ruleId, action, and autoFix.');
    });

    await expect(runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' })).rejects.toThrow(
      'Invalid plan payload: each task must include id, ruleId, action, and autoFix.'
    );
    expect(generatePlanContract).not.toHaveBeenCalled();
  });

});
