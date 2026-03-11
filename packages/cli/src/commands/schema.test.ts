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
    expect(payload).toHaveProperty('context');
    expect(payload).toHaveProperty('ai-context');
    expect(payload).toHaveProperty('ai-contract');
    expect(payload).toHaveProperty('query');
    expect(payload).toHaveProperty('ignore');
    expect(payload).toHaveProperty('learn');

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



  it('prints the context schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['context'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookContextOutput');

    logSpy.mockRestore();
  });

  it('prints the ai-context schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['ai-context'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookAiContextOutput');

    logSpy.mockRestore();
  });




  it('prints the ai-contract schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['ai-contract'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookAiContractOutput');

    logSpy.mockRestore();
  });

  it('prints the query schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['query'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookQueryOutput');

    logSpy.mockRestore();
  });

  it('prints the ignore schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['ignore'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookIgnoreOutput');

    logSpy.mockRestore();
  });


  it('prints the learn schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['learn'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookLearnDraftOutput');

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
