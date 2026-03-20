import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    expect(second).toBe(first);
    spy.mockRestore();
  });

  it('returns a stable json error when the input path is missing', async () => {
    const repo = createRepo();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTestTriage(repo, { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.command).toBe('test-triage');
    expect(String(payload.error)).toContain('--input');
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
