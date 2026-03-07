import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runQuery } from './query.js';

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
          { name: 'auth', dependencies: [] },
          { name: 'workouts', dependencies: ['auth'] }
        ],
        database: 'supabase',
        rules: ['requireNotesOnChanges']
      },
      null,
      2
    )
  );
};

const writeVerifyReport = (repo: string): void => {
  const verifyPath = path.join(repo, '.playbook', 'verify-report.json');
  fs.mkdirSync(path.dirname(verifyPath), { recursive: true });
  fs.writeFileSync(
    verifyPath,
    JSON.stringify({
      schemaVersion: '1.0',
      command: 'verify',
      failures: [{ id: 'verify.failure.auth.config', message: 'auth module has policy gaps' }]
    })
  );
};

describe('runQuery', () => {
  it('prints text output for list fields', async () => {
    const repo = createRepo('playbook-cli-query-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['modules'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual(['Modules', '───────', 'auth: none', 'workouts: auth']);

    logSpy.mockRestore();
  });

  it('prints JSON output contract', async () => {
    const repo = createRepo('playbook-cli-query-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['modules'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'query',
      field: 'modules',
      result: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] }
      ]
    });

    logSpy.mockRestore();
  });

  it('prints dependency query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-dependencies');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['dependencies', 'workouts'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'dependencies',
      module: 'workouts',
      dependencies: ['auth']
    });

    logSpy.mockRestore();
  });


  it('prints impact query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-impact');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'impact',
      module: 'auth',
      affectedModules: ['workouts']
    });

    logSpy.mockRestore();
  });

  it('prints impact query text output', async () => {
    const repo = createRepo('playbook-cli-query-impact-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'auth'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Impact Analysis',
      '───────────────',
      '',
      'Changing module: auth',
      '',
      'Affected modules:',
      '',
      'workouts'
    ]);

    logSpy.mockRestore();
  });

  it('fails impact query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-impact-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query impact: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails impact query when module argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-impact-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query impact: missing required <module> argument');

    errorSpy.mockRestore();
  });



  it('prints risk query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-risk');
    writeRepoIndex(repo);
    writeVerifyReport(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      schemaVersion: '1.0',
      command: 'query',
      type: 'risk',
      module: 'auth',
      riskLevel: 'high',
      signals: {
        directDependencies: 0,
        dependents: 1,
        transitiveImpact: 1,
        verifyFailures: 1,
        isArchitecturalHub: false
      }
    });

    logSpy.mockRestore();
  });

  it('prints risk query text output', async () => {
    const repo = createRepo('playbook-cli-query-risk-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toContain('Risk Analysis');
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toContain('Module: auth');

    logSpy.mockRestore();
  });

  it('fails risk query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-risk-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query risk: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails risk query when module argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-risk-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query risk: missing required <module> argument');

    errorSpy.mockRestore();
  });

  it('fails dependency query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-dependencies-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['dependencies', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query dependencies: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails with clear error for unsupported fields', async () => {
    const repo = createRepo('playbook-cli-query-unsupported');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith(
      'playbook query: unsupported field "docs". Supported fields: architecture, framework, language, modules, database, rules.'
    );

    errorSpy.mockRestore();
  });

  it('fails when required field argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, [], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query: missing required <field> argument');

    errorSpy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the query command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'query');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Query machine-readable repository intelligence from .playbook/repo-index.json');
  });
});
