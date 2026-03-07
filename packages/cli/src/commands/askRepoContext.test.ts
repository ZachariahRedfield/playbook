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
        modules: [
          { name: 'users', dependencies: ['workouts'] },
          { name: 'workouts', dependencies: [] }
        ],
        database: 'supabase',
        rules: ['requireNotesOnChanges']
      },
      null,
      2
    )
  );
};

describe('ask --repo-context', () => {
  it('returns deterministic remediation guidance when repo index is missing', async () => {
    const repo = createRepo('playbook-cli-ask-repo-context-missing-index');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'modules', 'exist?'], {
      format: 'text',
      quiet: false,
      repoContext: true
    });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith(
      'Repository context is not available yet.\nRun `playbook index` to generate .playbook/repo-index.json and retry.'
    );

    errorSpy.mockRestore();
  });


  it('composes --module with --repo-context for narrowed indexed context', async () => {
    const repo = createRepo('playbook-cli-ask-repo-context-module');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['how', 'does', 'this', 'module', 'work?', '--module', 'workouts'], {
      format: 'json',
      quiet: false,
      repoContext: true,
      module: 'workouts'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.repoContext.enabled).toBe(true);
    expect(payload.context.module.module.name).toBe('workouts');

    logSpy.mockRestore();
  });

  it('loads trusted context sources into JSON output metadata', async () => {
    const repo = createRepo('playbook-cli-ask-repo-context-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'modules', 'exist?'], {
      format: 'json',
      quiet: false,
      repoContext: true,
      mode: 'concise'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.mode).toBe('concise');
    expect(payload.repoContext).toEqual({
      enabled: true,
      sources: ['.playbook/repo-index.json', 'generated-ai-contract-fallback']
    });
    expect(String(payload.question)).toBe('what modules exist?');

    logSpy.mockRestore();
  });
});
