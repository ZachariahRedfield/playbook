import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { ensureRepoIndex, runAnalyze } from './analyze.js';

const createFile = (filePath: string, content = ''): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

describe('analyze repository index', () => {
  it('creates .playbook/repo-index.json when missing', async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-analyze-index-'));
    createFile(path.join(repoRoot, 'package.json'), '{"name":"test"}\n');
    createFile(path.join(repoRoot, 'tsconfig.json'), '{"compilerOptions":{}}\n');
    createFile(path.join(repoRoot, 'src', 'features', 'users', 'index.ts'), '');

    const indexPath = await ensureRepoIndex(repoRoot);

    expect(indexPath).toBe(path.join(repoRoot, '.playbook', 'repo-index.json'));
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
      schemaVersion: string;
      framework: string;
      language: string;
      architecture: string;
      modules: Array<{ name: string; dependencies: string[] }>;
      database: string;
      rules: string[];
    };

    expect(index).toMatchObject({
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [{ name: 'users', dependencies: [] }],
      database: 'none'
    });
    expect(index.rules.length).toBeGreaterThan(0);
  });

  it('writes .playbook/repo-index.json during analyze', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-analyze-run-'));
    createFile(path.join(cwd, 'package.json'), '{"name":"test","dependencies":{"next":"latest"}}\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyze(cwd, { ci: false, explain: false, format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);

    const outFile = path.join(cwd, '.playbook', 'repo-index.json');
    expect(fs.existsSync(outFile)).toBe(true);

    const payload = JSON.parse(fs.readFileSync(outFile, 'utf8')) as {
      schemaVersion: string;
      framework: string;
      language: string;
      architecture: string;
      modules: Array<{ name: string; dependencies: string[] }>;
      database: string;
      rules: string[];
    };

    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.framework).toBe('node');
    expect(typeof payload.language).toBe('string');
    expect(Array.isArray(payload.modules)).toBe(true);
    expect(typeof payload.architecture).toBe('string');
    expect(typeof payload.database).toBe('string');
    expect(Array.isArray(payload.rules)).toBe(true);

    logSpy.mockRestore();
  });
});
