import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
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
          { name: 'users', dependencies: [] },
          { name: 'workouts', dependencies: ['users'] }
        ],
        database: 'supabase',
        rules: ['requireNotesOnChanges']
      },
      null,
      2
    )
  );
};

describe('runAsk', () => {
  it('prints text output for deterministic repository guidance', async () => {
    const repo = createRepo('playbook-cli-ask-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['where', 'should', 'a', 'new', 'feature', 'live?'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines[0]).toBe('Recommended location: src/features/<feature>');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('Reason');
    expect(lines[3]).toContain('modular-monolith architecture');

    logSpy.mockRestore();
  });

  it('prints JSON output contract', async () => {
    const repo = createRepo('playbook-cli-ask-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'architecture', 'does', 'this', 'repo', 'use?'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      answerability: { state: 'answered-from-trusted-artifact', artifact: '.playbook/repo-index.json' },
      command: 'ask',
      question: 'what architecture does this repo use?',
      mode: 'normal',
      modeInstruction: 'Respond with complete explanations, contextual details, and clear reasoning.',
      answer: 'Architecture: modular-monolith',
      reason: 'Derived from repository index architecture signal. Rule registry signals in the index: requireNotesOnChanges.',
      repoContext: {
        enabled: false,
        sources: []
      },
      scope: {
        module: undefined,
        diffContext: {
          enabled: false,
          baseRef: undefined
        }
      },
      context: {
        architecture: 'modular-monolith',
        framework: 'nextjs',
        modules: ['users', 'workouts'],
        sources: [
          { type: 'repo-index', path: '.playbook/repo-index.json' },
          { type: 'repo-graph', path: '.playbook/repo-graph.json' },
          { type: 'architecture-metadata', path: '.playbook/repo-index.json' },
          { type: 'rule-registry', path: '.playbook/repo-index.json' }
        ]
      }
    });

    logSpy.mockRestore();
  });


  it('supports module-scoped ask context via --module', async () => {
    const repo = createRepo('playbook-cli-ask-module');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['how', 'does', 'this', 'module', 'work?', '--module', 'workouts'], {
      format: 'json',
      quiet: false,
      module: 'workouts'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.context.module.module.name).toBe('workouts');
    expect(payload.context.module.impact.dependencies).toEqual(['users']);
    expect(payload.context.sources).toContainEqual({ type: 'module', name: 'workouts' });

    logSpy.mockRestore();
  });

  it('fails when required question argument is missing', async () => {
    const repo = createRepo('playbook-cli-ask-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, [], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook ask: missing required <question> argument');

    errorSpy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the ask command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'ask');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Answer repository questions from machine-readable intelligence context');
  });
});
