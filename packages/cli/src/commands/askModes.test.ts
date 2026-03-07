import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runAsk } from './ask.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeRepoIndex = (repo: string): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        framework: 'nextjs',
        language: 'typescript',
        architecture: 'modular-monolith',
        modules: ['users', 'workouts'],
        database: 'supabase',
        rules: ['requireNotesOnChanges']
      },
      null,
      2
    )
  );
};

describe('ask response modes', () => {
  it('defaults to normal mode', async () => {
    const repo = createRepo('playbook-cli-ask-mode-default');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'architecture', 'does', 'this', 'repo', 'use?'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('normal');

    logSpy.mockRestore();
  });

  it('accepts concise mode', async () => {
    const repo = createRepo('playbook-cli-ask-mode-concise');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'architecture', '--mode', 'concise'], {
      format: 'json',
      quiet: false,
      mode: 'concise'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('concise');
    expect(String(payload.answer)).toContain('Architecture: modular-monolith');

    logSpy.mockRestore();
  });

  it('accepts ultra mode', async () => {
    const repo = createRepo('playbook-cli-ask-mode-ultra');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'architecture', '--mode', 'ultra'], {
      format: 'json',
      quiet: false,
      mode: 'ultra'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('ultra');
    expect(String(payload.answer)).toContain('- Architecture: modular-monolith');

    logSpy.mockRestore();
  });

  it('returns deterministic error for invalid mode', async () => {
    const repo = createRepo('playbook-cli-ask-mode-invalid');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'architecture'], {
      format: 'text',
      quiet: false,
      mode: 'verbose'
    });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('Invalid --mode value "verbose". Allowed values: normal, concise, ultra.');

    errorSpy.mockRestore();
  });
});
