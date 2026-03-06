import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runExplain } from './explain.js';

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
        rules: ['PB001']
      },
      null,
      2
    )
  );
};

describe('runExplain', () => {
  it('returns JSON output contract for modules', async () => {
    const repo = createRepo('playbook-cli-explain-module-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['workouts'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'workouts',
      type: 'module',
      explanation: {
        name: 'workouts',
        responsibilities: [
          'Owns workouts feature behavior and boundaries.',
          'Encapsulates workouts domain logic and module-level policies.'
        ],
        dependencies: [],
        architecture: 'modular-monolith'
      }
    });

    logSpy.mockRestore();
  });

  it('renders architecture explanation in text mode', async () => {
    const repo = createRepo('playbook-cli-explain-architecture-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['architecture'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines[0]).toBe('Architecture: modular-monolith');
    expect(lines[2]).toBe('Structure');
    expect(lines[5]).toBe('Reasoning');

    logSpy.mockRestore();
  });

  it('returns failure and JSON error shape for unknown targets', async () => {
    const repo = createRepo('playbook-cli-explain-unknown-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['payments', '--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'payments',
      type: 'unknown',
      explanation: {
        message: 'Unable to explain "payments" from repository intelligence. Try: playbook query modules | playbook rules.'
      }
    });

    logSpy.mockRestore();
  });

  it('fails when target argument is missing', async () => {
    const repo = createRepo('playbook-cli-explain-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, [], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook explain: missing required <target> argument');

    errorSpy.mockRestore();
  });
});
