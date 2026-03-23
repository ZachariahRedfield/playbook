import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runTestTriage } from './testTriage.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-test-triage-'));

describe('runTestTriage', () => {
  it('emits deterministic json for the same captured failure log', async () => {
    const repo = createRepo();
    const logPath = path.join(repo, 'failure.log');
    fs.writeFileSync(logPath, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ].join('\n'));

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const firstExit = await runTestTriage(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const first = String(spy.mock.calls.at(-1)?.[0]);
    const secondExit = await runTestTriage(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const second = String(spy.mock.calls.at(-1)?.[0]);

    expect(firstExit).toBe(ExitCode.Success);
    expect(secondExit).toBe(ExitCode.Success);
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    spy.mockRestore();
  });

  it('accepts stdin when --input is omitted', async () => {
    const repo = createRepo();
    const stdin = new PassThrough();
    stdin.end([
      '@fawxzzy/playbook lint: Error: eslint found 2 problems',
      'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook lint: `eslint .`'
    ].join('\n'));
    Object.defineProperty(stdin, 'isTTY', { value: false });
    const originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', { value: stdin, configurable: true });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTestTriage(repo, { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.source).toEqual({ input: 'stdin', path: null });
    expect(payload.status).toBe('failed');
    Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
    spy.mockRestore();
  });

  it('returns a stable json error when no input source is available', async () => {
    const repo = createRepo();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

    const exitCode = await runTestTriage(repo, { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.command).toBe('test-triage');
    expect(String(payload.error)).toContain('provide --input');
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    spy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the test-triage command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'test-triage');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Parse deterministic test failure triage guidance from captured Vitest/pnpm logs');
  });
});
