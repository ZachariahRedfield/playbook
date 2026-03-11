import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
<<<<<<< HEAD
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';

const runContext = vi.fn<
  (cwd: string, options: { format: 'text' | 'json'; quiet: boolean }) => Promise<number>
>();
const runIndex = vi.fn<
  (cwd: string, options: { format: 'text' | 'json'; quiet: boolean; outFile?: string }) => Promise<number>
>();
const runQuery = vi.fn<
  (cwd: string, commandArgs: string[], options: { format: 'text' | 'json'; quiet: boolean; outFile?: string }) => Promise<number>
>();
const runVerify = vi.fn<
  (cwd: string, options: { format: 'text' | 'json'; ci: boolean; quiet: boolean; explain: boolean; policy: boolean; outFile?: string }) => Promise<number>
>();
const runPlan = vi.fn<
  (cwd: string, options: { format: 'text' | 'json'; ci: boolean; quiet: boolean; outFile?: string }) => Promise<number>
>();

vi.mock('./context.js', () => ({ runContext }));
vi.mock('./repoIndex.js', () => ({ runIndex }));
vi.mock('./query.js', () => ({ runQuery }));
vi.mock('./verify.js', () => ({ runVerify }));
vi.mock('./plan.js', () => ({ runPlan }));

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pilot-'));

const emitJsonPayload = (payload: unknown): void => {
  console.log(JSON.stringify(payload, null, 2));
};

describe('runPilot', () => {
  beforeEach(() => {
    runContext.mockReset();
    runIndex.mockReset();
    runQuery.mockReset();
    runVerify.mockReset();
    runPlan.mockReset();
  });

  it('runs baseline sequence, writes artifacts, and emits compact JSON summary', async () => {
    const repo = createRepo();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runContext.mockImplementation(async () => {
      emitJsonPayload({ command: 'context' });
      return ExitCode.Success;
    });
    runIndex.mockImplementation(async (cwd) => {
      const playbookDir = path.join(cwd, '.playbook');
      fs.mkdirSync(playbookDir, { recursive: true });
      fs.writeFileSync(path.join(playbookDir, 'repo-index.json'), JSON.stringify({ framework: 'node', architecture: 'modular-monolith' }, null, 2));
      fs.writeFileSync(path.join(playbookDir, 'repo-graph.json'), JSON.stringify({ kind: 'playbook-repo-graph' }, null, 2));
      emitJsonPayload({
        command: 'index',
        framework: 'node',
        architecture: 'modular-monolith'
      });
      return ExitCode.Success;
    });
    runQuery.mockImplementation(async () => {
      emitJsonPayload({
        command: 'query',
        field: 'modules',
        result: [{ name: 'app', dependencies: [] }, { name: 'api', dependencies: ['app'] }]
      });
      return ExitCode.Success;
    });
    runVerify.mockImplementation(async (_cwd, options) => {
      const payload = {
        schemaVersion: '1.0',
        command: 'verify',
        ok: false,
        exitCode: ExitCode.PolicyFailure,
        summary: 'Verification failed.',
        findings: [
          { id: 'verify.failure.one', level: 'error', message: 'one' },
          { id: 'verify.warning.one', level: 'warning', message: 'two' }
        ],
        nextActions: []
      };
      fs.mkdirSync(path.dirname(String(options.outFile)), { recursive: true });
      fs.writeFileSync(String(options.outFile), JSON.stringify(payload, null, 2));
      emitJsonPayload(payload);
      return ExitCode.PolicyFailure;
    });
    runPlan.mockImplementation(async (_cwd, options) => {
      const payload = {
        schemaVersion: '1.0',
        command: 'plan',
        ok: true,
        exitCode: ExitCode.Success,
        verify: { ok: false },
        remediation: { status: 'ready', totalSteps: 1, unresolvedFailures: 0 },
        tasks: [{ id: 'task-1', ruleId: 'PB001', action: 'fix' }]
      };
      fs.mkdirSync(path.dirname(String(options.outFile)), { recursive: true });
      fs.writeFileSync(String(options.outFile), JSON.stringify(payload, null, 2));
      emitJsonPayload(payload);
      return ExitCode.Success;
    });

    const { runPilot } = await import('./pilot.js');
    const result = await runPilot(repo, { format: 'json', quiet: false, repo });

    expect(result.exitCode).toBe(ExitCode.Success);
    expect(result.childCommands).toEqual(['context', 'index', 'query modules', 'verify', 'plan']);

    const summary = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(summary.command).toBe('pilot');
    expect(summary.targetRepoPath).toBe(repo);
    expect(summary.frameworkInference).toBe('node');
    expect(summary.architectureInference).toBe('modular-monolith');
    expect(summary.modulesDetectedCount).toBe(2);
    expect(summary.verifyFailuresCount).toBe(1);
    expect(summary.verifyWarningsCount).toBe(1);
    expect(summary.remediationStatus).toBe('ready');
    expect((summary.artifactPathsWritten as string[])).toContain('.playbook/findings.json');
    expect((summary.artifactPathsWritten as string[])).toContain('.playbook/plan.json');
    expect((summary.artifactPathsWritten as string[])).toContain('.playbook/pilot-summary.json');

    expect(() => JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'findings.json'), 'utf8'))).not.toThrow();
    expect(() => JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'plan.json'), 'utf8'))).not.toThrow();
    expect(() => JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'pilot-summary.json'), 'utf8'))).not.toThrow();
=======
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runPilot } from './pilot.js';

describe('runPilot', () => {
  it('runs baseline flow and writes deterministic artifacts for target repo', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pilot-'));
    const targetRepo = path.join(root, 'target');
    fs.mkdirSync(path.join(targetRepo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'package.json'), JSON.stringify({ name: 'target', version: '0.0.1' }, null, 2));
    fs.writeFileSync(path.join(targetRepo, 'src', 'index.ts'), 'export const ok = true;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPilot('/workspace/playbook', ['--repo', targetRepo], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);

    const summary = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { command: string; artifactPathsWritten: Record<string, string> };
    expect(summary.command).toBe('pilot');

    const findingsPath = path.join(targetRepo, '.playbook', 'findings.json');
    const planPath = path.join(targetRepo, '.playbook', 'plan.json');
    const summaryPath = path.join(targetRepo, '.playbook', 'pilot-summary.json');

    expect(() => JSON.parse(fs.readFileSync(findingsPath, 'utf8'))).not.toThrow();
    expect(() => JSON.parse(fs.readFileSync(planPath, 'utf8'))).not.toThrow();
    expect(() => JSON.parse(fs.readFileSync(summaryPath, 'utf8'))).not.toThrow();
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88

    logSpy.mockRestore();
  });

<<<<<<< HEAD
  it('returns failure when a mandatory phase fails', async () => {
    const repo = createRepo();

    runContext.mockImplementation(async () => {
      emitJsonPayload({ command: 'context' });
      return ExitCode.Success;
    });
    runIndex.mockImplementation(async () => {
      emitJsonPayload({ command: 'index', framework: 'node', architecture: 'modular-monolith' });
      return ExitCode.Success;
    });
    runQuery.mockImplementation(async () => {
      emitJsonPayload({ command: 'query', field: 'modules', error: 'missing index' });
      return ExitCode.Failure;
    });

    const { runPilot } = await import('./pilot.js');
    const result = await runPilot(repo, { format: 'text', quiet: true });

    expect(result.exitCode).toBe(ExitCode.Failure);
    expect(result.childCommands).toEqual(['context', 'index', 'query modules', 'verify', 'plan']);
  });
});

describe('command registry', () => {
  it('registers the pilot command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'pilot');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Run deterministic baseline external repository analysis in one command');
=======
  it('registers pilot command metadata in CLI command list', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'pilot');
    expect(command).toBeDefined();
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
  });
});
