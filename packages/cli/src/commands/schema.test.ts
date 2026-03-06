import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runSchema } from './schema.js';

describe('runSchema', () => {
  it('prints all schemas', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', [], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toHaveProperty('rules');
    expect(payload).toHaveProperty('explain');
    expect(payload).toHaveProperty('index');
    expect(payload).toHaveProperty('verify');
    expect(payload).toHaveProperty('plan');

    logSpy.mockRestore();
  });

  it('prints the rules schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['rules'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.command).toBeUndefined();
    expect(payload.title).toBe('PlaybookRulesOutput');

    logSpy.mockRestore();
  });

  it('prints the explain schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['explain'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookExplainOutput');

    logSpy.mockRestore();
  });

  it('fails on unknown schema target', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['unknown-command'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook schema: unknown schema target "unknown-command"');

    errorSpy.mockRestore();
  });
});
