import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const generatePlanContract = vi.fn();
const routeTask = vi.fn();
const getLatestMutableRun = vi.fn();
const createExecutionIntent = vi.fn();
const createExecutionRun = vi.fn();
const appendExecutionStep = vi.fn();
const executionRunPath = vi.fn();
const attachSessionRunState = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ generatePlanContract, routeTask, getLatestMutableRun, createExecutionIntent, createExecutionRun, appendExecutionStep, executionRunPath, attachSessionRunState }));

describe('runPlan', () => {
  beforeEach(() => {
    generatePlanContract.mockReset();
    routeTask.mockReset();
    getLatestMutableRun.mockReset();
    createExecutionIntent.mockReset();
    createExecutionRun.mockReset();
    appendExecutionStep.mockReset();
    executionRunPath.mockReset();
    attachSessionRunState.mockReset();
    getLatestMutableRun.mockReturnValue({ id: 'run-test' });
    appendExecutionStep.mockReturnValue({ id: 'run-test' });
    executionRunPath.mockReturnValue('.playbook/runs/run-test.json');
    routeTask.mockReturnValue({
      route: 'deterministic_local',
      why: 'ok',
      requiredInputs: [],
      missingPrerequisites: [],
      repoMutationAllowed: false
    });
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
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plan-canonical-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: { ok: false, summary: { failures: 1, warnings: 0 }, failures: [], warnings: [] },
      tasks: [{ id: 'task-3', ruleId: 'plugin.custom', file: null, action: 'fix plugin contract', autoFix: true }]
    });

    const exitCode = await runPlan(repoDir, { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'plan',
      ok: true,
      exitCode: ExitCode.Success,
      verify: { ok: false, summary: { failures: 1, warnings: 0 }, failures: [], warnings: [] },
      remediation: { status: 'ready', totalSteps: 1, unresolvedFailures: 0 },
      tasks: [{ id: 'task-3', ruleId: 'plugin.custom', file: null, action: 'fix plugin contract', autoFix: true }]
    });
    const canonicalArtifact = JSON.parse(fs.readFileSync(path.join(repoDir, '.playbook', 'plan.json'), 'utf8'));
    expect(canonicalArtifact).toEqual(payload);

    logSpy.mockRestore();
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('reports explicit unavailable remediation state when failures have no tasks', async () => {
    const { runPlan } = await import('./plan.js');
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plan-unavailable-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: {
        ok: false,
        summary: { failures: 2, warnings: 0 },
        failures: [
          { id: 'verify.one', message: 'one' },
          { id: 'verify.two', message: 'two' }
        ],
        warnings: []
      },
      tasks: []
    });

    const exitCode = await runPlan(repoDir, { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.remediation).toEqual({
      status: 'unavailable',
      totalSteps: 0,
      unresolvedFailures: 2,
      reason: 'Verify failures were detected but no remediation tasks are currently available.'
    });

    logSpy.mockRestore();
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('treats warning-only verify.findings payloads as remediation not_needed', async () => {
    const { runPlan } = await import('./plan.js');
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plan-warnings-only-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: {
        ok: false,
        summary: { failures: 0, warnings: 0 },
        findings: [{ id: 'verify.warning.missing-note', level: 'warning', message: 'Missing note.' }]
      },
      tasks: []
    });

    const exitCode = await runPlan(repoDir, { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.remediation).toEqual({
      status: 'not_needed',
      totalSteps: 0,
      unresolvedFailures: 0,
      reason: 'No verify failures were detected.'
    });

    logSpy.mockRestore();
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('treats failure-backed verify.findings payloads with no tasks as remediation unavailable', async () => {
    const { runPlan } = await import('./plan.js');
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plan-findings-failure-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: {
        ok: false,
        summary: { failures: 1, warnings: 0 },
        findings: [{ id: 'verify.failure.missing-note', level: 'failure', message: 'Missing required note.' }]
      },
      tasks: []
    });

    const exitCode = await runPlan(repoDir, { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.remediation).toEqual({
      status: 'unavailable',
      totalSteps: 0,
      unresolvedFailures: 1,
      reason: 'Verify failures were detected but no remediation tasks are currently available.'
    });

    logSpy.mockRestore();
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('writes deterministic json artifacts with --out', async () => {
    const { runPlan } = await import('./plan.js');
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plan-out-'));
    const outputPath = path.join(repoDir, '.playbook', 'plan.json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: { ok: false, summary: { failures: 1, warnings: 0 }, failures: [], warnings: [] },
      tasks: [{ id: 'task-3', ruleId: 'plugin.custom', file: null, action: 'fix plugin contract', autoFix: true }]
    });

    const exitCode = await runPlan(repoDir, { format: 'json', ci: false, quiet: false, outFile: outputPath });

    expect(exitCode).toBe(ExitCode.Success);
    const stdoutPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const artifactPayload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    expect(artifactPayload.data).toEqual(stdoutPayload);
    expect(typeof artifactPayload.checksum).toBe('string');
    expect(artifactPayload.version).toBe(1);

    logSpy.mockRestore();
  });

});
